/**
 * EASA ORO.FTL — base implementation.
 * Covers: max daily FDP for acclimatised crew (ORO.FTL.205(b)(1)), minimum rest (ORO.FTL.235(a)(b)),
 * cumulative duty and flight time limits (ORO.FTL.210) and recurrent extended recovery rest (ORO.FTL.235(d)).
 * Also: split duty (CS FTL.1.220, a ground break of 3 h or more extends the FDP by half the break) and
 * FDP overruns within the 1 h extension (ORO.FTL.205(d)) shown as warnings.
 * Not covered yet: in-flight rest / augmented crew, unknown acclimatisation state, standby counting rules and
 * operator-specific schemes. A logbook has no report or release times: results are estimates.
 */
import { minutesBetween } from "./time";
import type { Flight, FtlRegime, RosterEvent } from "./types";

export interface FtlSettings {
  /** minutes between report and first off-block */
  reportBeforeMin: number;
  /** minutes between last on-block and end of duty */
  releaseAfterMin: number;
  homeBaseIcao?: string;
  /** IANA timezone of the home base, used as reference time for acclimatised crew */
  homeTimezone: string;
  /** "oro" (default): EASA ORO.FTL; "subq": EU-OPS Subpart Q (air taxi, business aviation, single pilot) */
  regime?: FtlRegime;
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
  /** longest time on the ground between two sectors of this duty (split duty), minutes */
  longestBreakMin?: number;
  /** on-block and off-block around that longest time on the ground */
  breakFromUtc?: string;
  breakToUtc?: string;
}

/** A split duty break (CS FTL.1.220), worked out from the on-block before it and the off-block after it. */
export interface SplitBreak {
  /** the break: time on the ground less the post- and pre-flight duties (30 min) */
  breakMin: number;
  /** FDP increase with suitable accommodation: half the break */
  extensionMin: number;
  /** suitable accommodation is required: a break of 6 h or more, or one in the WOCL */
  accommodationRequired: boolean;
  /** minutes of the break in the WOCL (02:00–05:59 reference time) */
  woclMin: number;
  /** FDP increase without suitable accommodation: what is beyond 6 h or in the WOCL does not count */
  extensionWithoutAccommodationMin: number;
}

/** A ground break counts for split duty from 3 h (CS FTL.1.220). */
export const SPLIT_MIN_BREAK = 3 * 60;
/** Post- and pre-flight duties taken off the break (CS FTL.1.220: at least 30 min). */
const SPLIT_DUTIES_MIN = 30;
/** Longest FDP extension (ORO.FTL.205(d)): overruns within it are warnings. */
export const FDP_EXTENSION_MAX = 60;
/** Roster events this long are whole-day markers (availability, standby days), not timed duties. */
const ALL_DAY_MIN = 16 * 60;
/** Shortest rest the rules allow (away from base, ORO.FTL.235(b)). */
const MIN_REST_AWAY = 10 * 60;

/** FDP increase earned by a time on the ground: half the break (the time less the post/pre-flight duties), from a 3 h break. */
export function splitDutyExtension(groundMin: number | undefined): number {
  const b = (groundMin ?? 0) - SPLIT_DUTIES_MIN;
  return b >= SPLIT_MIN_BREAK ? Math.round(b / 2) : 0;
}

/** Minutes of [from, to] falling in the WOCL (02:00–05:59) of the given reference time zone. */
function woclOverlap(fromUtc: string, toUtc: string, timeZone: string): number {
  const from = Date.parse(fromUtc);
  const to = Date.parse(toUtc);
  let n = 0;
  // minute by quarter hour: precise enough, and safe across DST changes
  for (let t = from; t < to; t += 15 * 60000) {
    const m = localMinuteOfDay(new Date(t).toISOString(), timeZone);
    if (m >= 120 && m < 360) n += Math.min(15, (to - t) / 60000);
  }
  return Math.round(n);
}

/**
 * CS FTL.1.220: a break on the ground of at least 3 h (post- and pre-flight duties excluded, 30 min at least) raises
 * the max FDP by up to 50 % of the break. Suitable accommodation is needed for a break of 6 h or more or one in the
 * WOCL; without it, the part beyond 6 h and the part in the WOCL do not count.
 */
export function splitBreak(onBlockUtc: string, offBlockUtc: string, timeZone: string): SplitBreak | undefined {
  const breakMin = minutesBetween(onBlockUtc, offBlockUtc) - SPLIT_DUTIES_MIN;
  if (breakMin < SPLIT_MIN_BREAK) return undefined;
  // the break itself starts after the post-flight duties (half of the 30 min each side)
  const from = shift(onBlockUtc, SPLIT_DUTIES_MIN / 2);
  const to = shift(offBlockUtc, -SPLIT_DUTIES_MIN / 2);
  const woclMin = woclOverlap(from, to, timeZone);
  const counted = Math.max(0, Math.min(breakMin, 6 * 60) - woclMin);
  return {
    breakMin,
    extensionMin: Math.round(breakMin / 2),
    accommodationRequired: breakMin >= 6 * 60 || woclMin > 0,
    woclMin,
    extensionWithoutAccommodationMin: counted >= SPLIT_MIN_BREAK ? Math.round(counted / 2) : 0,
  };
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

/**
 * EU-OPS Subpart Q, OPS 1.1105: 13 h, less 30 min per sector from the third (2 h at most). An FDP starting in the
 * WOCL (02:00–05:59 reference time) loses 100 % of the encroachment, one ending in or spanning it 50 %, 2 h at most.
 */
export function subpartQMaxFdp(localStartMin: number, fdpMin: number, sectors: number): number {
  const sectorCut = Math.min(120, Math.max(0, sectors - 2) * 30);
  const s = ((localStartMin % 1440) + 1440) % 1440;
  const wStart = 2 * 60;
  const wEnd = 6 * 60;
  let woclCut = 0;
  if (s >= wStart && s < wEnd) woclCut = Math.min(120, wEnd - s);
  else {
    // overlap of [start, start + fdp] with the WOCL of the following night(s)
    let overlap = 0;
    for (const base of [0, 1440]) {
      const a = Math.max(s, base + wStart);
      const b = Math.min(s + fdpMin, base + wEnd);
      if (b > a) overlap += b - a;
    }
    woclCut = Math.min(120, Math.round(overlap / 2));
  }
  return 13 * 60 - sectorCut - woclCut;
}

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

/**
 * Groups logged flights into duty periods. Two blocks belong to the same duty unless the time between them leaves
 * room for the shortest legal rest (10 h) plus the release and report times: a shorter gap cannot have been a rest,
 * it is a wait on the ground (split duty). The same leg logged twice is counted once.
 */
export function buildDutyPeriods(flights: Flight[], settings: FtlSettings = DEFAULT_FTL_SETTINGS): DutyPeriod[] {
  const seen = new Set<string>();
  const legs = flights
    .filter((f) => !f.deletedAt && !f.isFstd && (f.outUtc || f.offUtc) && (f.inUtc || f.onUtc))
    .map((f) => ({ f, start: (f.outUtc ?? f.offUtc)!, end: (f.inUtc ?? f.onUtc)! }))
    .sort((a, b) => a.start.localeCompare(b.start))
    .filter((l) => {
      const k = `${l.start}|${l.end}|${l.f.depIcao}|${l.f.arrIcao}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  const maxGap = settings.releaseAfterMin + MIN_REST_AWAY + settings.reportBeforeMin;
  const duties: DutyPeriod[] = [];
  let cur: DutyPeriod | null = null;
  for (const leg of legs) {
    const gap = cur ? minutesBetween(cur.fdpEndUtc, leg.start) : Infinity;
    if (cur && gap < maxGap) {
      if (gap > (cur.longestBreakMin ?? 0)) {
        cur.longestBreakMin = gap;
        cur.breakFromUtc = cur.fdpEndUtc;
        cur.breakToUtc = leg.start;
      }
      if (leg.end > cur.fdpEndUtc) {
        cur.fdpEndUtc = leg.end;
        cur.releaseUtc = shift(leg.end, settings.releaseAfterMin);
      }
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
    // a whole-day marker (an "ON" availability or standby day, 16 h or more) is not a duty period to chain flights
    // into, and a flight without its two airports is not a sector
    .filter((e) => minutesBetween(e.startUtc, e.endUtc) < ALL_DAY_MIN)
    .filter((e) => e.kind !== "FLIGHT" || (e.depIcao && e.arrIcao))
    .sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  let cur: DutyPeriod | null = null;
  for (const e of sorted) {
    const isSector = e.kind === "FLIGHT";
    const report = e.reportUtc ?? shift(e.startUtc, -settings.reportBeforeMin);
    // the same duty unless the time between the release and the next report leaves room for the shortest legal
    // rest (10 h): a shorter time on the ground is a break within the duty (split duty), not a rest
    if (cur && minutesBetween(cur.releaseUtc, report) < MIN_REST_AWAY) {
      const gap = minutesBetween(cur.fdpEndUtc, e.startUtc);
      if (isSector && gap > (cur.longestBreakMin ?? 0)) {
        cur.longestBreakMin = gap;
        cur.breakFromUtc = cur.fdpEndUtc;
        cur.breakToUtc = e.startUtc;
      }
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
  /** max FDP including the split duty extension */
  maxFdpMin: number;
  /** of which split duty extension */
  splitExtensionMin: number;
  /** the split duty break, when there is one */
  split?: SplitBreak;
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

/** Cumulative limits of each scheme: Subpart Q (OPS 1.1100) has no 14-day duty nor 12-month flight limit. */
export function limitApplies(k: keyof typeof FTL_LIMITS, regime: FtlRegime | undefined): boolean {
  if (regime === "none") return false;
  if (regime === "subq") return k !== "duty14d" && k !== "flight12m";
  return true;
}

export function analyseFtl(duties: DutyPeriod[], nowUtc: string, settings: FtlSettings = DEFAULT_FTL_SETTINGS): FtlReport {
  const sorted = [...duties].sort((a, b) => a.reportUtc.localeCompare(b.reportUtc));
  const violations: FtlViolation[] = [];
  const analyses: DutyAnalysis[] = [];

  sorted.forEach((d, i) => {
    const fdpMin = minutesBetween(d.reportUtc, d.fdpEndUtc);
    const dutyMin = minutesBetween(d.reportUtc, d.releaseUtc);
    const split = d.breakFromUtc && d.breakToUtc ? splitBreak(d.breakFromUtc, d.breakToUtc, settings.homeTimezone) : undefined;
    const splitExtensionMin = split?.extensionMin ?? splitDutyExtension(d.longestBreakMin);
    const startLocal = localMinuteOfDay(d.reportUtc, settings.homeTimezone);
    const base = settings.regime === "subq" ? subpartQMaxFdp(startLocal, fdpMin, d.sectors) : maxDailyFdp(startLocal, d.sectors);
    const maxFdpMin = d.kind === "FDP" && settings.regime !== "none" ? base + splitExtensionMin : Infinity;
    const a: DutyAnalysis = { duty: d, fdpMin, maxFdpMin, splitExtensionMin, dutyMin, ...(split ? { split } : {}) };
    if (d.kind === "FDP" && fdpMin > maxFdpMin) {
      const severity = fdpMin - maxFdpMin <= FDP_EXTENSION_MAX ? "warning" : "error";
      violations.push({ code: "fdpExceeded", severity, dutyId: d.id, atUtc: d.reportUtc, actualMin: fdpMin, limitMin: maxFdpMin });
    }
    const prev = sorted[i - 1];
    if (prev) {
      const rest = minutesBetween(prev.releaseUtc, d.reportUtc);
      const prevDuty = minutesBetween(prev.reportUtc, prev.releaseUtc);
      // 12 h at home base, 10 h away; without a home base we cannot tell, so the lower one
      const atHome = !!settings.homeBaseIcao && prev.endIcao === settings.homeBaseIcao;
      const minRest = Math.max(prevDuty, atHome ? 12 * 60 : MIN_REST_AWAY);
      a.restBeforeMin = rest;
      a.minRestBeforeMin = minRest;
      if (rest < minRest && settings.regime !== "none") {
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
  const applies = (k: keyof typeof FTL_LIMITS) => limitApplies(k, settings.regime);
  for (const cp of settings.regime === "none" ? [] : checkpoints) {
    flag("duty7d", cp, windowSum(cp, 7, dutyMinutes, true), FTL_LIMITS.duty7d);
    if (applies("duty14d")) flag("duty14d", cp, windowSum(cp, 14, dutyMinutes, true), FTL_LIMITS.duty14d);
    flag("duty28d", cp, windowSum(cp, 28, dutyMinutes, true), FTL_LIMITS.duty28d);
    flag("flight28d", cp, windowSum(cp, 28, flightMinutes, false), FTL_LIMITS.flight28d);
    flag("flightYear", cp, yearSum(cp), FTL_LIMITS.flightYear);
    if (applies("flight12m")) flag("flight12m", cp, windowSum(cp, 365, flightMinutes, false), FTL_LIMITS.flight12m);
  }

  // Recurrent extended recovery rest: at least 36 h, and no more than 168 h between two of them.
  let lastRecoveryEnd: string | undefined = sorted[0]?.reportUtc;
  for (let i = 1; settings.regime !== "none" && i < sorted.length; i++) {
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
