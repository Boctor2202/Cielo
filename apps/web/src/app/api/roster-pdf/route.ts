import Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@/lib/server/anthropic";
import { accessFor, parseLeonRoster } from "@cielo/core";
import { pdfText } from "@/lib/server/pdf";
import { adminDb, isAdminId, userFrom } from "@/lib/server/admin";
import { rateLimited } from "@/lib/places";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/roster-pdf { pdf: base64, fileName?, today: YYYY-MM-DD } — reads a roster exported as PDF (Leon,
 * AIMS, Netline, CAE…, every layout differs) and returns its duties as structured events. Times are returned
 * as printed with the basis the document states (UTC or local); the app converts local times with the
 * airports' time zones. Roster subscribers (Max plan) only; the file is not stored.
 * Known layouts (Leon) are read from the PDF's text without any AI; other layouts go to Claude.
 */


const KINDS = ["FLIGHT", "DEADHEAD", "STANDBY", "SIM", "GROUND", "OFF", "REST", "LEAVE", "OTHER"];
const hhmm = { type: ["string", "null"], pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" };
const str = { type: ["string", "null"] };

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["timeBasis", "pilotName", "events"],
  properties: {
    timeBasis: { type: "string", enum: ["UTC", "local"], description: "How the document's times are expressed: UTC (Z, UTC, GMT) or local time of the airport." },
    pilotName: str,
    events: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "date", "report", "start", "end", "endDayOffset", "flightNumber", "dep", "arr", "aircraftReg", "aircraftType", "title"],
        properties: {
          kind: { type: "string", enum: KINDS },
          date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "Day the duty or flight starts, YYYY-MM-DD" },
          report: { ...hhmm, description: "Report / check-in time when shown (the duty start), else null" },
          start: { ...hhmm, description: "Departure (off-block) time for a flight, start time otherwise; null for an all-day item" },
          end: { ...hhmm, description: "Arrival (on-block) time for a flight, end time otherwise; null for an all-day item" },
          endDayOffset: { type: "integer", enum: [0, 1, 2], description: "Days after `date` on which `end` falls" },
          flightNumber: str,
          dep: { ...str, description: "Departure airport code as printed (ICAO or IATA)" },
          arr: { ...str, description: "Arrival airport code as printed (ICAO or IATA)" },
          aircraftReg: str,
          aircraftType: { ...str, description: "Aircraft type as printed (ICAO designator when shown)" },
          title: { ...str, description: "Short label for non-flight items (e.g. 'Standby home', 'Day off', 'Sim LPC')" },
        },
      },
    },
  },
} as const;

const SYSTEM = `You extract an airline or business-aviation pilot's roster from a PDF exported by crew software (Leon, AIMS, Netline, CAE, Jeppesen, Sabre and others).

Return every duty in the document as one event each:
- FLIGHT: a flight leg operated by the pilot. One event per leg, with flight number, departure and arrival airports, off-block and on-block times, registration and type when shown.
- DEADHEAD: positioning as a passenger (DH, POS, PAX, "positioning").
- STANDBY: standby / reserve (SBY, RES, home or airport standby).
- SIM: simulator session or check in a simulator.
- GROUND: ground training, office, medical, briefing days.
- OFF, REST, LEAVE: days off, rest, vacation / leave.
- OTHER: anything else that occupies the pilot.

Rules:
- Use only what is printed. Never invent times, airports, registrations or flight numbers; use null when a field is not shown.
- Dates as YYYY-MM-DD. When the year is not printed on each line, take it from the document's period; a roster spanning New Year moves to the next year after December.
- Times as HH:MM, 24-hour, exactly as printed (do not convert time zones). Set timeBasis to "UTC" when the document says times are UTC/Z/GMT, else "local".
- A leg arriving after midnight has endDayOffset 1.
- The report / check-in time belongs to the first leg of the duty.
- Ignore totals, legends, page headers and footers.

Layout notes for common software:
- Leon ("Printed by Leon", columns Day / Aircraft Type / Check In / Description / Check Out / Function / Crew / Block / Home Base): a leg line reads "<check-in> A… <dep time><DEP> <ARR> <arr time> [<check-out>] <function> <crew> <block>", with the departure time glued to the departure code (e.g. "14:07LFBZ" means off-block 14:07 at LFBZ). The aircraft type and registration ("C68A 9H-J4K") are printed once per day for the legs of that day. A Check In time printed on a leg line is the report time of that duty. A day-long code such as "ON", "OFF", "SBY", "RES" printed as two lines ("ON 23:00 LFPB" then "ON LFPB 22:59") is ONE event running from the first time (on the previous UTC day when it is late evening) to the second: give date = the day of the first time, start = first time, end = second time, endDayOffset = 1. Map "ON" (on call, available) and "SBY"/"RES" to STANDBY, "OFF" to OFF, "SIM" to SIM, "DH"/"POS" legs to DEADHEAD. The page states "All times in UTC" when times are UTC.`;

export async function POST(req: Request) {
  const user = await userFrom(req).catch(() => null);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const db = adminDb();
  if (!db) return Response.json({ error: "not_configured" }, { status: 503 });
  const { data: p } = await db.from("pilots").select("created_at, subscription_tier, subscription_expires_at").eq("id", user.id).maybeSingle();
  const access = accessFor(
    p ? { createdAt: p.created_at, subscriptionTier: p.subscription_tier, subscriptionExpiresAt: p.subscription_expires_at } : undefined,
    { signedIn: true },
  );
  if (!(access.plan === "premium" && !access.demo) && !isAdminId(user.id)) return Response.json({ error: "plan" }, { status: 403 });
  if (rateLimited(`rosterpdf:${user.id}`, 10)) return Response.json({ error: "rate_limited" }, { status: 429 });

  const b = (await req.json().catch(() => null)) as { pdf?: unknown; fileName?: unknown; today?: unknown } | null;
  const pdf = typeof b?.pdf === "string" ? b.pdf.replace(/\s+/g, "") : "";
  if (!pdf || pdf.length > 4_000_000 || !/^[A-Za-z0-9+/=]+$/.test(pdf)) return Response.json({ error: "bad_request" }, { status: 400 });
  const today = typeof b?.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.today) ? b.today : new Date().toISOString().slice(0, 10);

  // 1. layouts we know: read the text directly (free, exact, no AI)
  try {
    const leon = parseLeonRoster(await pdfText(Uint8Array.from(Buffer.from(pdf, "base64"))));
    if (leon && leon.events.length) return Response.json({ ...leon, reader: "leon" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // not a readable text PDF: fall through to the AI reader
  }

  // 2. any other layout: Claude reads the document
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "unsupported" }, { status: 422 });
  const client = anthropic();
  try {
    const stream = client.beta.messages.stream({
      model: "claude-opus-5-5",
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> } },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } },
            { type: "text", text: `Today is ${today}. Extract the roster.` },
          ],
        },
      ],
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") return Response.json({ error: "refused" }, { status: 422 });
    if (msg.stop_reason === "max_tokens") return Response.json({ error: "too_long" }, { status: 422 });
    const text = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const out = JSON.parse(text) as { timeBasis: "UTC" | "local"; pilotName: string | null; events: unknown[] };
    return Response.json(out, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof SyntaxError) return Response.json({ error: "unreadable" }, { status: 422 });
    if (e instanceof Anthropic.RateLimitError) return Response.json({ error: "busy" }, { status: 429 });
    if (e instanceof Anthropic.APIError) return Response.json({ error: "upstream", status: e.status }, { status: 502 });
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}
