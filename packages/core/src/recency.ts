import { addDays, daysBetween } from "./time";
import type { Flight } from "./types";

export interface RecencyStatus {
  /** FCL.060(b)(1): 3 takeoffs and 3 landings in the preceding 90 days to carry passengers. */
  passengers: RecencyCheck;
  /** FCL.060(b)(2): at night, 1 of those 3 at night (unless holding an IR). */
  night: RecencyCheck;
  /** HUD recency (Air France): 3 takeoffs and 3 landings with the HUD in the preceding 90 days; only for a
   * pilot whose logbook holds HUD takeoffs or landings */
  hud?: RecencyCheck;
  lastFlightDate?: string;
  daysSinceLastFlight?: number;
}

export interface RecencyCheck {
  valid: boolean;
  takeoffs: number;
  landings: number;
  required: number;
  /** Last day the privilege remains valid (when valid). */
  validUntil?: string;
}

/**
 * Takeoffs and landings count when performed as pilot flying in an aircraft or an FSTD
 * of the same type/class. `typeFilter` restricts to a type/class (ICAO designators).
 */
export function computeRecency(flights: Flight[], today: string, typeFilter?: string[]): RecencyStatus {
  const relevant = flights
    .filter((f) => !f.deletedAt && f.date <= today)
    .filter((f) => !typeFilter || typeFilter.includes(f.aircraftTypeIcao ?? "") || (f.isFstd && typeFilter.includes(f.fstdType ?? "")))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const from = addDays(today, -89);
  const window = relevant.filter((f) => f.date >= from);

  const passengers = check(window, relevant, 3, (f) => f.takeoffsDay + f.takeoffsNight, (f) => f.landingsDay + f.landingsNight);
  const night = check(window, relevant, 1, (f) => f.takeoffsNight, (f) => f.landingsNight);

  const hudTo = (f: Flight) => f.hudTakeoffs ?? 0;
  const hudLdg = (f: Flight) => f.hudLandings ?? 0;
  const hud = relevant.some((f) => hudTo(f) + hudLdg(f) > 0) ? check(window, relevant, 3, hudTo, hudLdg) : undefined;

  const lastFlight = relevant.find((f) => !f.isFstd);
  return {
    passengers,
    night,
    ...(hud ? { hud } : {}),
    lastFlightDate: lastFlight?.date,
    daysSinceLastFlight: lastFlight ? daysBetween(lastFlight.date, today) : undefined,
  };
}

function check(
  window: Flight[],
  allDesc: Flight[],
  required: number,
  tos: (f: Flight) => number,
  ldgs: (f: Flight) => number,
): RecencyCheck {
  const takeoffs = window.reduce((s, f) => s + tos(f), 0);
  const landings = window.reduce((s, f) => s + ldgs(f), 0);
  const valid = takeoffs >= required && landings >= required;
  let validUntil: string | undefined;
  if (valid) {
    // Walk back until the Nth takeoff and the Nth landing are reached: the older of the two dates + 90 days.
    let t = 0;
    let l = 0;
    let tDate: string | undefined;
    let lDate: string | undefined;
    for (const f of allDesc) {
      t += tos(f);
      l += ldgs(f);
      if (!tDate && t >= required) tDate = f.date;
      if (!lDate && l >= required) lDate = f.date;
      if (tDate && lDate) break;
    }
    const limiting = tDate! < lDate! ? tDate! : lDate!;
    validUntil = addDays(limiting, 89);
  }
  return { valid, takeoffs, landings, required, validUntil };
}
