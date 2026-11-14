import { CATEGORIES, nearby, PlacesError, rateLimited, type PlaceCategory } from "@/lib/places";

export const dynamic = "force-dynamic";

/** GET /api/escale/places?lat=&lng=&cat=restaurants&lang=fr */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const lat = Number(u.searchParams.get("lat"));
  const lng = Number(u.searchParams.get("lng"));
  const cat = u.searchParams.get("cat") as PlaceCategory;
  const lang = u.searchParams.get("lang") === "en" ? "en" : "fr";
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || !(cat in CATEGORIES)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) return Response.json({ error: "rate_limited" }, { status: 429 });
  try {
    const places = await nearby({ lat, lng }, cat, lang);
    return Response.json({ places }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof PlacesError) return Response.json({ error: e.code }, { status: e.status });
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}
