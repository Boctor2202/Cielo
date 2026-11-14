import { findHotel, hotelById, PlacesError, rateLimited } from "@/lib/places";

export const dynamic = "force-dynamic";

/** GET /api/escale/hotel?q=Hilton&lat=&lng=&lang=fr  (search)  ·  GET /api/escale/hotel?id=ChIJ…  (saved hotel) */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const lang = u.searchParams.get("lang") === "en" ? "en" : "fr";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) return Response.json({ error: "rate_limited" }, { status: 429 });
  try {
    const id = u.searchParams.get("id");
    if (id) return Response.json({ hotel: await hotelById(id, lang) }, { headers: { "Cache-Control": "no-store" } });
    const q = (u.searchParams.get("q") ?? "").trim().slice(0, 120);
    if (q.length < 2) return Response.json({ error: "bad_request" }, { status: 400 });
    const lat = Number(u.searchParams.get("lat"));
    const lng = Number(u.searchParams.get("lng"));
    const near = Number.isFinite(lat) && Number.isFinite(lng) && u.searchParams.has("lat") ? { lat, lng } : null;
    return Response.json({ hotels: await findHotel(q, near, lang) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof PlacesError) return Response.json({ error: e.code }, { status: e.status });
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}
