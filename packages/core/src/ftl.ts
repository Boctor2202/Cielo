/**
 * EASA ORO.FTL — base implementation.
 * Covers: max daily FDP for acclimatised crew (ORO.FTL.205(b)(1)), minimum rest (ORO.FTL.235(a)(b)),
 * cumulative duty and flight time limits (ORO.FTL.210) and recurrent extended recovery rest (ORO.FTL.235(d)).
 * Not covered yet: extensions, in-flight rest / augmented crew, split duty, unknown acclimatisation state,
 * standby counting rules and operator-specific schemes (CS FTL.1). Results are indicative.
 */
import { minutesBetween } from "./time";
import type { Flight, RosterEvent } from "./types";

export interface FtlSettings {
  /** minutes between report and first off-block */
  reportBeforeMin: number;
  /** minutes between last on-block and end of duty */
  releaseAfterMin: number;
  homeBaseIcao?: string;
  /** IANA timezone of the home base, used as reference time for acclimatised crew */
  homeTimezone: string;
}

export const DEFAULT_FTL_SETTINGS: FtlSettings = {
  reportBeforeMin: 60,
  releaseAfterMin: 30,
  homeTimezone: "Europe/Paris",
};

export interface DutyPeriod {
  id: string;
  kind: "FDP" | "DUTY";
  reportUtc: string;
  /** end of FDP = last on-block */
  fdpEndUtc: string;
  releaseUtc: string;
  sectors: number;
  flightMin: number;
  startIcao?: string;
  endIcao?: string;
  flightIds: string[];
}

/** ORO.FTL.205(b)(1) table: [startMinuteOfDay, endMinuteOfDay (exclusive), max FDP for 1–2 sectors]. */
const FDP_BANDS: [number, number, number][] = [
  [6 * 60, 13 * 60 + 30, 13 * 60],
  [13 * 60 + 30, 14 * 60, 12 * 60 + 45],
  [14 * 60, 14 * 60 + 30, 12 * 60 + 30],
  [14 * 60 + 30, 15 * 60, 12 * 60 + 15],
  [15 * 60, 15 * 60 + 30, 12 * 60],
  [15 * 60 + 30, 16 * 60, 11 * 60 + 45],
  [16 * 60, 16 * 60 + 30, 11 * 60 + 30],
  [16 * 60 + 30, 17 * 60, 11 * 60 + 15],
  [17 * 60, 24 * 60, 11 * 60],
  [0, 5 * 60, 11 * 60],
  [5 * 60, 5 * 60 + 15, 12 * 60],
  [5 * 60 + 15, 5 * 60 + 30, 12 * 60 + 15],
  [5 * 60 + 30, 5 * 60 + 45, 12 * 60 + 30],
  [5 * 60 + 45, 6 * 60, 12 * 60 + 45],
];

/** Max basic daily FDP (minutes) for an acclimatised crew member, from local reference start time and sectors. */
export function maxDailyFdp(localStartMinuteOfDay: number, sectors: number): number {
  const m = ((localStartMinuteOfDay % 1440) + 1440) % 1440;
  const band = FDP_BANDS.find(([a, b]) => m >= a && m < b);
  const base = band ? band[2] : 11 * 60;
  const reduction = Math.max(0, Math.max(sectors, 2) - 2) * 30;
  return Math.max(9 * 60, base - reduction);
}

export function localMinuteOfDay(iso: string, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(
    new Date(iso),
  );
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + mm;
}

/** Groups logged flights (or flight roster events) into duty periods. A gap > 6 h between blocks starts a new duty. */
export function buildDutyPeriods(flights: Flight[], settings: FtlSettings = DEFAULT_FTL_SETTINGS): DutyPeriod[] {
  const legs = flights
    .filter((f) => !f.deletedAt && !f.isFstd && (f.outUtc || f.offUtc) && (f.inUtc || f.onUtc))
    .map((f) => ({ f, start: (f.outUtc ?? f.offUtc)!, end: (f.inUtc ?? f.onUtc)! }))
    .sort((a, b) => a.start.localeCompare(b.start));
  const duties: DutyPeriod[] = [];
  let cur: DutyPeriod | null = null;
  for (const leg of legs) {
    if (cur && minutesBetween(cur.fdpEndUtc, leg.start) <= 6 * 60) {
      cur.fdpEndUtc = leg.end;
      cur.releaseUtc = shift(leg.end, settings.releaseAfterMin);
      cur.sectors++;
      cur.flightMin += leg.f.totalMin;
      cur.endIcao = leg.f.arrIcao;
      cur.flightIds.push(leg.f.id);
    } else {
      cur = {
        id: `duty-${leg.f.id}`,
        kind: "FDP",
        reportUtc: shift(leg.start, -settings.reportBeforeMin),
        fdpEndUtc: leg.end,
        releaseUtc: shift(leg.end, settings.releaseAfterMin),
        sectors: 1,
        flightMin: leg.f.totalMin,
        startIcao: leg.f.depIcao,
        endIcao: leg.f.arrIcao,
        flightIds: [leg.f.id],
      };
      duties.push(cur);
    }
  }
  return duties;
}

/** Duty periods from planned roster events (report/debrief taken from the roster when present). */
export function dutyPeriodsFromRoster(events: RosterEvent[], settings: FtlSettings = DEFAULT_FTL_SETTINGS): DutyPeriod[] {
  const duties: DutyPeriod[] = [];
  const sorted = events
    .filter((e) => !e.deletedAt && ["FLIGHT", "DEADHEAD", "SIM", "GROUND", "STANDBY"].includes(e.kind))
    .sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  let cur: DutyPeriod | null = null;
  for (const e of sorted) {
    const isSector = e.kind === "FLIGHT";
    const report = e.reportUtc ?? shift(e.startUtc, -settings.reportBeforeMin);
    if (cur && minutesBetween(cur.fdpEndUtc, e.startUtc) <= 6 * 60) {
      cur.fdpEndUtc = e.endUtc;
      cur.releaseUtc = e.debriefUtc ?? shift(e.endUtc, settings.releaseAfterMin);
      if (isSector) {
        cur.sectors++;
        cur.flightMin += minutesBetween(e.startUtc, e.endUtc);
        cur.kind = "FDP";
      }
      cur.endIcao = e.arrIcao ?? cur.endIcao;
    } else {
      cur = {
        id: `duty-${e.id}`,
        kind: isSector || e.kind === "DEADHEAD" ? "FDP" : "DUTY",
        reportUtc: report,
        fdpEndUtc: e.endUtc,
        releaseUtc: e.debriefUtc ?? shift(e.endUtc, settings.releaseAfterMin),
        sectors: isSector ? 1 : 0,
        flightMin: isSector ? minutesBetween(e.startUtc, e.endUtc) : 0,
        startIcao: e.depIcao,
        endIcao: e.arrIcao,
        flightIds: e.flightId ? [e.flightId] : [],
      };
      duties.push(cur);
    }
  }
  return duties;
}

export type FtlViolationCode =
  | "fdpExceeded"
  | "restTooShort"
  | "duty7d"
  | "duty14d"
  | "duty28d"
  | "flight28d"
  | "flightYear"
  | "flight12m"
  | "extendedRecovery";

export interface FtlViolation {
  code: FtlViolationCode;
  severity: "error" | "warning";
  dutyId?: string;
  atUtc: string;
  actualMin: number;
  limitMin: number;
}

export interface DutyAnalysis {
  duty: DutyPeriod;
  fdpMin: number;
  maxFdpMin: number;
  dutyMin: number;
  restBeforeMin?: number;
  minRestBeforeMin?: number;
}

export interface FtlReport {
  duties: DutyAnalysis[];
  violations: FtlViolation[];
  cumulative: {
    duty7d: number;
    duty14d: number;
    duty28d: number;
    flight28d: number;
    flightYear: number;
    flight12m: number;
  };
}

export const FTL_LIMITS = {
  duty7d: 60 * 60,
  duty14d: 110 * 60,
  duty28d: 190 * 60,
  flight28d: 100 * 60,
  flightYear: 900 * 60,
  flight12m: 1000 * 60,
  extendedRecoveryMin: 36 * 60,
  extendedRecoveryMaxGap: 168 * 60,
};

const WARN_RATIO = 0.9;

export function analyseFtl(duties: DutyPeriod[], nowUtc: string, settings: FtlSettings = DEFAULT_FTL_SETTINGS): FtlReport {
  const sorted = [...duties].sort((a, b) => a.reportUtc.localeCompare(b.reportUtc));
  const violations: FtlViolation[] = [];
  const analyses: DutyAnalysis[] = [];

  sorted.forEach((d, i) => {
    const fdpMin = minutesBetween(d.reportUtc, d.fdpEndUtc);
    const dutyMin = minutesBetween(d.reportUtc, d.releaseUtc);
    const maxFdpMin = d.kind === "FDP" ? maxDailyFdp(localMinuteOfDay(d.reportUtc, settings.homeTimezone), d.sectors) : Infinity;
    const a: DutyAnalysis = { duty: d, fdpMin, maxFdpMin, dutyMin };
    if (d.kind === "FDP" && fdpMin > maxFdpMin) {
      violations.push({ code: "fdpExceeded", severity: "error", dutyId: d.id, atUtc: d.reportUtc, actualMin: fdpMin, limitMin: maxFdpMin });
    }
    const prev = sorted[i - 1];
    if (prev) {
      const rest = minutesBetween(prev.releaseUtc, d.reportUtc);
      const prevDuty = minutesBetween(prev.reportUtc, prev.releaseUtc);
      const atHome = !settings.homeBaseIcao || prev.endIcao === settings.homeBaseIcao;
      const minRest = Math.max(prevDuty, atHome ? 12 * 60 : 10 * 60);
      a.restBeforeMin = rest;
      a.minRestBeforeMin = minRest;
      if (rest < minRest) {
        violations.push({ code: "restTooShort", severity: "error", dutyId: d.id, atUtc: d.reportUtc, actualMin: rest, limitMin: minRest });
      }
    }
    analyses.push(a);
  });

  // Cumulative limits, evaluated at the end of each duty and at "now".
  const checkpoints = [...sorted.map((d) => d.releaseUtc), nowUtc];
  const windowSum = (endIso: string, days: number, pick: (d: DutyPeriod) => number, clip: boolean) => {
    const end = Date.parse(endIso);
    const start = end - days * 86_400_000;
    let s = 0;
    for (const d of sorted) {
      const ds = Date.parse(d.reportUtc);
      const de = Date.parse(d.releaseUtc);
      if (de <= start || ds >= end) continue;
      if (clip) s += Math.round((Math.min(de, end) - Math.max(ds, start)) / 60000);
      else if (ds >= start) s += pick(d);
    }
    return s;
  };
  const dutyMinutes = (d: DutyPeriod) => minutesBetween(d.reportUtc, d.releaseUtc);
  const flightMinutes = (d: DutyPeriod) => d.flightMin;

  const yearSum = (endIso: string) => {
    const y = endIso.slice(0, 4);
    return sorted.filter((d) => d.reportUtc.slice(0, 4) === y && d.reportUtc <= endIso).reduce((s, d) => s + d.flightMin, 0);
  };

  const reported = new Set<string>();
  const flag = (code: FtlViolationCode, at: string, actual: number, limit: number) => {
    if (actual <= limit) return;
    const key = `${code}|${at.slice(0, 10)}`;
    if (reported.has(key)) return;
    reported.add(key);
    violations.push({ code, severity: "error", atUtc: at, actualMin: actual, limitMin: limit });
  };
  for (const cp of checkpoints) {
    flag("duty7d", cp, windowSum(cp, 7, dutyMinutes, true), FTL_LIMITS.duty7d);
    flag("duty14d", cp, windowSum(cp, 14, dutyMinutes, true), FTL_LIMITS.duty14d);
    flag("duty28d", cp, windowSum(cp, 28, dutyMinutes, true), FTL_LIMITS.duty28d);
    flag("flight28d", cp, windowSum(cp, 28, flightMinutes, false), FTL_LIMITS.flight28d);
    flag("flightYear", cp, yearSum(cp), FTL_LIMITS.flightYear);
    flag("flight12m", cp, windowSum(cp, 365, flightMinutes, false), FTL_LIMITS.flight12m);
  }

  // Recurrent extended recovery rest: at least 36 h, and no more than 168 h between two of them.
  let lastRecoveryEnd: string | undefined = sorted[0]?.reportUtc;
  for (let i = 1; i < sorted.length; i++) {
    const rest = minutesBetween(sorted[i - 1]!.releaseUtc, sorted[i]!.reportUtc);
    if (rest >= FTL_LIMITS.extendedRecoveryMin) {
      lastRecoveryEnd = sorted[i]!.reportUtc;
    } else if (lastRecoveryEnd) {
      const gap = minutesBetween(lastRecoveryEnd, sorted[i]!.releaseUtc);
      if (gap > FTL_LIMITS.extendedRecoveryMaxGap) {
        violations.push({
          code: "extendedRecovery",
          severity: "error",
          dutyId: sorted[i]!.id,
          atUtc: sorted[i]!.reportUtc,
          actualMin: gap,
          limitMin: FTL_LIMITS.extendedRecoveryMaxGap,
        });
        lastRecoveryEnd = sorted[i]!.releaseUtc; // report once per streak
      }
    }
  }

  return {
    duties: analyses,
    violations: violations.sort((a, b) => b.atUtc.localeCompare(a.atUtc)),
    cumulative: {
      duty7d: windowSum(nowUtc, 7, dutyMinutes, true),
      duty14d: windowSum(nowUtc, 14, dutyMinutes, true),
      duty28d: windowSum(nowUtc, 28, dutyMinutes, true),
      flight28d: windowSum(nowUtc, 28, flightMinutes, false),
      flightYear: yearSum(nowUtc),
      flight12m: windowSum(nowUtc, 365, flightMinutes, false),
    },
  };
}

/** "warning" when a cumulative value reaches 90 % of its limit. */
export function cumulativeLevel(actual: number, limit: number): "ok" | "warning" | "error" {
  if (actual > limit) return "error";
  if (actual >= limit * WARN_RATIO) return "warning";
  return "ok";
}

function shift(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * 60000).toISOString();
}
