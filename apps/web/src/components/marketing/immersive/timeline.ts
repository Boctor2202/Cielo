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

/** Shared, mutable readouts the DOM HUD reads every frame (no React re-render). */
export interface Readouts {
  progress: number;
  sunElevation: number;
  utcMinutes: number;
  nightMinutes: number;
  chapter: number;
}

export const createReadouts = (): Readouts => ({ progress: 0, sunElevation: 6, utcMinutes: 1120, nightMinutes: 0, chapter: 0 });

/** Sun elevation (degrees) along the scroll: the sunset crosses the EASA −6° threshold around p = 0.30. */
export const SUN_ELEV: Key<number>[] = [[0, 6.5], [0.14, 3.5], [0.36, -9.5], [0.5, -15], [1, -15]];

/** Story chapters as scroll-progress bounds: hero, EASA night, your aircraft, routes (globe), call to action. */
export const CHAPTERS = [0, 0.2, 0.42, 0.62, 0.84, 1] as const;

/** Same mapping the scene uses, so the HUD can run even without WebGL. */
export function readoutsAt(p: number, r: Readouts) {
  const el = num(SUN_ELEV, p);
  r.progress = p;
  r.sunElevation = el;
  r.utcMinutes = 1120 + ((6.5 - el) / 21.5) * 95;
  r.nightMinutes = Math.max(0, r.utcMinutes - (1120 + (12.5 / 21.5) * 95));
  r.chapter = Math.max(0, CHAPTERS.findIndex((b) => p < b) - 1);
  if (p >= 1) r.chapter = CHAPTERS.length - 2;
}
