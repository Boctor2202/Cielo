import { AdsbError, aircraftNear } from "@/lib/adsb";
import { rateLimited } from "@/lib/places";

export const dynamic = "force-dynamic";

/** GET /api/radar?lat=48.5&lon=2.5&r=120 — live aircraft around a point (the client rounds lat/lon to 0.5°). */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const lat = Number(u.searchParams.get("lat"));
  const lon = Number(u.searchParams.get("lon"));
  const r = Number(u.searchParams.get("r"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(r) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || r <= 0) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(`radar:${ip}`, 12)) return Response.json({ error: "rate_limited" }, { status: 429 });
  try {
    const ac = await aircraftNear(Math.round(lat * 2) / 2, Math.round(lon * 2) / 2, r);
    // shared at the CDN for 10 s: every viewer of the same area reuses one upstream call
    return Response.json({ ac, at: Date.now() }, { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20" } });
  } catch (e) {
    if (e instanceof AdsbError) return Response.json({ error: e.code }, { status: e.status });
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}
