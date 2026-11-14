/**
 * Live aircraft and tracks from adsb.lol (community ADS-B network, data under ODbL 1.0).
 * Called server-side only: the API sends no CORS headers. Unkeyed calls are limited to 500/day per IP,
 * so set ADSBLOL_API_KEY (sent as x-api-key) in production; responses are cached briefly in memory
 * and at the CDN (the client rounds its query so many viewers share one upstream call).
 */

const BASE = "https://api.adsb.lol";

export class AdsbError extends Error {
  constructor(public code: "quota" | "upstream" | "not_found", message: string, public status = 502) {
    super(message);
  }
}

/** Aircraft as sent to the browser (short keys: hundreds per response). */
export interface LiveAircraft {
  hex: string;
  /** registration */
  r?: string;
  /** ICAO type designator */
  t?: string;
  /** callsign */
  cs?: string;
  lat: number;
  lon: number;
  /** barometric altitude in ft, or "ground" */
  alt?: number | "ground";
  /** ground speed (kt) */
  gs?: number;
  /** track (°) */
  trk?: number;
  /** vertical rate (ft/min) */
  vr?: number;
  sq?: string;
  cat?: string;
}

interface RawAircraft {
  hex: string;
  flight?: string;
  r?: string;
  t?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | "ground";
  gs?: number;
  track?: number;
  true_heading?: number;
  baro_rate?: number;
  geom_rate?: number;
  squawk?: string;
  category?: string;
  seen_pos?: number;
}

const cache = new Map<string, { at: number; value: unknown }>();

async function get<T>(path: string, ttlMs: number): Promise<T> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.ADSBLOL_API_KEY) headers["x-api-key"] = process.env.ADSBLOL_API_KEY;
  const r = await fetch(`${BASE}${path}`, { headers, cache: "no-store" });
  if (r.status === 429) throw new AdsbError("quota", "adsb.lol quota reached", 429);
  if (r.status === 404) throw new AdsbError("not_found", "not found", 404);
  if (!r.ok) throw new AdsbError("upstream", `adsb.lol ${r.status}`);
  const value = (await r.json()) as T;
  cache.set(path, { at: Date.now(), value });
  if (cache.size > 500) for (const [k, v] of cache) if (Date.now() - v.at > 300_000) cache.delete(k);
  return value;
}

const slim = (a: RawAircraft): LiveAircraft | null =>
  a.lat == null || a.lon == null || (a.seen_pos ?? 0) > 60
    ? null
    : {
        hex: a.hex,
        r: a.r || undefined,
        t: a.t || undefined,
        cs: a.flight?.trim() || undefined,
        lat: a.lat,
        lon: a.lon,
        alt: a.alt_baro,
        gs: a.gs != null ? Math.round(a.gs) : undefined,
        trk: Math.round(a.track ?? a.true_heading ?? 0),
        vr: a.baro_rate ?? a.geom_rate,
        sq: a.squawk,
        cat: a.category,
      };

/** Aircraft within `radiusNm` (≤ 250) of a point. */
export async function aircraftNear(lat: number, lon: number, radiusNm: number): Promise<LiveAircraft[]> {
  const d = await get<{ ac?: RawAircraft[] }>(`/v2/point/${lat}/${lon}/${Math.min(250, Math.max(5, Math.round(radiusNm)))}`, 8_000);
  return (d.ac ?? []).flatMap((a) => slim(a) ?? []);
}

/** Aircraft currently transmitting with this registration (usually 0 or 1). */
export async function aircraftByRegistration(reg: string): Promise<LiveAircraft[]> {
  const d = await get<{ ac?: RawAircraft[] }>(`/v2/reg/${encodeURIComponent(reg.toUpperCase())}`, 8_000);
  return (d.ac ?? []).flatMap((a) => slim(a) ?? []);
}

/** A point of a track: [unix seconds, lat, lon, altitude ft or null on the ground, ground speed kt or null]. */
export type TrackPoint = [number, number, number, number | null, number | null];

export interface Track {
  hex: string;
  r?: string;
  t?: string;
  desc?: string;
  /** flights of the stored period (readsb starts a new leg after a landing or a long gap), oldest first */
  legs: TrackPoint[][];
}

/**
 * The stored track of one aircraft (about the last 24 h), from /1/trace/full, split into legs.
 * readsb trace rows: [seconds after timestamp, lat, lon, alt | "ground" | null, gs, track, flags, …];
 * flag bit 1 = stale position, bit 2 = start of a new leg.
 */
export async function trackOf(hex: string): Promise<Track> {
  const d = await get<{ icao: string; r?: string; t?: string; desc?: string; timestamp: number; trace: unknown[][] }>(`/1/trace/full/${hex.toLowerCase()}`, 60_000);
  const legs: TrackPoint[][] = [];
  let leg: TrackPoint[] = [];
  for (const row of d.trace ?? []) {
    const [dt, lat, lon, alt, gs, , flags] = row as [number, number, number, number | "ground" | null, number | null, number | null, number];
    if (typeof lat !== "number" || typeof lon !== "number") continue;
    if (flags & 2 && leg.length) {
      legs.push(leg);
      leg = [];
    }
    if (flags & 1) continue;
    leg.push([Math.round(d.timestamp + dt), Math.round(lat * 1e5) / 1e5, Math.round(lon * 1e5) / 1e5, typeof alt === "number" ? alt : null, gs == null ? null : Math.round(gs)]);
  }
  if (leg.length) legs.push(leg);
  return { hex: d.icao, r: d.r, t: d.t, desc: d.desc, legs: legs.filter((l) => l.length > 1) };
}
