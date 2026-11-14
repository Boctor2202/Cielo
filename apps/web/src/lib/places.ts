/**
 * Things to do around the crew hotel, from the Google Places API (New), called live from the server.
 * Google's terms allow keeping place IDs only: ratings, names and opening hours are fetched on demand and
 * never stored. The API key stays on the server (GOOGLE_MAPS_API_KEY).
 */

export type PlaceCategory = "restaurants" | "bars" | "nightlife" | "cafes" | "beaches" | "culture" | "shows" | "cinema" | "parks" | "wellness" | "shopping";

/** Google place types (Table A) and search radius per category. */
export const CATEGORIES: Record<PlaceCategory, { types: string[]; radius: number }> = {
  restaurants: { types: ["restaurant"], radius: 2500 },
  bars: { types: ["bar", "wine_bar", "pub"], radius: 3000 },
  nightlife: { types: ["night_club"], radius: 6000 },
  cafes: { types: ["cafe", "coffee_shop", "bakery"], radius: 2000 },
  beaches: { types: ["beach"], radius: 25000 },
  culture: { types: ["museum", "art_gallery", "historical_landmark", "tourist_attraction"], radius: 8000 },
  shows: { types: ["performing_arts_theater", "concert_hall", "opera_house"], radius: 10000 },
  cinema: { types: ["movie_theater"], radius: 8000 },
  parks: { types: ["park", "botanical_garden"], radius: 5000 },
  wellness: { types: ["spa", "gym"], radius: 4000 },
  shopping: { types: ["shopping_mall", "market"], radius: 6000 },
};

export interface Place {
  id: string;
  name: string;
  type?: string;
  rating?: number;
  reviews?: number;
  /** rating corrected for the number of reviews, used for ranking */
  score: number;
  address?: string;
  lat: number;
  lng: number;
  distanceM: number;
  openNow?: boolean;
  priceLevel?: number;
  mapsUrl?: string;
}

const PRICE: Record<string, number> = { PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4 };

export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * A 4.9 from 8 reviews should not beat a 4.6 from 3,000: Bayesian average towards a prior of 4.0
 * worth 60 reviews.
 */
export const score = (rating = 0, reviews = 0) => (rating * reviews + 4.0 * 60) / (reviews + 60);

export class PlacesError extends Error {
  constructor(public code: "not_configured" | "upstream", message: string, public status = 502) {
    super(message);
  }
}

function key() {
  const k = process.env.GOOGLE_MAPS_API_KEY;
  if (!k) throw new PlacesError("not_configured", "GOOGLE_MAPS_API_KEY is not set", 503);
  return k;
}

async function call(path: string, body: unknown, fieldMask: string) {
  const r = await fetch(`https://places.googleapis.com/v1/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key(), "X-Goog-FieldMask": fieldMask },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!r.ok) throw new PlacesError("upstream", `Places API ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return (await r.json()) as { places?: GPlace[] };
}

interface GPlace {
  id: string;
  displayName?: { text: string };
  primaryTypeDisplayName?: { text: string };
  rating?: number;
  userRatingCount?: number;
  formattedAddress?: string;
  shortFormattedAddress?: string;
  location?: { latitude: number; longitude: number };
  googleMapsUri?: string;
  priceLevel?: string;
  currentOpeningHours?: { openNow?: boolean };
}

const NEARBY_FIELDS = [
  "places.id", "places.displayName", "places.primaryTypeDisplayName", "places.rating", "places.userRatingCount",
  "places.shortFormattedAddress", "places.location", "places.googleMapsUri", "places.priceLevel", "places.currentOpeningHours.openNow",
].join(",");

/** The best-rated places of a category around a point, ranked by corrected rating. */
export async function nearby(center: { lat: number; lng: number }, cat: PlaceCategory, lang: string): Promise<Place[]> {
  const c = CATEGORIES[cat];
  const res = await call(
    "places:searchNearby",
    {
      includedTypes: c.types,
      maxResultCount: 20,
      rankPreference: "POPULARITY",
      languageCode: lang,
      locationRestriction: { circle: { center: { latitude: center.lat, longitude: center.lng }, radius: c.radius } },
    },
    NEARBY_FIELDS,
  );
  const seen = new Set<string>();
  return (res.places ?? [])
    // Google sometimes returns the same place twice (also under two IDs with identical name and reviews)
    .filter((p) => {
      const k2 = `${p.displayName?.text}|${p.userRatingCount}`;
      if (!p.location || seen.has(p.id) || seen.has(k2)) return false;
      seen.add(p.id).add(k2);
      return true;
    })
    .map((p) => {
      const loc = { lat: p.location!.latitude, lng: p.location!.longitude };
      return {
        id: p.id,
        name: p.displayName?.text ?? "",
        type: p.primaryTypeDisplayName?.text,
        rating: p.rating,
        reviews: p.userRatingCount,
        score: score(p.rating, p.userRatingCount),
        address: p.shortFormattedAddress,
        ...loc,
        distanceM: Math.round(distanceM(center, loc)),
        openNow: p.currentOpeningHours?.openNow,
        priceLevel: p.priceLevel ? PRICE[p.priceLevel] : undefined,
        mapsUrl: p.googleMapsUri,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export interface HotelHit {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  rating?: number;
  reviews?: number;
  distanceM?: number;
  lat: number;
  lng: number;
}

const HOTEL_FIELDS = "places.id,places.displayName,places.formattedAddress,places.location,places.internationalPhoneNumber,places.rating,places.userRatingCount";
const toHotel = (p: GPlace & { internationalPhoneNumber?: string }, from?: { lat: number; lng: number }): HotelHit => {
  const loc = { lat: p.location!.latitude, lng: p.location!.longitude };
  return {
    id: p.id,
    name: p.displayName?.text ?? "",
    address: p.formattedAddress,
    phone: p.internationalPhoneNumber,
    rating: p.rating,
    reviews: p.userRatingCount,
    distanceM: from ? Math.round(distanceM(from, loc)) : undefined,
    ...loc,
  };
};

/** Hotels around the layover airport, most popular first: the list shown before the pilot types anything. */
export async function hotelsNear(center: { lat: number; lng: number }, lang: string): Promise<HotelHit[]> {
  const res = await call(
    "places:searchNearby",
    {
      includedTypes: ["lodging"],
      maxResultCount: 20,
      rankPreference: "POPULARITY",
      languageCode: lang,
      locationRestriction: { circle: { center: { latitude: center.lat, longitude: center.lng }, radius: 15000 } },
    },
    HOTEL_FIELDS,
  );
  return (res.places ?? []).filter((p) => p.location).map((p) => toHotel(p, center));
}

/** Hotel search by name, biased towards the layover airport. */
export async function findHotel(query: string, near: { lat: number; lng: number } | null, lang: string): Promise<HotelHit[]> {
  const res = await call(
    "places:searchText",
    {
      textQuery: query,
      includedType: "lodging",
      languageCode: lang,
      maxResultCount: 8,
      ...(near ? { locationBias: { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 40000 } } } : {}),
    },
    HOTEL_FIELDS,
  );
  return (res.places ?? []).filter((p) => p.location).map((p) => toHotel(p, near ?? undefined));
}

/** Location of a saved hotel (place ID only is stored, per Google's terms). */
export async function hotelById(id: string, lang: string): Promise<HotelHit> {
  const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?languageCode=${lang}`, {
    headers: { "X-Goog-Api-Key": key(), "X-Goog-FieldMask": "id,displayName,formattedAddress,location" },
    cache: "no-store",
  });
  if (!r.ok) throw new PlacesError("upstream", `Places API ${r.status}`);
  const p = (await r.json()) as GPlace;
  return { id: p.id, name: p.displayName?.text ?? "", address: p.formattedAddress, lat: p.location?.latitude ?? 0, lng: p.location?.longitude ?? 0 };
}

/* ---------- light abuse protection for the public routes (each call costs money) ---------- */
const hits = new Map<string, { n: number; reset: number }>();
export function rateLimited(ip: string, max = 40, windowMs = 60_000) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) {
    hits.set(ip, { n: 1, reset: now + windowMs });
    return false;
  }
  h.n++;
  return h.n > max;
}
