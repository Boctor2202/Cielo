import { distanceNm } from "./geo";
import type { Flight, OpeningBalance } from "./types";

/**
 * Pilot achievements worked out from the logbook alone:
 *  - hour levels: milestones of total time (carried-forward totals included), in four tiers;
 *  - the logging streak: consecutive weeks in which every flight was entered within 48 h of landing.
 */

export type Tier = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "legend";
/** The metals in order: a series climbs them one rank at a time. */
export const TIERS: Tier[] = ["bronze", "silver", "gold", "platinum", "diamond", "legend"];
export const HOUR_LEVELS: { hours: number; tier: Tier }[] = [
  { hours: 100, tier: "bronze" },
  { hours: 250, tier: "bronze" },
  { hours: 500, tier: "silver" },
  { hours: 1000, tier: "silver" },
  { hours: 1500, tier: "gold" },
  { hours: 2000, tier: "gold" },
  { hours: 3000, tier: "gold" },
  { hours: 4000, tier: "platinum" },
  { hours: 5000, tier: "platinum" },
  { hours: 7500, tier: "diamond" },
  { hours: 10000, tier: "diamond" },
  { hours: 15000, tier: "legend" },
  { hours: 20000, tier: "legend" },
];

export interface HourLevel {
  totalMin: number;
  /** levels reached, in order (empty below 100 h) */
  reached: typeof HOUR_LEVELS;
  /** the highest level reached */
  current?: (typeof HOUR_LEVELS)[number];
  /** the next one, undefined once the last level is reached */
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

type Measure = "nightFlights" | "nightLandings" | "landings" | "airports" | "countries" | "nm" | "longest" | "types" | "signed";

/**
 * The badges, in series: each step is harder than the one before, and its rank in the series sets its metal
 * (bronze, silver, gold, platinum, diamond, legend) and its stars.
 */
export const DISCOVERY_SERIES = [
  { series: "night", measure: "nightFlights", steps: [{ id: "firstNight", target: 1 }] },
  { series: "nightLandings", measure: "nightLandings", steps: [{ id: "nightLandings50", target: 50 }, { id: "nightLandings100", target: 100 }, { id: "nightLandings250", target: 250 }, { id: "nightLandings500", target: 500 }, { id: "nightLandings1000", target: 1000 }] },
  { series: "landings", measure: "landings", steps: [{ id: "landings500", target: 500 }, { id: "landings1000", target: 1000 }, { id: "landings2500", target: 2500 }, { id: "landings5000", target: 5000 }, { id: "landings10000", target: 10000 }] },
  { series: "airports", measure: "airports", steps: [{ id: "airports10", target: 10 }, { id: "airports25", target: 25 }, { id: "airports50", target: 50 }, { id: "airports100", target: 100 }, { id: "airports200", target: 200 }, { id: "airports350", target: 350 }] },
  { series: "countries", measure: "countries", steps: [{ id: "countries5", target: 5 }, { id: "countries10", target: 10 }, { id: "countries25", target: 25 }, { id: "countries50", target: 50 }, { id: "countries75", target: 75 }, { id: "countries100", target: 100 }] },
  { series: "distance", measure: "nm", steps: [{ id: "earthLap", target: 21_639 }, { id: "earthLap3", target: 3 * 21_639 }, { id: "earthLap5", target: 5 * 21_639 }, { id: "toTheMoon", target: 207_560 }, { id: "earthLap25", target: 25 * 21_639 }, { id: "moonAndBack", target: 2 * 207_560 }] },
  { series: "longest", measure: "longest", steps: [{ id: "long1000", target: 1000 }, { id: "long2500", target: 2500 }, { id: "long5000", target: 5000 }, { id: "long7000", target: 7000 }] },
  { series: "types", measure: "types", steps: [{ id: "types3", target: 3 }, { id: "types5", target: 5 }, { id: "types10", target: 10 }, { id: "types20", target: 20 }] },
  { series: "signed", measure: "signed", steps: [{ id: "firstSigned", target: 1 }, { id: "signed50", target: 50 }, { id: "signed250", target: 250 }, { id: "signed1000", target: 1000 }] },
] as const satisfies readonly { series: string; measure: Measure; steps: readonly { id: string; target: number }[] }[];

export type DiscoverySeries = (typeof DISCOVERY_SERIES)[number]["series"];
export type DiscoveryId = (typeof DISCOVERY_SERIES)[number]["steps"][number]["id"];

export interface DiscoveryBadge {
  id: DiscoveryId;
  series: DiscoverySeries;
  /** 1 for the first step of its series */
  rank: number;
  /** the metal of that rank */
  tier: Tier;
  /** steps in the series */
  of: number;
  unlocked: boolean;
  /** the day it was earned */
  on?: string;
  value: number;
  target: number;
}

/** Equatorial circumference of the Earth, in nautical miles. */
export const EARTH_NM = 21_639;

/** Rank in a series → metal (a single badge is gold). */
export const tierOfRank = (rank: number, of: number): Tier => (of === 1 ? "gold" : TIERS[Math.min(rank - 1, TIERS.length - 1)]!);

/**
 * Badges earned in the order of the logbook (the date is the flight that crossed the mark). Simulator sessions
 * do not count; the airport lookup gives countries and distances.
 */
export function discoveryBadges(
  flights: Flight[],
  airport: (icao: string) => { country?: string; lat: number; lon: number } | undefined,
): DiscoveryBadge[] {
  const real = flights.filter((f) => !f.deletedAt && !f.isFstd).sort((a, b) => (a.date + (a.outUtc ?? "")).localeCompare(b.date + (b.outUtc ?? "")));
  const airports = new Set<string>();
  const countries = new Set<string>();
  const types = new Set<string>();
  const m: Record<Measure, number> = { nightFlights: 0, nightLandings: 0, landings: 0, airports: 0, countries: 0, nm: 0, longest: 0, types: 0, signed: 0 };
  const steps = DISCOVERY_SERIES.flatMap((s) => s.steps.map((st, i) => ({ ...st, series: s.series, measure: s.measure as Measure, rank: i + 1, of: s.steps.length })));
  const on = new Map<string, string>();
  for (const f of real) {
    for (const icao of [f.depIcao, f.arrIcao]) {
      if (!icao) continue;
      airports.add(icao);
      const c = airport(icao)?.country;
      if (c) countries.add(c);
    }
    if (f.aircraftTypeIcao) types.add(f.aircraftTypeIcao);
    if (f.nightMin > 0) m.nightFlights++;
    m.nightLandings += f.landingsNight ?? 0;
    m.landings += (f.landingsDay ?? 0) + (f.landingsNight ?? 0);
    if (f.signatureId) m.signed++;
    const a = airport(f.depIcao);
    const b = airport(f.arrIcao);
    if (a && b && f.depIcao !== f.arrIcao) {
      const d = distanceNm(a, b);
      m.nm += d;
      if (d > m.longest) m.longest = d;
    }
    m.airports = airports.size;
    m.countries = countries.size;
    m.types = types.size;
    for (const st of steps) if (!on.has(st.id) && m[st.measure] >= st.target) on.set(st.id, f.date);
  }
  return steps.map((st) => ({
    id: st.id,
    series: st.series,
    rank: st.rank,
    of: st.of,
    tier: tierOfRank(st.rank, st.of),
    unlocked: on.has(st.id),
    on: on.get(st.id),
    value: Math.min(m[st.measure], st.target),
    target: st.target,
  }));
}
