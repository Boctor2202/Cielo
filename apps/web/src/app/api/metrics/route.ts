import { isFunnelEvent } from "@cielo/core";
import { adminDb } from "@/lib/server/admin";
import { rateLimited } from "@/lib/places";

/**
 * POST /api/metrics {event, platform}: adds one to today's counter for that event (see core metrics.ts).
 * Nothing about the person is read or kept: no account, no IP stored (the IP only feeds the in-memory rate limit).
 */
export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_METRICS !== "1") return new Response(null, { status: 204 });
  const b = (await req.json().catch(() => null)) as { event?: unknown; platform?: unknown } | null;
  const platform = b?.platform === "ios" || b?.platform === "android" ? b.platform : "web";
  if (!isFunnelEvent(b?.event)) return new Response(null, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(`metrics:${ip}`, 120)) return new Response(null, { status: 204 });
  const db = adminDb();
  // the table is created by migration 0024; until then nothing is counted
  if (db) await db.rpc("funnel_bump", { p_event: b.event, p_platform: platform }).then(() => undefined, () => undefined);
  return new Response(null, { status: 204 });
}
