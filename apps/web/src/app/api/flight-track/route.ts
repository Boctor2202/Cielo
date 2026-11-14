import { pickLeg, simplifyTrack } from "@cielo/core";
import { AdsbError, trackOf } from "@/lib/adsb";
import { rateLimited } from "@/lib/places";

export const dynamic = "force-dynamic";

/**
 * GET /api/flight-track?hex=394c0c&out=2026-11-14T08:05:00Z&in=2026-11-14T09:20:00Z
 * The real track of one logged flight: the aircraft's recorded leg matching the block times, simplified.
 * adsb.lol keeps about the last 24 h, so this only works for recent flights.
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const hex = (u.searchParams.get("hex") ?? "").toLowerCase();
  const out = u.searchParams.get("out") ?? "";
  const inn = u.searchParams.get("in") ?? "";
  if (!/^~?[0-9a-f]{6}$/.test(hex) || Number.isNaN(Date.parse(out)) || Number.isNaN(Date.parse(inn))) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(`ftrack:${ip}`, 10)) return Response.json({ error: "rate_limited" }, { status: 429 });
  try {
    const t = await trackOf(hex);
    const leg = pickLeg(t.legs, out, inn);
    if (!leg) return Response.json({ error: "no_match" }, { status: 404 });
    return Response.json({ hex: t.hex, points: simplifyTrack(leg) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof AdsbError) return Response.json({ error: e.code }, { status: e.status });
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}
