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
 * The film, in scroll order. `from`/`to` are scroll progress. Landing at dusk: the descent over a sea of
 * clouds into the layer, then breaking out on final with the runway ahead and the gear coming down.
 */
export const SHOTS = {
  descent: { from: 0, to: 0.3 },
  final: { from: 0.3, to: 0.57 },
} as const;

/** Scroll progress where the Earth takes over. */
export const GLOBE_FROM = 0.59;

export type Phase = "descent" | "approach" | "gearDown" | "logged";

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
  progress: 0, sunElevation: 1, utcMinutes: START_UTC, nightMinutes: 0, chapter: 0, phase: "descent", ias: 280, altitudeFt: 14000,
});

/** Dusk: the sun sinks through the EASA −6° threshold (start of night) on final approach. */
export const SUN_ELEV: Key<number>[] = [[0, 1], [0.2, -3], [0.36, -6.5], [0.57, -9], [1, -12]];

/** Story chapters as scroll-progress bounds: descent, approach (night), your aircraft, routes (globe), ready. */
export const CHAPTERS = [0, 0.2, 0.4, 0.6, 0.8, 1] as const;

const START_UTC = 1052; // 17:32Z
const NIGHT_START = 0.323; // where SUN_ELEV crosses −6°

/** Same mapping the scene uses, so the HUD runs even without WebGL. */
export function readoutsAt(p: number, r: Readouts) {
  const el = num(SUN_ELEV, p);
  r.progress = p;
  r.sunElevation = el;
  r.utcMinutes = START_UTC + p * 28;
  r.nightMinutes = Math.max(0, Math.min(p, SHOTS.final.to) - NIGHT_START) * 28;
  r.chapter = Math.max(0, CHAPTERS.findIndex((b) => p < b) - 1);
  if (p >= 1) r.chapter = CHAPTERS.length - 2;

  if (p < SHOTS.descent.to) {
    const k = p / SHOTS.descent.to;
    r.phase = "descent";
    r.ias = 280 - k * 60;
    r.altitudeFt = 14000 - k * 9000;
    return;
  }
  if (p < GLOBE_FROM) {
    const k = clamp01((p - SHOTS.final.from) / (SHOTS.final.to - SHOTS.final.from));
    r.phase = k < 0.55 ? "approach" : "gearDown";
    r.ias = 180 - k * 50;
    r.altitudeFt = 3000 - k * 2500;
    return;
  }
  r.phase = "logged";
  r.ias = 0;
  r.altitudeFt = 0;
}
