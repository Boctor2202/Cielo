import { addDays, daysBetween } from "./time";
import type { AircraftType, Flight, RegulatoryFramework } from "./types";

/**
 * Recent experience per type or class rating, as a pilot checks it before a flight:
 *  - EASA FCL.060(b) / CASA 61.395: to carry passengers, 3 takeoffs and 3 landings as pilot flying in the
 *    preceding 90 days in an aircraft (or FSTD) of the same type or class; at night, 1 of them at night
 *    (unless the pilot holds a valid IR).
 *  - FAA 61.57: (a) 3 takeoffs and landings in 90 days in the same category, class and type; (b) at night,
 *    3 takeoffs and 3 full-stop landings at night; (c) IFR: 6 instrument approaches (plus holding, intercepting
 *    and tracking) in the preceding 6 calendar months.
 * Flights only count where the logbook says so: takeoffs/landings as recorded (they are set when the pilot was
 * pilot flying), approaches from the flight's approach list.
 */

export type CurrencyKind = "passengers" | "night" | "ifr" | "hud";

export interface CurrencyItem {
  /** "passengers:TR A320" — stable key for alerts */
  key: string;
  kind: CurrencyKind;
  /** the type or class rating the item is about ("TR A320", "SEP(L)", "C172"); "all" for the IFR check */
  group: string;
  /** ICAO designators that count towards this group */
  types: string[];
  required: number;
  /** counted in the window: takeoffs and landings (passengers, night) or approaches (ifr) */
  takeoffs: number;
  landings: number;
  valid: boolean;
  /** last day the privilege holds (when valid) */
  validUntil?: string;
  /** days left until validUntil (0 = last day) */
  daysLeft?: number;
  /** what is missing when not valid: takeoffs and landings (or approaches) to log */
  missingTakeoffs: number;
  missingLandings: number;
  /** last flight of the group */
  lastFlown?: string;
}

export interface CurrencyOptions {
  framework: RegulatoryFramework;
  /** reference data and custom types, to group ICAO designators by class or type rating */
  types?: AircraftType[];
  /** how far back a type must have been flown to be followed (default 365 days) */
  activeDays?: number;
  /** EASA/CASA: a valid IR waives the night requirement */
  holdsIr?: boolean;
}

/** The rating a designator belongs to: its class or type rating when known, else the designator itself. */
export function ratingGroup(icao: string, types?: AircraftType[]): string {
  const t = types?.find((x) => x.icao.toUpperCase() === icao.toUpperCase());
  return t?.classOrTypeRating?.trim() || icao.toUpperCase();
}

const ldgAll = (f: Flight) => f.landingsDay + f.landingsNight;
const toAll = (f: Flight) => f.takeoffsDay + f.takeoffsNight;
const approaches = (f: Flight) => (f.approaches ?? []).reduce((s, a) => s + (a.count || 0), 0);

/** Day the N-th most recent event happened, walking flights newest first. */
function nthDate(desc: Flight[], n: number, count: (f: Flight) => number): string | undefined {
  let acc = 0;
  for (const f of desc) {
    acc += count(f);
    if (acc >= n) return f.date;
  }
  return undefined;
}

/** FAA "6 calendar months": valid through the last day of the 6th month after the month of the 6th approach. */
function endOfSixthMonth(date: string): string {
  const [y, m] = date.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m - 1 + 7, 0));
  return last.toISOString().slice(0, 10);
}

function item(
  kind: CurrencyKind,
  group: string,
  typesOf: string[],
  descAll: Flight[],
  today: string,
  required: number,
  tos: (f: Flight) => number,
  ldgs: (f: Flight) => number,
  windowStart: string,
  until: (limiting: string) => string,
): CurrencyItem {
  const win = descAll.filter((f) => f.date >= windowStart);
  const takeoffs = win.reduce((s, f) => s + tos(f), 0);
  const landings = win.reduce((s, f) => s + ldgs(f), 0);
  const valid = takeoffs >= required && landings >= required;
  let validUntil: string | undefined;
  if (valid) {
    const t = nthDate(descAll, required, tos)!;
    const l = nthDate(descAll, required, ldgs)!;
    validUntil = until(t < l ? t : l);
  }
  return {
    key: `${kind}:${group}`,
    kind,
    group,
    types: typesOf,
    required,
    takeoffs,
    landings,
    valid,
    validUntil,
    daysLeft: validUntil ? daysBetween(today, validUntil) : undefined,
    missingTakeoffs: Math.max(0, required - takeoffs),
    missingLandings: Math.max(0, required - landings),
    lastFlown: descAll.find((f) => !f.isFstd)?.date ?? descAll[0]?.date,
  };
}

/**
 * Every currency the pilot should watch today: passengers and night for each type/class flown in the last
 * year, and (FAA) the IFR check. Sorted with what lapses first on top.
 */
export function computeCurrency(flights: Flight[], today: string, opts: CurrencyOptions): CurrencyItem[] {
  const activeFrom = addDays(today, -(opts.activeDays ?? 365));
  const past = flights.filter((f) => !f.deletedAt && f.date <= today).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const designator = (f: Flight) => (f.isFstd ? f.fstdType : f.aircraftTypeIcao)?.trim().toUpperCase() || "";

  // group the designators flown recently by rating
  const groups = new Map<string, Set<string>>();
  for (const f of past) {
    if (f.date < activeFrom) break;
    const d = designator(f);
    if (!d) continue;
    const g = ratingGroup(d, opts.types);
    groups.set(g, (groups.get(g) ?? new Set()).add(d));
  }

  const out: CurrencyItem[] = [];
  const day90 = addDays(today, -89);
  const plus89 = (d: string) => addDays(d, 89);
  for (const [group, set] of groups) {
    const types = [...set].sort();
    const desc = past.filter((f) => set.has(designator(f)));
    out.push(item("passengers", group, types, desc, today, 3, toAll, ldgAll, day90, plus89));
    if (opts.framework === "FAA") {
      out.push(item("night", group, types, desc, today, 3, (f) => f.takeoffsNight, (f) => f.landingsNight, day90, plus89));
    } else if (!opts.holdsIr) {
      out.push(item("night", group, types, desc, today, 1, (f) => f.takeoffsNight, (f) => f.landingsNight, day90, plus89));
    }
    // HUD recency (Air France): 3 takeoffs and 3 landings with the HUD in 90 days, on a type flown with it
    if (desc.some((f) => (f.hudTakeoffs ?? 0) + (f.hudLandings ?? 0) > 0)) {
      out.push(item("hud", group, types, desc, today, 3, (f) => f.hudTakeoffs ?? 0, (f) => f.hudLandings ?? 0, day90, plus89));
    }
  }

  if (opts.framework === "FAA" && past.some((f) => approaches(f) > 0)) {
    // the 6 calendar months before this month, plus this month so far
    const [y, m] = today.split("-").map(Number) as [number, number];
    const start = new Date(Date.UTC(y, m - 1 - 6, 1)).toISOString().slice(0, 10);
    out.push(item("ifr", "all", [], past, today, 6, approaches, approaches, start, endOfSixthMonth));
  }

  return out.sort((a, b) => {
    if (a.valid !== b.valid) return a.valid ? 1 : -1;
    return (a.validUntil ?? "").localeCompare(b.validUntil ?? "") || a.group.localeCompare(b.group);
  });
}

/**
 * What the dashboard and the alerts surface: currencies lapsing within `days` (default 14), and lapsed ones
 * on a type the pilot still flies (flown in the last 90 days). A type left long ago is not an alert.
 */
export function currencyAlerts(items: CurrencyItem[], today: string, days = 14): CurrencyItem[] {
  const recent = addDays(today, -89);
  return items.filter((i) => (i.valid ? (i.daysLeft ?? Infinity) <= days : !!i.lastFlown && i.lastFlown >= recent));
}
