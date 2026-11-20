/**
 * Block and runway times from an ADS-B trace (adsb.lol / readsb "trace full"): the aircraft's positions with
 * "ground" or an altitude, and its ground speed. For each flight of the trace:
 *   off  = first position in the air, on = last one (refined by the first ground position that follows),
 *   out  = start of the taxi before take-off (after the last stop of more than a few minutes on the ground),
 *   in   = the stop after landing.
 * Out and in exist only where receivers saw the aircraft on the ground (good at large airports); missing ones are
 * left out for the pilot to type (the form never invents them).
 */
export interface TracePos {
  /** unix seconds */
  t: number;
  lat: number;
  lon: number;
  /** "ground", altitude in ft, or null (unknown) */
  alt: number | "ground" | null;
  /** ground speed, kt */
  gs: number | null;
  /** the ADS-B network saw a new flight start here (readsb "new leg"), e.g. after a landing out of coverage */
  newLeg?: boolean;
}

export interface TraceFlight {
  out?: string;
  off: string;
  on: string;
  in?: string;
  /** where the trace starts and ends for this flight (to find the airports) */
  from: { lat: number; lon: number };
  to: { lat: number; lon: number };
}

const iso = (t: number) => new Date(t * 1000).toISOString().slice(0, 19) + "Z";
const air = (p: TracePos) => typeof p.alt === "number";
const ground = (p: TracePos) => p.alt === "ground";
/** moving on the ground (taxiing), not just GPS jitter */
const MOVING = 3;
/** a stop on the ground longer than this ends the taxi search (parked) */
const PARKED = 4 * 60;
/** gap in the data longer than this: we lost the aircraft */
const LOST = 15 * 60;

export function flightsFromTrace(points: TracePos[]): TraceFlight[] {
  const pts = [...points].sort((a, b) => a.t - b.t);
  const flights: TraceFlight[] = [];
  let i = 0;
  while (i < pts.length) {
    // the next airborne stretch (several minutes, not a stray position)
    while (i < pts.length && !air(pts[i]!)) i++;
    if (i >= pts.length) break;
    const start = i;
    let end = i;
    // the flight goes on across a gap in coverage (over the sea) while the aircraft was high; a gap after a
    // descent may hide a landing, so it ends the flight there
    const high = (p: TracePos) => typeof p.alt === "number" && p.alt > 10_000;
    while (end + 1 < pts.length && !ground(pts[end + 1]!) && !pts[end + 1]!.newLeg) {
      const a = pts[end]!, b = pts[end + 1]!;
      const gap = b.t - a.t;
      if (gap >= LOST && !(gap < 6 * 3600 && high(a) && high(b))) break;
      end++;
    }
    i = end + 1;
    const offP = pts[start]!;
    const lastAir = pts[end]!;
    if (lastAir.t - offP.t < 5 * 60) continue;
    const landed = i < pts.length && ground(pts[i]!) && pts[i]!.t - lastAir.t < 3 * 60;
    // without a ground contact, only a flight seen low at the end counts (landed out of coverage); one still
    // high was in flight when the trace stopped
    if (!landed && (Date.now() / 1000 - lastAir.t < 15 * 60 || (typeof lastAir.alt === "number" && lastAir.alt > 3000))) continue;
    const onT = landed ? pts[i]!.t : lastAir.t;

    // out: back from take-off over the taxi, until a parked stretch or a gap
    let out: number | undefined;
    for (let k = start - 1; k >= 0; k--) {
      const p = pts[k]!;
      const next = pts[k + 1]!;
      if (!ground(p) || next.t - p.t > LOST) break;
      if ((p.gs ?? 0) >= MOVING) out = p.t;
      else if (k > 0 && ground(pts[k - 1]!) && (pts[k - 1]!.gs ?? 0) < MOVING && p.t - pts[k - 1]!.t >= PARKED) break;
      else if (next.t - p.t >= PARKED) break;
    }
    // in: forward from touchdown until the aircraft stops for good
    let inn: number | undefined;
    if (landed) {
      for (let k = i; k < pts.length; k++) {
        const p = pts[k]!;
        if (!ground(p)) break;
        if (k > i && p.t - pts[k - 1]!.t > LOST) break;
        const nextT = pts[k + 1]?.t;
        const stopped = (p.gs ?? 0) < MOVING;
        if (stopped && (nextT === undefined || nextT - p.t >= PARKED || !ground(pts[k + 1]!))) {
          inn = p.t;
          break;
        }
        if (stopped && pts.slice(k + 1).every((q) => (q.gs ?? 0) < MOVING && ground(q))) {
          inn = p.t;
          break;
        }
      }
    }
    // a taxi of a few seconds is the receiver catching the end of the roll, not the block time
    if (out !== undefined && offP.t - out < 60) out = undefined;
    if (inn !== undefined && inn - onT < 30) inn = undefined;
    flights.push({
      out: out !== undefined ? iso(out) : undefined,
      off: iso(offP.t),
      on: iso(onT),
      in: inn !== undefined ? iso(inn) : undefined,
      from: { lat: (out !== undefined ? pts.find((p) => p.t === out) ?? offP : offP).lat, lon: (out !== undefined ? pts.find((p) => p.t === out) ?? offP : offP).lon },
      to: { lat: landed ? pts[i]!.lat : lastAir.lat, lon: landed ? pts[i]!.lon : lastAir.lon },
    });
  }
  return flights;
}
