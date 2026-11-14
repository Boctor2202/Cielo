import { AdsbError, trackOf } from "@/lib/adsb";
import { rateLimited } from "@/lib/places";

export const dynamic = "force-dynamic";

/** GET /api/radar/trace?hex=394c0c — the aircraft's stored track (about the last 24 h), split into legs. */
export async function GET(req: Request) {
  const hex = (new URL(req.url).searchParams.get("hex") ?? "").toLowerCase();
  if (!/^~?[0-9a-f]{6}$/.test(hex)) return Response.json({ error: "bad_request" }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(`trace:${ip}`, 10)) return Response.json({ error: "rate_limited" }, { status: 429 });
  try {
    return Response.json(await trackOf(hex), { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } });
  } catch (e) {
    if (e instanceof AdsbError) return Response.json({ error: e.code }, { status: e.status });
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}
