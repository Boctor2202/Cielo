import { nearby, PlacesError } from "@/lib/places";

export const dynamic = "force-dynamic";

/**
 * GET /api/escale/showcase?lang=fr — the best-rated restaurants around one fixed layover (Lisbon, city centre),
 * for the features page: what a pilot sees in the app, live from Google. One place only, so the public page
 * can never be used to search anywhere; the answer is shared by every visitor for 10 minutes (Google's content
 * is not kept longer).
 */
const CENTER = { lat: 38.7107, lng: -9.1365 };

export async function GET(req: Request) {
  const lang = new URL(req.url).searchParams.get("lang") === "en" ? "en" : "fr";
  try {
    const places = (await nearby(CENTER, "restaurants", lang))
      .filter((p) => p.photo && (p.reviews ?? 0) >= 200)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
    return Response.json({ city: "Lisboa", places }, { headers: { "Cache-Control": "public, max-age=600, s-maxage=600" } });
  } catch (e) {
    return Response.json({ error: e instanceof PlacesError ? e.code : "upstream" }, { status: e instanceof PlacesError ? e.status : 502 });
  }
}
