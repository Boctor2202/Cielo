import { interpolateGreatCircle, type LatLon } from "./geo";
import { isNight } from "./solar";
import { MIN } from "./time";

export interface NightInput {
  dep: LatLon;
  arr: LatLon;
  outUtc?: string | null; // off-block
  offUtc?: string | null; // takeoff
  onUtc?: string | null; // landing
  inUtc?: string | null; // on-block
}

export interface NightResult {
  /** Night minutes over the block time (off-block → on-block), as logged under EASA. */
  nightMin: number;
  /** Night minutes airborne only. */
  nightAirMin: number;
  takeoffAtNight: boolean;
  landingAtNight: boolean;
}

/**
 * Night time per EASA (civil twilight, sun < −6°).
 * Before takeoff the aircraft is at the departure aerodrome, after landing at the arrival aerodrome,
 * and in between it follows the great circle at constant ground speed. Sampled per minute (minute midpoint).
 */
export function computeNight(input: NightInput): NightResult | null {
  const out = input.outUtc ? Date.parse(input.outUtc) : NaN;
  const inn = input.inUtc ? Date.parse(input.inUtc) : NaN;
  let off = input.offUtc ? Date.parse(input.offUtc) : NaN;
  let on = input.onUtc ? Date.parse(input.onUtc) : NaN;

  const start = Number.isFinite(out) ? out : off;
  const end = Number.isFinite(inn) ? inn : on;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  if (!Number.isFinite(off)) off = start;
  if (!Number.isFinite(on)) on = end;
  if (on <= off) {
    off = start;
    on = end;
  }

  const positionAt = (t: number): LatLon => {
    if (t <= off) return input.dep;
    if (t >= on) return input.arr;
    return interpolateGreatCircle(input.dep, input.arr, (t - off) / (on - off));
  };

  const totalMinutes = Math.round((end - start) / MIN);
  let nightMin = 0;
  let nightAirMin = 0;
  for (let i = 0; i < totalMinutes; i++) {
    const t = start + (i + 0.5) * MIN;
    const p = positionAt(t);
    if (isNight(p.lat, p.lon, t)) {
      nightMin++;
      if (t > off && t < on) nightAirMin++;
    }
  }
  return {
    nightMin,
    nightAirMin,
    takeoffAtNight: isNight(input.dep.lat, input.dep.lon, off),
    landingAtNight: isNight(input.arr.lat, input.arr.lon, on),
  };
}
