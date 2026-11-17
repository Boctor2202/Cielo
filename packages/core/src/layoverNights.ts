import { addDays, daysBetween } from "./time";
import type { Flight } from "./types";

/**
 * Nights spent on layover, by country, worked out from the logbook: after a leg that ends away from the home
 * base, the nights until the next leg departs from that same airport. A gap longer than MAX_STAY days, or a
 * next leg leaving from somewhere else (positioning not logged, leave), is not counted as a layover.
 */
export interface LayoverStay {
  airport: string;
  country: string;
  /** UTC date of arrival and of the next departure */
  from: string;
  to: string;
  nights: number;
}

export interface CountryNights {
  country: string;
  nights: number;
  stays: number;
  airports: string[];
}

const MAX_STAY = 14;

export function layoverStays(flights: Flight[], homeBase: string | undefined, countryOf: (icao: string) => string | undefined): LayoverStay[] {
  const legs = flights
    .filter((f) => !f.deletedAt && !f.isFstd && f.depIcao && f.arrIcao)
    .map((f) => ({ f, start: f.outUtc ?? f.offUtc ?? `${f.date}T00:00:00Z`, end: f.inUtc ?? f.onUtc ?? f.outUtc ?? `${f.date}T00:00:00Z` }))
    .sort((a, b) => a.start.localeCompare(b.start));
  const home = homeBase?.toUpperCase();
  const out: LayoverStay[] = [];
  for (let i = 0; i < legs.length - 1; i++) {
    const cur = legs[i]!;
    const next = legs[i + 1]!;
    const at = cur.f.arrIcao.toUpperCase();
    if (at === home || next.f.depIcao.toUpperCase() !== at) continue;
    const from = cur.end.slice(0, 10);
    const to = next.start.slice(0, 10);
    const nights = daysBetween(from, to);
    if (nights < 1 || nights > MAX_STAY) continue;
    out.push({ airport: at, country: countryOf(at) ?? "??", from, to, nights });
  }
  return out;
}

/** Nights per country for one calendar year (a stay across New Year is split by night). */
export function nightsByCountry(stays: LayoverStay[], year: number): { total: number; countries: CountryNights[]; stays: LayoverStay[] } {
  const by = new Map<string, CountryNights>();
  const kept: LayoverStay[] = [];
  let total = 0;
  for (const s of stays) {
    // night n is the night starting on from + n days
    let n = 0;
    for (let k = 0; k < s.nights; k++) if (addDays(s.from, k).startsWith(String(year))) n++;
    if (!n) continue;
    kept.push({ ...s, nights: n });
    total += n;
    const c = by.get(s.country) ?? { country: s.country, nights: 0, stays: 0, airports: [] };
    c.nights += n;
    c.stays++;
    if (!c.airports.includes(s.airport)) c.airports.push(s.airport);
    by.set(s.country, c);
  }
  return { total, countries: [...by.values()].sort((a, b) => b.nights - a.nights || a.country.localeCompare(b.country)), stays: kept };
}
