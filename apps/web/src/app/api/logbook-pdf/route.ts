import Anthropic from "@anthropic-ai/sdk";
import { accessFor, ep5Legs, parseAirFranceEp5, type LogbookLeg } from "@cielo/core";
import { adminDb, isAdminId, userFrom } from "@/lib/server/admin";
import { pdfText } from "@/lib/server/pdf";
import { rateLimited } from "@/lib/places";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/logbook-pdf { pdf: base64 } — the flights of a logbook statement exported as PDF by an airline
 * (Air France's monthly "Carnet de vol EP5", and any other layout) as legs to review before import.
 * Known layouts are read from the PDF's text without any AI (any plan); other layouts go to Claude (Max).
 */

const str = { type: ["string", "null"] };
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["timeBasis", "pilotName", "legs"],
  properties: {
    timeBasis: { type: "string", enum: ["UTC", "local"] },
    pilotName: str,
    legs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "dep", "arr", "out", "in", "totalMin", "nightMin", "registration", "aircraftType", "flightNumber", "function", "picName"],
        properties: {
          date: { type: "string", description: "YYYY-MM-DD, day of departure" },
          dep: { type: "string", description: "Departure airport code as printed (IATA or ICAO)" },
          arr: { type: "string", description: "Arrival airport code as printed (IATA or ICAO)" },
          out: { type: ["string", "null"], pattern: "^([01]\\d|2[0-3]):[0-5]\\d$", description: "Off-block HH:MM (convert decimal hours: 14.63 → 14:38)" },
          in: { type: ["string", "null"], pattern: "^([01]\\d|2[0-3]):[0-5]\\d$", description: "On-block HH:MM" },
          totalMin: { type: ["integer", "null"], description: "Block/flight time in minutes (1.32 decimal hours → 79)" },
          nightMin: { type: ["integer", "null"], description: "Night time in minutes when printed" },
          registration: str,
          aircraftType: { ...str, description: "ICAO type designator when printed" },
          flightNumber: str,
          function: { type: ["string", "null"], enum: ["PIC", "PICUS", "SIC", "DUAL", "FI", "FE", null] },
          picName: str,
        },
      },
    },
  },
} as const;

const SYSTEM = `You extract the flights of a pilot logbook statement exported by an airline or a crew system (monthly flight-hour statements, "carnet de vol", logbook extracts). Return one leg per flown sector, in order. Skip totals, cumulative lines, simulator-only and ground lines. Times are often decimal hours ("14.63" = 14:38) or "day | time"; convert to HH:MM and durations to minutes. A registration printed without its national prefix keeps the prefix of the airline's country when obvious (Air France "HZUN" → "F-HZUN"). Do not invent values: null when absent.`;

export async function POST(req: Request) {
  const user = await userFrom(req).catch(() => null);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (rateLimited(`logbookpdf:${user.id}`, 20)) return Response.json({ error: "rate_limited" }, { status: 429 });
  const b = (await req.json().catch(() => null)) as { pdf?: unknown } | null;
  const pdf = typeof b?.pdf === "string" ? b.pdf.replace(/\s+/g, "") : "";
  if (!pdf || pdf.length > 6_000_000 || !/^[A-Za-z0-9+/=]+$/.test(pdf)) return Response.json({ error: "bad_request" }, { status: 400 });

  // 1. layouts we know, read from the text
  try {
    const ep5 = parseAirFranceEp5(await pdfText(Uint8Array.from(Buffer.from(pdf, "base64")), 40));
    if (ep5) return Response.json({ reader: "airfrance-ep5", role: ep5.role ?? null, timeBasis: "UTC", legs: ep5Legs(ep5) satisfies LogbookLeg[] });
  } catch {
    // not a text PDF: the AI reader below
  }

  // 2. any other layout: Claude (Max plan)
  const db = adminDb();
  const { data: p } = db ? await db.from("pilots").select("created_at, subscription_tier, subscription_expires_at").eq("id", user.id).maybeSingle() : { data: null };
  const access = accessFor(p ? { createdAt: p.created_at, subscriptionTier: p.subscription_tier, subscriptionExpiresAt: p.subscription_expires_at } : undefined, { signedIn: true });
  if (!(access.plan === "premium" && !access.demo) && !isAdminId(user.id)) return Response.json({ error: "plan" }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "unsupported" }, { status: 422 });
  const client = new Anthropic();
  try {
    const stream = client.beta.messages.stream({
      model: "claude-opus-5-5",
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> } },
      system: SYSTEM,
      messages: [{ role: "user", content: [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } }, { type: "text", text: "Extract the flights." }] }],
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") return Response.json({ error: "refused" }, { status: 422 });
    if (msg.stop_reason === "max_tokens") return Response.json({ error: "too_long" }, { status: 422 });
    const out = JSON.parse(msg.content.map((c) => (c.type === "text" ? c.text : "")).join("")) as { timeBasis: string; legs: LogbookLeg[] };
    return Response.json({ reader: "ai", ...out }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof SyntaxError) return Response.json({ error: "unreadable" }, { status: 422 });
    if (e instanceof Anthropic.RateLimitError) return Response.json({ error: "busy" }, { status: 429 });
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}
