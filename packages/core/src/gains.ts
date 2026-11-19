import { discoveryBadges, hourLevel, type DiscoveryBadge, type HourLevel } from "./achievements";
import { distanceNm } from "./geo";
import type { Flight, OpeningBalance } from "./types";

type Place = { country?: string; lat: number; lon: number };

/** What new flights (one typed, or a whole import) brought to the logbook. */
export interface LogbookGains {
  flights: number;
  minutes: number;
  nightMinutes: number;
  landings: number;
  nm: number;
  newAirports: string[];
  newCountries: string[];
  newTypes: string[];
  newRegistrations: number;
  /** badges unlocked by these flights */
  badges: DiscoveryBadge[];
  /** a new hour level reached (new wings) */
  level?: HourLevel["current"];
  /** the closest badge still to earn, after these flights */
  next?: DiscoveryBadge;
}

const alive = (f: Flight) => !f.deletedAt;

function places(flights: Flight[], airport: (icao: string) => Place | undefined) {
  const aps = new Set<string>();
  const cts = new Set<string>();
  const types = new Set<string>();
  const regs = new Set<string>();
  for (const f of flights) {
    if (f.isFstd) continue;
    for (const icao of [f.depIcao, f.arrIcao]) {
      if (!icao) continue;
      aps.add(icao);
      const c = airport(icao)?.country;
      if (c) cts.add(c);
    }
    if (f.aircraftTypeIcao) types.add(f.aircraftTypeIcao);
    if (f.registration) regs.add(f.registration.toUpperCase());
  }
  return { aps, cts, types, regs };
}

export function logbookGains(all: Flight[], addedIds: Iterable<string>, airport: (icao: string) => Place | undefined, opening: OpeningBalance[] = []): LogbookGains {
  const ids = new Set(addedIds);
  const after = all.filter(alive);
  const before = after.filter((f) => !ids.has(f.id));
  const added = after.filter((f) => ids.has(f.id));
  const real = added.filter((f) => !f.isFstd);
  let nm = 0;
  for (const f of real) {
    const a = airport(f.depIcao);
    const b = airport(f.arrIcao);
    if (a && b && f.depIcao !== f.arrIcao) nm += distanceNm(a, b);
  }
  const p0 = places(before, airport);
  const p1 = places(after, airport);
  const diff = (a: Set<string>, b: Set<string>) => [...b].filter((x) => !a.has(x));
  const had = new Set(discoveryBadges(before, airport).filter((b) => b.unlocked).map((b) => b.id));
  const now = discoveryBadges(after, airport);
  const badges = now.filter((b) => b.unlocked && !had.has(b.id));
  const l0 = hourLevel(before, opening).current;
  const l1 = hourLevel(after, opening).current;
  const next = now
    .filter((b) => !b.unlocked && b.target > 0)
    .sort((a, b) => b.value / b.target - a.value / a.target)[0];
  return {
    flights: added.length,
    minutes: real.reduce((s, f) => s + f.totalMin, 0) + added.filter((f) => f.isFstd).reduce((s, f) => s + (f.fstdMin ?? 0), 0),
    nightMinutes: real.reduce((s, f) => s + f.nightMin, 0),
    landings: real.reduce((s, f) => s + f.landingsDay + f.landingsNight, 0),
    nm: Math.round(nm),
    newAirports: diff(p0.aps, p1.aps),
    newCountries: diff(p0.cts, p1.cts),
    newTypes: diff(p0.types, p1.types),
    newRegistrations: diff(p0.regs, p1.regs).length,
    badges,
    level: l1 && l1.hours !== l0?.hours ? l1 : undefined,
    next,
  };
}
