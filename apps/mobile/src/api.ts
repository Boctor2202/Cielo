/**
 * The Geardown web services, shared with the web app (Google Places, Ticketmaster, adsb.lol run server-side,
 * so no key ships in the app).
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "https://cielo-ecru.vercel.app").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

export async function api<T>(path: string): Promise<T> {
  const r = await fetch(`${API_URL}${path}`, { headers: { Accept: "application/json" } });
  const d = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new ApiError(d.error ?? "upstream", r.status);
  return d;
}

export type PlaceCategory = "restaurants" | "bars" | "nightlife" | "cafes" | "beaches" | "culture" | "shows" | "cinema" | "parks" | "wellness" | "shopping";
export const PLACE_CATEGORIES: PlaceCategory[] = ["restaurants", "bars", "nightlife", "cafes", "beaches", "culture", "shows", "cinema", "parks", "wellness", "shopping"];

export interface Place {
  id: string;
  name: string;
  type?: string;
  rating?: number;
  reviews?: number;
  score: number;
  address?: string;
  lat: number;
  lng: number;
  distanceM: number;
  openNow?: boolean;
  priceLevel?: number;
  mapsUrl?: string;
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
export interface LiveEvent {
  id: string;
  name: string;
  date: string;
  time?: string;
  venue?: string;
  city?: string;
  distanceM?: number;
  genre?: string;
  segment?: string;
  priceFrom?: number;
  currency?: string;
  image?: string;
  url?: string;
}
export interface LiveAircraft {
  hex: string;
  r?: string;
  t?: string;
  cs?: string;
  lat: number;
  lon: number;
  alt?: number | "ground";
  gs?: number;
  trk?: number;
  vr?: number;
  sq?: string;
}
export interface Track {
  hex: string;
  r?: string;
  t?: string;
  desc?: string;
  legs: [number, number, number, number | null, number | null][][];
}

export const fmtDistance = (m?: number) => (m == null ? "" : m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`);
