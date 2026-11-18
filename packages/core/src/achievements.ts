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
