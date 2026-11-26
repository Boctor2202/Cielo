import { accessFor, cleanScanned, noCardTrialDays } from "@cielo/core";
import { adminDb, isAdminId, userFrom } from "@/lib/server/admin";
import { reportAiFailure } from "@/lib/server/anthropic";
import { readPilotDocument } from "@/lib/server/documentAi";
import { ImportAiError } from "@/lib/server/importAi";
import { pageImages } from "@/lib/server/pageImages";
import { rateLimited } from "@/lib/places";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/document-scan — a licence or a medical certificate read by Claude (Max plan), to fill the documents
 * page: { images: [{ data, type }] } (photos, up to 4) or { pdf: base64 } (up to 8 MB), with consent: true (the
 * pilot agreed, before sending, that the document goes to Anthropic to be read).
 * Nothing is stored: neither the document nor what was read. The answer is a list of entries the pilot checks.
 */

const MAX_IMAGES = 4;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_B64 = 11_000_000; // about 8 MB

export async function POST(req: Request) {
  const user = await userFrom(req).catch(() => null);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { images?: unknown; pdf?: unknown; consent?: unknown } | null;
  if (!body) return Response.json({ error: "bad_request" }, { status: 400 });
  // health data (a medical certificate): sent only with the pilot's explicit consent (GDPR art. 9(2)(a))
  if (body.consent !== true) return Response.json({ error: "consent" }, { status: 400 });

  const db = adminDb();
  const { data: p } = db ? await db.from("pilots").select("created_at, trial_started_at, subscription_tier, subscription_expires_at").eq("id", user.id).maybeSingle() : { data: null };
  const access = accessFor(p ? { createdAt: p.trial_started_at ?? p.created_at, subscriptionTier: p.subscription_tier, subscriptionExpiresAt: p.subscription_expires_at } : undefined, { signedIn: true, noCardTrialDays: noCardTrialDays(process.env.NEXT_PUBLIC_NO_CARD_TRIAL_DAYS) });
  if (!(access.plan === "premium" && !access.demo) && !isAdminId(user.id)) return Response.json({ error: "plan" }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "unsupported" }, { status: 422 });
  if (rateLimited(`docscan:${user.id}`, 20, 3_600_000)) return Response.json({ error: "rate_limited" }, { status: 429 });

  let content: Parameters<typeof readPilotDocument>[0];
  if (typeof body.pdf === "string" && body.pdf.length) {
    const pdf = body.pdf.replace(/\s+/g, "");
    if (pdf.length > MAX_B64 || !pdf.startsWith("JVBER")) return Response.json({ error: "bad_request" }, { status: 400 });
    content = [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } }];
  } else {
    const images = (Array.isArray(body.images) ? body.images : []).slice(0, MAX_IMAGES) as { data?: unknown; type?: unknown }[];
    const ok = images.filter((i) => typeof i.data === "string" && i.data.length < MAX_B64 && IMAGE_TYPES.includes(String(i.type))) as { data: string; type: string }[];
    if (!ok.length) return Response.json({ error: "bad_request" }, { status: 400 });
    content = await pageImages(ok);
  }

  try {
    const r = await readPilotDocument(content, new Date().toISOString().slice(0, 10));
    const entries = r.document === "none" ? [] : r.entries.map((e) => cleanScanned(e)).filter((e) => e !== null);
    return Response.json({ document: r.document, entries }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof ImportAiError) return Response.json({ error: e.code }, { status: 422 });
    if (e instanceof SyntaxError) return Response.json({ error: "unreadable" }, { status: 422 });
    await reportAiFailure("document-scan", e);
    return Response.json({ error: "failed" }, { status: 502 });
  }
}
