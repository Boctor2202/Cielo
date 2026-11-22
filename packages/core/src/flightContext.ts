import type { TrackPoint } from "./types";

/**
 * What a logged flight went through, from its track: the airspaces crossed (openAIP data) and the wind and
 * temperature met at cruise level (forecast model). Information for the pilot's record, not for navigation.
 */

/** An airspace as the server passes it on (openAIP, simplified). Limits in feet (FL × 100, metres converted). */
export interface Airspace {
  id: string;
  name: string;
  /** CTR, TMA, CTA, ATZ, R, P, D, TMZ, RMZ, TRA, TSA, FIR, UIR or OTHER */
  type: string;
  /** ICAO class A to G, when it has one */
  icaoClass?: string;
  lowerFt: number;
  upperFt: number;
  /** "0" when the limit is above the ground (AGL) rather than the sea or the standard pressure */
  lowerRef?: "GND" | "MSL" | "STD";
  upperRef?: "GND" | "MSL" | "STD";
  /** outer rings of the polygons, [lon, lat] */
  rings: [number, number][][];
  frequencies?: { name?: string; mhz: string }[];
}

export interface CrossedAirspace extends Omit<Airspace, "rings"> {
  /** first and last time inside (unix seconds) */
  from: number;
  to: number;
}

/** Ray casting: is [lon, lat] inside the ring? */
export function inRing(lon: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-12) + xi) inside = !inside;
  }
  return inside;
}

/**
 * The airspaces the track went through, in the order it entered them. A point counts when it is inside the
 * polygon and between the vertical limits (ground-referenced limits are read as above sea level: the terrain
 * is not known, which is close enough for a record). Points are interpolated so short crossings are not missed.
 */
export function airspacesCrossed(points: TrackPoint[], airspaces: Airspace[]): CrossedAirspace[] {
  const pts = densify(points, 60);
  const seen = new Map<string, CrossedAirspace>();
  // a quick box per airspace, to skip most polygons
  const boxes = airspaces.map((a) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const r of a.rings) for (const [x, y] of r) (minX = Math.min(minX, x)), (maxX = Math.max(maxX, x)), (minY = Math.min(minY, y)), (maxY = Math.max(maxY, y));
    return { a, minX, minY, maxX, maxY };
  });
  for (const [t, lat, lon, alt] of pts) {
    const ft = alt ?? 0;
    for (const { a, minX, minY, maxX, maxY } of boxes) {
      if (lon < minX || lon > maxX || lat < minY || lat > maxY) continue;
      if (ft < a.lowerFt - 50 || ft > a.upperFt + 50) continue;
      if (!a.rings.some((r) => inRing(lon, lat, r))) continue;
      const s = seen.get(a.id);
      if (s) s.to = t;
      else {
        const { rings: _rings, ...rest } = a;
        seen.set(a.id, { ...rest, from: t, to: t });
      }
    }
  }
  return [...seen.values()].sort((x, y) => x.from - y.from);
}

/** Extra points so that consecutive ones are at most `maxGapS` seconds apart. */
function densify(points: TrackPoint[], maxGapS: number): TrackPoint[] {
  const out: TrackPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const q = points[i + 1];
    out.push(p);
    if (!q) break;
    const n = Math.floor((q[0] - p[0]) / maxGapS);
    for (let k = 1; k < n && k < 120; k++) {
      const f = k / n;
      out.push([p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, p[2] + (q[2] - p[2]) * f, p[3] != null && q[3] != null ? p[3] + (q[3] - p[3]) * f : p[3], null]);
    }
  }
  return out;
}

/** Initial great-circle bearing from a to b, degrees true. */
export function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const y = Math.sin((lon2 - lon1) * r) * Math.cos(lat2 * r);
  const x = Math.cos(lat1 * r) * Math.sin(lat2 * r) - Math.sin(lat1 * r) * Math.cos(lat2 * r) * Math.cos((lon2 - lon1) * r);
  return ((Math.atan2(y, x) / r) % 360 + 360) % 360;
}

export interface CruiseSample {
  /** unix seconds */
  t: number;
  lat: number;
  lon: number;
  altFt: number;
  /** track over the ground, degrees true */
  trackDeg: number;
}

/**
 * The middle of the cruise: the longest stretch flown within 1 500 ft of the highest altitude reached.
 * null for a track too short or without altitudes.
 */
export function cruiseSample(points: TrackPoint[]): CruiseSample | null {
  const withAlt = points.filter((p) => p[3] != null);
  if (withAlt.length < 3) return null;
  const top = Math.max(...withAlt.map((p) => p[3]!));
  let best: [number, number] | null = null;
  let start = -1;
  for (let i = 0; i <= points.length; i++) {
    const high = i < points.length && (points[i]![3] ?? -1e9) >= top - 1500;
    if (high && start < 0) start = i;
    if (!high && start >= 0) {
      if (!best || points[i - 1]![0] - points[start]![0] > points[best[1]]![0] - points[best[0]]![0]) best = [start, i - 1];
      start = -1;
    }
  }
  if (!best) return null;
  const mid = Math.round((best[0] + best[1]) / 2);
  const a = points[Math.max(0, Math.min(mid - 2, best[0]))] ?? points[Math.max(0, mid - 1)]!;
  const b = points[Math.min(points.length - 1, Math.max(mid + 2, best[1]))] ?? points[mid]!;
  const p = points[mid]!;
  const from = a === b ? points[Math.max(0, mid - 1)]! : a;
  const to = a === b ? points[Math.min(points.length - 1, mid + 1)]! : b;
  return { t: p[0], lat: p[1], lon: p[2], altFt: p[3] ?? top, trackDeg: Math.round(bearing(from[1], from[2], to[1], to[2])) };
}

/** Pressure (hPa) at a pressure altitude in feet, standard atmosphere (troposphere, held above it). */
export function pressureAt(altFt: number): number {
  const h = Math.min(altFt, 36089);
  const p = 1013.25 * Math.pow(1 - 6.8755856e-6 * h, 5.25588);
  return altFt > 36089 ? p * Math.exp((-4.806346e-5) * (altFt - 36089)) : p;
}

/** The forecast model's pressure levels (hPa). */
export const PRESSURE_LEVELS = [1000, 975, 950, 925, 900, 850, 800, 700, 600, 500, 400, 300, 250, 200, 150, 100] as const;

export const nearestLevel = (hPa: number) => PRESSURE_LEVELS.reduce((b, l) => (Math.abs(l - hPa) < Math.abs(b - hPa) ? l : b), PRESSURE_LEVELS[0] as number);

/** Head (+) / tail (−) and cross (+ from the right) wind components, knots, for a wind blowing FROM `windFrom`. */
export function windComponents(windFrom: number, windKt: number, trackDeg: number): { head: number; cross: number } {
  const a = ((windFrom - trackDeg) * Math.PI) / 180;
  return { head: Math.round(windKt * Math.cos(a)), cross: Math.round(windKt * Math.sin(a)) };
}
