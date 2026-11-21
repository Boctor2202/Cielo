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
 * The film, in scroll order. `from`/`to` are scroll progress. A summer midday arrival: final approach with the
 * gear coming down, touchdown, then the aircraft leaves the runway and taxis to its gate.
 */
export const SHOTS = {
  approach: { from: 0, to: 0.22 },
  touchdown: { from: 0.22, to: 0.4 },
  taxi: { from: 0.4, to: 0.57 },
} as const;

/** Scroll progress where the Earth takes over. */
export const GLOBE_FROM = 0.59;

/** Main wheels on the runway (in the touchdown shot) and parked at the gate (end of the taxi shot). */
export const TOUCHDOWN_AT = SHOTS.touchdown.from + 0.25 * (SHOTS.touchdown.to - SHOTS.touchdown.from);
export const ON_BLOCK_AT = SHOTS.taxi.to - 0.01;

export type Phase = "approach" | "gearDown" | "touchdown" | "taxi" | "logged";

/** Shared, mutable readouts the DOM HUD reads every frame (no React re-render). */
export interface Readouts {
  progress: number;
  utcMinutes: number;
  chapter: number;
  phase: Phase;
  /** knots: indicated airspeed in flight, ground speed on the ground */
  speed: number;
  altitudeFt: number;
}

export const createReadouts = (): Readouts => ({
  progress: 0, utcMinutes: START_UTC, chapter: 0, phase: "approach", speed: 140, altitudeFt: 1500,
});

/** Story chapters as scroll-progress bounds: landing, your aircraft, routes (globe), ready. */
export const CHAPTERS = [0, 0.2, 0.4, 0.6, 0.8, 1] as const;

const START_UTC = 716; // 11:56Z, a summer midday
const UTC_SPAN = 10; // minutes of story time across the film

/** UTC minutes at a scroll position (the clock stops once the aircraft is on block). */
export const utcAt = (p: number) => START_UTC + Math.min(p, ON_BLOCK_AT) / ON_BLOCK_AT * UTC_SPAN;

/** Same mapping the scene uses, so the HUD runs even without WebGL. */
export function readoutsAt(p: number, r: Readouts) {
  r.progress = p;
  r.utcMinutes = utcAt(p);
  r.chapter = Math.max(0, CHAPTERS.findIndex((b) => p < b) - 1);
  if (p >= 1) r.chapter = CHAPTERS.length - 2;

  if (p < SHOTS.approach.to) {
    const k = p / SHOTS.approach.to;
    r.phase = k < 0.35 ? "approach" : "gearDown";
    r.speed = 140 - k * 5;
    r.altitudeFt = 1500 - k * 1200;
    return;
  }
  if (p < SHOTS.touchdown.to) {
    const k = clamp01((p - SHOTS.touchdown.from) / (SHOTS.touchdown.to - SHOTS.touchdown.from));
    r.phase = p < TOUCHDOWN_AT ? "gearDown" : "touchdown";
    r.speed = 135 - k * 85;
    r.altitudeFt = p < TOUCHDOWN_AT ? 300 * (1 - (p - SHOTS.touchdown.from) / (TOUCHDOWN_AT - SHOTS.touchdown.from)) : 0;
    return;
  }
  if (p < GLOBE_FROM) {
    const k = clamp01((p - SHOTS.taxi.from) / (SHOTS.taxi.to - SHOTS.taxi.from));
    r.phase = p < ON_BLOCK_AT ? "taxi" : "logged";
    r.speed = p < ON_BLOCK_AT ? 15 * (1 - k) + 3 : 0;
    r.altitudeFt = 0;
    return;
  }
  r.phase = "logged";
  r.speed = 0;
  r.altitudeFt = 0;
}
