/**
 * "I'm flying now": a flight logged as it happens. Each tap stamps the next step in UTC (off-block, take-off,
 * landing, on-block); the airports come from the phone's position at off-block and on-block. Kept on the phone
 * until the pilot saves the flight, so closing the app or restarting the phone loses nothing.
 */

export type LiveStep = "out" | "off" | "on" | "in";
export const LIVE_STEPS: LiveStep[] = ["out", "off", "on", "in"];

export interface LiveFlight {
  startedAt: string;
  out?: string;
  off?: string;
  on?: string;
  in?: string;
  depIcao?: string;
  /** where the departure came from */
  depFrom?: "gps" | "roster" | "last";
  arrIcao?: string;
  arrFrom?: "gps" | "roster";
  aircraftId?: string | null;
  registration?: string;
  aircraftTypeIcao?: string;
  flightNumber?: string;
  rosterEventId?: string;
  /** landings noted and flown again (touch-and-go, go-around after a landing tap) */
  touchAndGos?: number;
}

/** The step the next tap stamps (undefined once on-block is stamped). */
export const nextStep = (f: LiveFlight): LiveStep | undefined => LIVE_STEPS.find((s) => !f[s]);

/** Stamps the next step at `at` (never before the previous one). */
export function stampStep(f: LiveFlight, at: Date): LiveFlight {
  const s = nextStep(f);
  if (!s) return f;
  const prev = LIVE_STEPS.slice(0, LIVE_STEPS.indexOf(s)).map((k) => f[k]).filter(Boolean).pop();
  const iso = new Date(Math.max(at.getTime(), prev ? Date.parse(prev) : 0)).toISOString();
  return { ...f, [s]: iso };
}

/** The last stamped step moved by `minutes` (−1 for a tap made late), kept after the step before it. */
export function shiftLast(f: LiveFlight, minutes: number): LiveFlight {
  const done = LIVE_STEPS.filter((s) => f[s]);
  const s = done[done.length - 1];
  if (!s) return f;
  const before = done[done.length - 2];
  const t = Date.parse(f[s]!) + minutes * 60_000;
  if (before && t < Date.parse(f[before]!)) return f;
  return { ...f, [s]: new Date(t).toISOString() };
}

/** A step set to a clock time "HH:MM" UTC, on the day that keeps the steps in order (a flight past midnight). */
export function setStepClock(f: LiveFlight, step: LiveStep, hhmm: string): LiveFlight {
  const m = hhmm.match(/^([01]\d|2[0-3]):?([0-5]\d)$/);
  if (!m) return f;
  const i = LIVE_STEPS.indexOf(step);
  const ref = LIVE_STEPS.slice(0, i).map((k) => f[k]).filter(Boolean).pop() ?? f[step] ?? f.startedAt;
  const d = new Date(ref);
  d.setUTCHours(Number(m[1]), Number(m[2]), 0, 0);
  // before the previous step: the next day
  if (i > 0 && d.getTime() < Date.parse(ref)) d.setUTCDate(d.getUTCDate() + 1);
  return { ...f, [step]: d.toISOString() };
}

/** Go-around or touch-and-go after a landing tap: the landing is taken back and counted as a touch-and-go. */
export function goAround(f: LiveFlight): LiveFlight {
  if (!f.on || f.in) return f;
  const { on: _on, ...rest } = f;
  return { ...rest, touchAndGos: (f.touchAndGos ?? 0) + 1 };
}

/** Minutes between two stamps (or until `now` when the second is not stamped yet). */
export function liveMinutes(from: string | undefined, to: string | undefined, now: Date): number {
  if (!from) return 0;
  return Math.max(0, Math.floor(((to ? Date.parse(to) : now.getTime()) - Date.parse(from)) / 60_000));
}

/** Distance in km on the sphere. */
function km(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const r = (x: number) => (x * Math.PI) / 180;
  const dLat = r(bLat - aLat);
  const dLon = r(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/**
 * The airport the phone is at: the nearest with an ICAO code within `maxKm` (a large airport's terminal can be
 * 3–4 km from its reference point). Undefined in the middle of nowhere.
 */
export function nearestAirport<A extends { icao: string; lat: number; lon: number; size?: number }>(list: A[], lat: number, lon: number, maxKm = 6): A | undefined {
  let best: A | undefined;
  let bestD = maxKm;
  for (const a of list) {
    if (Math.abs(a.lat - lat) > maxKm / 111 + 0.01 || !/^[A-Z]{4}$/.test(a.icao)) continue;
    const d = km(lat, lon, a.lat, a.lon);
    // a small field next to an airport does not win over it at about the same distance
    const w = d + (a.size === 3 ? 0 : a.size === 2 ? 0.5 : 2);
    if (w < bestD) {
      best = a;
      bestD = w;
    }
  }
  return best;
}
