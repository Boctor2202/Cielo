import { PlacesError, rateLimited } from "@/lib/places";
import { serverAirports } from "@/lib/server/routeMapSvg";
import { cityPhoto } from "@/lib/server/cityPhoto";

export const runtime = "nodejs";

/**
 * GET /api/city-photo?icao=LIML&lang=fr&n=0 → { photo } — a photo of the airport's city (its best-known
 * landmark), shown on layovers. n picks another photo of the same landmark ("change the picture").
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const icao = (u.searchParams.get("icao") ?? "").trim().toUpperCase();
  const lang = u.searchParams.get("lang") === "fr" ? "fr" : "en";
  const n = Math.max(0, Math.min(50, Number(u.searchParams.get("n")) || 0));
  if (!/^[A-Z0-9]{3,4}$/.test(icao)) return Response.json({ error: "bad_request" }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(`city:${ip}`, 60)) return Response.json({ error: "rate_limited" }, { status: 429 });
  try {
    const ap = (await serverAirports(u.origin)).get(icao);
    if (!ap) return Response.json({ photo: null });
    const photo = await cityPhoto(ap.city || ap.name, ap.country, { lat: ap.lat, lon: ap.lon }, lang, n);
    // a short cache only: Google's photo URLs are not to be kept
    return Response.json({ photo }, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=600" } });
  } catch (e) {
    const status = e instanceof PlacesError ? e.status : 502;
    return Response.json({ error: e instanceof PlacesError ? e.code : "upstream" }, { status });
  }
}
