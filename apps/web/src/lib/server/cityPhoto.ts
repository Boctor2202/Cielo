import { PlacesError } from "@/lib/places";

/**
 * A photo of the city of an airport, for layovers: its best-known landmark (Eiffel Tower for Paris, the Duomo
 * for Milan…) found once with the Google Places API (New), then its photos read on demand.
 * Google's terms: only the place ID may be kept (here, in memory per city); the photo itself is shown from
 * Google's URL, never stored, with its author's attribution.
 */

export interface CityPhoto {
  city: string;
  landmark: string;
  /** short-lived Google URL of the image (loaded by the browser / app straight from Google) */
  url: string;
  width: number;
  height: number;
  /** "Photo: name · Google", with the author's page */
  author: string;
  authorUri?: string;
  /** how many photos the landmark has (to offer another one) */
  count: number;
}

const landmarks = new Map<string, { id: string; name: string } | null>();

function apiKey() {
  const k = process.env.GOOGLE_MAPS_API_KEY;
  if (!k) throw new PlacesError("not_configured", "GOOGLE_MAPS_API_KEY is not set", 503);
  return k;
}

/**
 * The city's best-known landmark (cached by city): among the landmarks and attractions within ~35 km of the
 * airport, the one with the most Google reviews (the Eiffel Tower, the Duomo). The airport's own town is often a
 * suburb (Linate is in Segrate), so the search is around the airport, not by the town's name.
 */
async function landmarkOf(city: string, country: string, near: { lat: number; lon: number }, lang: string) {
  const k = `${near.lat.toFixed(2)}|${near.lon.toFixed(2)}`;
  if (landmarks.has(k)) return landmarks.get(k)!;
  const d = 0.32;
  const box = { rectangle: { low: { latitude: near.lat - d, longitude: near.lon - d * 1.4 }, high: { latitude: near.lat + d, longitude: near.lon + d * 1.4 } } };
  const search = async (textQuery: string) => {
    const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey(), "X-Goog-FieldMask": "places.id,places.displayName,places.userRatingCount,places.types,places.photos.name" },
      body: JSON.stringify({ textQuery, languageCode: lang, locationRestriction: box, pageSize: 20 }),
      cache: "no-store",
    });
    if (!r.ok) throw new PlacesError("upstream", `Places API ${r.status}`);
    return ((await r.json()) as { places?: { id: string; displayName?: { text: string }; userRatingCount?: number; types?: string[]; photos?: unknown[] }[] }).places ?? [];
  };
  const found = [...(await search("famous landmark")), ...(await search(`monument ${city}`).catch(() => []))];
  // a sight people visit, not a shop, an airport or a hotel
  const NOT = ["airport", "lodging", "shopping_mall", "store", "restaurant", "stadium", "place_of_worship_small"];
  const best = found
    .filter((p) => p.photos?.length && !(p.types ?? []).some((t) => NOT.includes(t)))
    .sort((a, b) => (b.userRatingCount ?? 0) - (a.userRatingCount ?? 0))[0];
  const hit = best ? { id: best.id, name: best.displayName?.text ?? city } : null;
  void country;
  landmarks.set(k, hit);
  return hit;
}

/** The n-th photo of the city's landmark (n wraps around), or null when Google has none. */
export async function cityPhoto(city: string, country: string, near: { lat: number; lon: number }, lang: string, n = 0): Promise<CityPhoto | null> {
  const lm = await landmarkOf(city, country, near, lang);
  if (!lm) return null;
  const d = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(lm.id)}?languageCode=${lang}`, {
    headers: { "X-Goog-Api-Key": apiKey(), "X-Goog-FieldMask": "displayName,photos" },
    cache: "no-store",
  });
  if (!d.ok) throw new PlacesError("upstream", `Places API ${d.status}`);
  const det = (await d.json()) as { displayName?: { text: string }; photos?: { name: string; widthPx: number; heightPx: number; authorAttributions?: { displayName?: string; uri?: string }[] }[] };
  // landscape photos first: they fill the banner
  const photos = (det.photos ?? []).slice().sort((a, b) => Number(b.widthPx >= b.heightPx) - Number(a.widthPx >= a.heightPx));
  if (!photos.length) return null;
  const ph = photos[((n % photos.length) + photos.length) % photos.length]!;
  const m = await fetch(`https://places.googleapis.com/v1/${ph.name}/media?maxWidthPx=1200&skipHttpRedirect=true`, { headers: { "X-Goog-Api-Key": apiKey() }, cache: "no-store" });
  if (!m.ok) throw new PlacesError("upstream", `Places photo ${m.status}`);
  const { photoUri } = (await m.json()) as { photoUri?: string };
  if (!photoUri) return null;
  const a = ph.authorAttributions?.[0];
  return { city, landmark: det.displayName?.text ?? lm.name, url: photoUri, width: ph.widthPx, height: ph.heightPx, author: a?.displayName ?? "", authorUri: a?.uri, count: photos.length };
}
