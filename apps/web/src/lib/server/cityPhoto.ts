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

type Hit = { id: string; displayName?: { text: string }; userRatingCount?: number; types?: string[]; formattedAddress?: string; location?: { latitude: number; longitude: number }; photos?: unknown[] };

async function searchText(body: Record<string, unknown>, fields: string): Promise<Hit[]> {
  const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey(), "X-Goog-FieldMask": fields },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!r.ok) throw new PlacesError("upstream", `Places API ${r.status}`);
  return ((await r.json()) as { places?: Hit[] }).places ?? [];
}

/** Landmarks chosen by hand where the automatic choice is not the city's emblem (searched by name). */
const PICKS: Record<string, string> = {
  cairo: "Pyramids of Giza",
  riyadh: "Kingdom Centre Tower Riyadh",
  lagos: "National Theatre Lagos",
  madrid: "Royal Palace of Madrid",
  dublin: "Trinity College Dublin",
  johannesburg: "Constitution Hill Johannesburg",
  rome: "Colosseum",
  miami: "South Beach Miami",
  "new york": "Empire State Building",
};

const box = (c: { lat: number; lon: number }, d: number) => ({ rectangle: { low: { latitude: c.lat - d, longitude: c.lon - d * 1.4 }, high: { latitude: c.lat + d, longitude: c.lon + d * 1.4 } } });

/**
 * The city's best-known landmark (cached by city): the city's centre is found first (the airport is often far
 * out: Narita, Incheon, Ben Gurion), then among the sights around that centre, the one with the most Google
 * reviews, those whose address names the city first (Notre-Dame de la Garde for Marseille, not a castle in
 * Provence). Hotels, shops, airports, zoos and theme parks are left out.
 */
async function landmarkOf(city: string, country: string, near: { lat: number; lon: number }, lang: string) {
  const k = `${city}|${country}`.toLowerCase();
  if (landmarks.has(k)) return landmarks.get(k)!;
  // the city itself, near the airport
  const town = (await searchText({ textQuery: city, includedType: "locality", languageCode: "en", locationBias: { circle: { center: { latitude: near.lat, longitude: near.lon }, radius: 50000 } }, pageSize: 1 }, "places.location").catch(() => []))[0]?.location;
  const centre = town ? { lat: town.latitude, lon: town.longitude } : near;
  const fields = "places.id,places.displayName,places.userRatingCount,places.types,places.formattedAddress,places.location,places.photos.name";
  // a landmark chosen by hand for this city
  const pick = PICKS[city.toLowerCase()];
  if (pick) {
    const p = (await searchText({ textQuery: pick, languageCode: lang, locationBias: { circle: { center: { latitude: centre.lat, longitude: centre.lon }, radius: 50000 } }, pageSize: 3 }, fields).catch(() => [])).find((x) => x.photos?.length);
    if (p) {
      const hit = { id: p.id, name: p.displayName?.text ?? pick };
      landmarks.set(k, hit);
      return hit;
    }
  }
  const around = (q: string) => searchText({ textQuery: q, languageCode: lang, locationRestriction: box(centre, town ? 0.18 : 0.32), pageSize: 20 }, fields).catch(() => [] as Hit[]);
  const found = [...(await around(`famous landmark ${city}`)), ...(await around(`monument ${city}`))];
  const NOT = ["airport", "lodging", "shopping_mall", "store", "restaurant", "stadium", "zoo", "amusement_park", "water_park", "casino", "aquarium"];
  const sights = found.filter((p) => p.photos?.length && !(p.types ?? []).some((t) => NOT.includes(t)));
  // in the city itself: within 10 km of its centre (an address says "Roma" for Rome, "Milano" for Milan), or,
  // when the centre is not known, an address that names the city
  const plain = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const km = (p: Hit) => (p.location ? Math.hypot((p.location.latitude - centre.lat) * 111, (p.location.longitude - centre.lon) * 111 * Math.cos((centre.lat * Math.PI) / 180)) : 99);
  const inCity = sights.filter((p) => (town ? km(p) <= 10 : plain(p.formattedAddress ?? "").includes(plain(city))));
  const best = (inCity.length ? inCity : sights).sort((a, b) => (b.userRatingCount ?? 0) - (a.userRatingCount ?? 0))[0];
  const hit = best ? { id: best.id, name: best.displayName?.text ?? city } : null;
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
