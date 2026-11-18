import { distanceNm } from "./geo";
import type { Flight, OpeningBalance } from "./types";

/**
 * Pilot achievements worked out from the logbook alone:
 *  - hour levels: milestones of total time (carried-forward totals included), in four tiers;
 *  - the logging streak: consecutive weeks in which every flight was entered within 48 h of landing.
 */

export type Tier = "bronze" | "silver" | "gold" | "platinum";
export const HOUR_LEVELS: { hours: number; tier: Tier }[] = [
  { hours: 100, tier: "bronze" },
  { hours: 250, tier: "bronze" },
  { hours: 500, tier: "silver" },
  { hours: 1000, tier: "silver" },
  { hours: 1500, tier: "gold" },
  { hours: 3000, tier: "gold" },
  { hours: 5000, tier: "platinum" },
  { hours: 10000, tier: "platinum" },
];

export interface HourLevel {
  totalMin: number;
  /** levels reached, in order (empty below 100 h) */
  reached: typeof HOUR_LEVELS;
  /** the highest level reached */
  current?: (typeof HOUR_LEVELS)[number];
  /** the next one, undefined once 10 000 h are logged */
  next?: (typeof HOUR_LEVELS)[number];
  /** progress from the current level (or zero) to the next, 0–1 */
  ratio: number;
}

export function hourLevel(flights: Flight[], opening: OpeningBalance[] = []): HourLevel {
  const totalMin =
    flights.filter((f) => !f.deletedAt && !f.isFstd).reduce((s, f) => s + f.totalMin, 0) +
    opening.filter((o) => !o.deletedAt).reduce((s, o) => s + o.totalMin, 0);
  const h = totalMin / 60;
  const reached = HOUR_LEVELS.filter((l) => h >= l.hours);
  const current = reached[reached.length - 1];
  const next = HOUR_LEVELS.find((l) => h < l.hours);
  const from = current?.hours ?? 0;
  const ratio = next ? Math.max(0, Math.min(1, (h - from) / (next.hours - from))) : 1;
  return { totalMin, reached, current, next, ratio };
}

/** Time allowed between landing and entering the flight. */
export const LOG_WITHIN_H = 48;

export type WeekState = "onTime" | "late" | "none";

export interface LoggingStreak {
  /** weeks in a row up to this one with every flight entered on time (weeks without flights do not break it) */
  current: number;
  best: number;
  /** share of flights entered on time, 0–1 (undefined before the first one) */
  onTimeRate?: number;
  /** the last 12 weeks, oldest first, the current week last */
  weeks: { monday: string; state: WeekState }[];
}

const monday = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
const addWeeks = (mon: string, n: number) => new Date(Date.parse(`${mon}T00:00:00Z`) + n * 7 * 86_400_000).toISOString().slice(0, 10);

/**
 * Flights imported from another logbook are history, not logging: they are left out, as are simulator sessions
 * without block times. A flight counts as on time when it was created within 48 h of its block-in (or of the end
 * of its day when there is no time).
 */
export function loggingStreak(flights: Flight[], nowIso: string = new Date().toISOString()): LoggingStreak {
  const logged = flights.filter((f) => !f.deletedAt && f.source !== "import" && f.createdAt);
  const byWeek = new Map<string, WeekState>();
  let onTime = 0;
  for (const f of logged) {
    const landed = Date.parse(f.inUtc ?? f.onUtc ?? `${f.date}T23:59:59Z`);
    const ok = Date.parse(f.createdAt) - landed <= LOG_WITHIN_H * 3_600_000;
    if (ok) onTime++;
    const w = monday(f.date);
    if (!ok) byWeek.set(w, "late");
    else if (byWeek.get(w) !== "late") byWeek.set(w, "onTime");
  }
  const thisWeek = monday(nowIso);
  const first = [...byWeek.keys()].sort()[0];
  // walk the weeks from the first logged one: the streak grows on on-time weeks, resets on late ones
  let run = 0;
  let best = 0;
  if (first) {
    for (let w = first; w <= thisWeek; w = addWeeks(w, 1)) {
      const s = byWeek.get(w);
      if (s === "onTime") best = Math.max(best, ++run);
      else if (s === "late") run = 0;
    }
  }
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const m = addWeeks(thisWeek, i - 11);
    return { monday: m, state: byWeek.get(m) ?? ("none" as WeekState) };
  });
  return { current: run, best, onTimeRate: logged.length ? onTime / logged.length : undefined, weeks };
}

/* ---------- discovery badges ---------- */

export type DiscoveryId =
  | "firstNight"
  | "nightLandings100"
  | "airports10"
  | "airports50"
  | "airports100"
  | "countries5"
  | "countries10"
  | "countries25"
  | "earthLap"
  | "types3"
  | "firstSigned";

export interface DiscoveryBadge {
  id: DiscoveryId;
  unlocked: boolean;
  /** the day it was earned */
  on?: string;
  value: number;
  target: number;
}

/** Equatorial circumference of the Earth, in nautical miles. */
export const EARTH_NM = 21_639;

/**
 * Badges for firsts and collections, earned in the order of the logbook (the date is the flight that crossed the
 * mark). Simulator sessions do not count; the airport lookup gives countries and distances.
 */
export function discoveryBadges(
  flights: Flight[],
  airport: (icao: string) => { country?: string; lat: number; lon: number } | undefined,
): DiscoveryBadge[] {
  const real = flights.filter((f) => !f.deletedAt && !f.isFstd).sort((a, b) => (a.date + (a.outUtc ?? "")).localeCompare(b.date + (b.outUtc ?? "")));
  const goals: { id: DiscoveryId; target: number; measure: () => number }[] = [];
  const airports = new Set<string>();
  const countries = new Set<string>();
  const types = new Set<string>();
  let night = 0;
  let nightLandings = 0;
  let nm = 0;
  let signed = 0;
  goals.push(
    { id: "firstNight", target: 1, measure: () => night },
    { id: "nightLandings100", target: 100, measure: () => nightLandings },
    { id: "airports10", target: 10, measure: () => airports.size },
    { id: "airports50", target: 50, measure: () => airports.size },
    { id: "airports100", target: 100, measure: () => airports.size },
    { id: "countries5", target: 5, measure: () => countries.size },
    { id: "countries10", target: 10, measure: () => countries.size },
    { id: "countries25", target: 25, measure: () => countries.size },
    { id: "earthLap", target: EARTH_NM, measure: () => nm },
    { id: "types3", target: 3, measure: () => types.size },
    { id: "firstSigned", target: 1, measure: () => signed },
  );
  const on = new Map<DiscoveryId, string>();
  for (const f of real) {
    for (const icao of [f.depIcao, f.arrIcao]) {
      if (!icao) continue;
      airports.add(icao);
      const c = airport(icao)?.country;
      if (c) countries.add(c);
    }
    if (f.aircraftTypeIcao) types.add(f.aircraftTypeIcao);
    if (f.nightMin > 0) night++;
    nightLandings += f.landingsNight ?? 0;
    if (f.signatureId) signed++;
    const a = airport(f.depIcao);
    const b = airport(f.arrIcao);
    if (a && b && f.depIcao !== f.arrIcao) nm += distanceNm(a, b);
    for (const g of goals) if (!on.has(g.id) && g.measure() >= g.target) on.set(g.id, f.date);
  }
  return goals.map((g) => ({ id: g.id, unlocked: on.has(g.id), on: on.get(g.id), value: Math.min(g.measure(), g.target), target: g.target }));
}
