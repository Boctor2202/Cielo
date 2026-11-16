/**
 * Runways in use, seen from the live traffic: an aircraft aligned with a runway, short of its threshold,
 * low and descending is landing on it; aligned, past the runway and climbing, it has taken off from it.
 * Observations are kept over a sliding window, so arrivals and departures can show different runways.
 */

export interface RunwayThreshold {
  ident: string;
  headingTrue: number;
  lengthFt: number;
  lat: number;
  lon: number;
}

export interface TrafficPoint {
  hex: string;
  lat: number;
  lon: number;
  /** barometric altitude, ft, or "ground" */
  alt: number | "ground" | null | undefined;
  gs?: number | null;
  trk?: number | null;
  /** vertical rate, ft/min */
  vr?: number | null;
}

export type RunwayUseKind = "arr" | "dep";

const FT_PER_NM = 6076.12;
const angleDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

/** Landing on / taking off from one of these runway ends, or null. */
export function classifyRunwayUse(ac: TrafficPoint, elevationFt: number, ends: RunwayThreshold[]): { ident: string; kind: RunwayUseKind } | null {
  if (typeof ac.alt !== "number" || ac.trk == null) return null;
  const agl = ac.alt - elevationFt;
  if (agl > 5000 || (ac.gs != null && ac.gs > 250)) return null;
  let best: { ident: string; kind: RunwayUseKind; cross: number } | null = null;
  for (const e of ends) {
    if (angleDiff(ac.trk, e.headingTrue) > 15) continue;
    const k = Math.cos((e.lat * Math.PI) / 180);
    const dx = (ac.lon - e.lon) * 60 * k;
    const dy = (ac.lat - e.lat) * 60;
    const h = (e.headingTrue * Math.PI) / 180;
    const along = dx * Math.sin(h) + dy * Math.cos(h);
    const cross = Math.abs(dx * Math.cos(h) - dy * Math.sin(h));
    const len = e.lengthFt / FT_PER_NM;
    let kind: RunwayUseKind | null = null;
    // final approach: within 12 NM short of the threshold, near the centreline, under a ~3.5° slope
    if (along >= -12 && along <= 0.3 && cross <= 0.5 + 0.06 * -along && agl <= Math.min(4000, 400 + 370 * -along) && (ac.vr == null || ac.vr <= 200)) kind = "arr";
    // initial climb: past the middle of the runway, up to 10 NM beyond, climbing
    else if (along >= len * 0.5 && along <= len + 10 && cross <= 0.6 + 0.08 * Math.max(0, along - len) && agl <= Math.min(5000, 600 + 500 * Math.max(0, along - len * 0.5)) && ac.vr != null && ac.vr >= 300) kind = "dep";
    if (kind && (!best || cross < best.cross)) best = { ident: e.ident, kind, cross };
  }
  return best ? { ident: best.ident, kind: best.kind } : null;
}

export interface RunwayUseEntry {
  ident: string;
  /** distinct aircraft seen in the window */
  count: number;
  /** last observation, ms */
  lastAt: number;
}

export interface RunwayUseSummary {
  arr: RunwayUseEntry[];
  dep: RunwayUseEntry[];
}

/** Accumulates observations per aerodrome; each aircraft counts once per aerodrome and direction. */
export class RunwayUseTracker {
  private seen = new Map<string, Map<string, { kind: RunwayUseKind; ident: string; at: number }>>();
  constructor(private windowMs = 20 * 60_000) {}

  observe(icao: string, hex: string, use: { ident: string; kind: RunwayUseKind }, now = Date.now()) {
    let m = this.seen.get(icao);
    if (!m) this.seen.set(icao, (m = new Map()));
    m.set(`${use.kind}|${hex}`, { ...use, at: now });
  }

  /** Runways used in the window, most used first; a runway is listed from a quarter of the movements. */
  summary(icao: string, now = Date.now()): RunwayUseSummary | null {
    const m = this.seen.get(icao);
    if (!m) return null;
    const out: RunwayUseSummary = { arr: [], dep: [] };
    for (const kind of ["arr", "dep"] as const) {
      const by = new Map<string, RunwayUseEntry>();
      for (const [k, v] of m) {
        if (now - v.at > this.windowMs) {
          m.delete(k);
          continue;
        }
        if (v.kind !== kind) continue;
        const e = by.get(v.ident) ?? { ident: v.ident, count: 0, lastAt: 0 };
        e.count++;
        e.lastAt = Math.max(e.lastAt, v.at);
        by.set(v.ident, e);
      }
      const list = [...by.values()].sort((a, b) => b.count - a.count || b.lastAt - a.lastAt);
      const total = list.reduce((s, e) => s + e.count, 0);
      out[kind] = list.filter((e, i) => i === 0 || e.count / total >= 0.25);
    }
    return out.arr.length || out.dep.length ? out : null;
  }
}

/** "↓27R/26L ↑26R" — empty when nothing was seen. */
export function runwayUseLabel(s: RunwayUseSummary | null): string {
  if (!s) return "";
  const part = (arrow: string, l: RunwayUseEntry[]) => (l.length ? `${arrow}${l.map((e) => e.ident).join("/")}` : "");
  return [part("↓", s.arr), part("↑", s.dep)].filter(Boolean).join(" ");
}
