/**
 * Scroll timeline: every animated value is a list of [progress, value] keys interpolated with smoothstep,
 * so a scene state is a pure function of scroll progress (scrubbable both ways, no state machine).
 */

export type Key<T> = [number, T];

const ease = (t: number) => t * t * (3 - 2 * t);
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const smooth = (a: number, b: number, v: number) => ease(clamp01((v - a) / (b - a)));

function segment<T>(keys: Key<T>[], p: number): [T, T, number] {
  if (p <= keys[0]![0]) return [keys[0]![1], keys[0]![1], 0];
  for (let i = 1; i < keys.length; i++) {
    const [p1, v1] = keys[i]!;
    if (p <= p1) {
      const [p0, v0] = keys[i - 1]!;
      return [v0, v1, ease((p - p0) / (p1 - p0 || 1))];
    }
  }
  const last = keys[keys.length - 1]![1];
  return [last, last, 0];
}

export function num(keys: Key<number>[], p: number): number {
  const [a, b, t] = segment(keys, p);
  return a + (b - a) * t;
}

export function vec(keys: Key<[number, number, number]>[], p: number): [number, number, number] {
  const [a, b, t] = segment(keys, p);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * The film, in scroll order. `from`/`to` are scroll progress; `start`/`end` the part of each clip played
 * (fractions of its duration). The clouds clip is cut before the jet comes out on top of the layer.
 */
export const SHOTS = {
  takeoff: { from: 0, to: 0.38, start: 0, end: 1 },
  gear: { from: 0.38, to: 0.5, start: 0, end: 1 },
  clouds: { from: 0.5, to: 0.57, start: 0, end: 1 },
} as const;

/** Scroll progress where the Earth takes over. */
export const GLOBE_FROM = 0.59;

export type Phase = "lineup" | "roll" | "rotate" | "gearUp" | "climb" | "cruise";

/** Shared, mutable readouts the DOM HUD reads every frame (no React re-render). */
export interface Readouts {
  progress: number;
  sunElevation: number;
  utcMinutes: number;
  nightMinutes: number;
  chapter: number;
  phase: Phase;
  ias: number;
  altitudeFt: number;
}

export const createReadouts = (): Readouts => ({
  progress: 0, sunElevation: -7, utcMinutes: 312, nightMinutes: 0, chapter: 0, phase: "lineup", ias: 0, altitudeFt: 0,
});

/** Sunrise: the sun climbs through the EASA −6° threshold (end of night) during the takeoff roll. */
export const SUN_ELEV: Key<number>[] = [[0, -7], [0.38, -5.4], [0.59, -2.5], [1, 1.5]];

/** Story chapters as scroll-progress bounds: lined up, takeoff (night), your aircraft, routes (globe), ready. */
export const CHAPTERS = [0, 0.2, 0.4, 0.6, 0.8, 1] as const;

const START_UTC = 312; // 05:12Z
const NIGHT_END = 0.22; // where SUN_ELEV crosses −6°

/** Same mapping the scene uses, so the HUD runs even without WebGL. */
export function readoutsAt(p: number, r: Readouts, film?: { rotate: number; liftoff: number }) {
  const el = num(SUN_ELEV, p);
  r.progress = p;
  r.sunElevation = el;
  r.utcMinutes = START_UTC + p * 28;
  r.nightMinutes = Math.min(p, NIGHT_END) * 28;
  r.chapter = Math.max(0, CHAPTERS.findIndex((b) => p < b) - 1);
  if (p >= 1) r.chapter = CHAPTERS.length - 2;

  // takeoff clip: lined up, roll (speed builds up with the scroll), rotation at VR, lift-off
  const rot = film?.rotate ?? 0.55;
  const lof = film?.liftoff ?? 0.64;
  const k = clamp01(p / SHOTS.takeoff.to);
  const VR = 128;
  if (p < SHOTS.takeoff.to) {
    if (k < 0.06) {
      r.phase = "lineup";
      r.ias = 0;
    } else {
      const roll = clamp01((k - 0.06) / (rot - 0.06));
      r.ias = k < rot ? 30 + Math.pow(roll, 1.25) * (VR - 30) : VR + ((k - rot) / (1 - rot)) * 14;
      if (k < 0.12) r.ias *= (k - 0.06) / 0.06;
      r.phase = k < rot ? "roll" : "rotate";
    }
    r.altitudeFt = k < lof ? 0 : ((k - lof) / (1 - lof)) * 120;
    return;
  }
  if (p < SHOTS.gear.to) {
    const g = (p - SHOTS.gear.from) / (SHOTS.gear.to - SHOTS.gear.from);
    r.phase = "gearUp";
    r.ias = 142 + g * 18;
    r.altitudeFt = 120 + g * 600;
    return;
  }
  if (p < GLOBE_FROM) {
    const c = (p - SHOTS.gear.to) / (GLOBE_FROM - SHOTS.gear.to);
    r.phase = "climb";
    r.ias = 160 + c * 90;
    r.altitudeFt = 720 + c * 7300;
    return;
  }
  const c = clamp01((p - GLOBE_FROM) / 0.18);
  r.phase = c < 1 ? "climb" : "cruise";
  r.ias = 250 + c * 30;
  r.altitudeFt = 8000 + c * 37000;
}
