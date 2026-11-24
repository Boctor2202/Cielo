import { addDays } from "./time";
import type { Flight, OpeningBalance } from "./types";

export interface Totals {
  flights: number;
  totalMin: number;
  airMin: number;
  singlePilotSeMin: number;
  singlePilotMeMin: number;
  multiPilotMin: number;
  picMin: number;
  picusMin: number;
  copilotMin: number;
  dualMin: number;
  instructorMin: number;
  examinerMin: number;
  nightMin: number;
  ifrMin: number;
  actualImcMin: number;
  xcMin: number;
  takeoffsDay: number;
  takeoffsNight: number;
  landingsDay: number;
  landingsNight: number;
  approaches: number;
  fstdSessions: number;
  fstdMin: number;
  /* entries some authorities require beyond EASA */
  simInstrumentMin: number;
  holdings: number;
  hudTakeoffs: number;
  hudLandings: number;
  groundTrainingMin: number;
  soloMin: number;
}

export const ZERO_TOTALS: Totals = Object.freeze({
  flights: 0, totalMin: 0, airMin: 0, singlePilotSeMin: 0, singlePilotMeMin: 0, multiPilotMin: 0, picMin: 0,
  picusMin: 0, copilotMin: 0, dualMin: 0, instructorMin: 0, examinerMin: 0, nightMin: 0, ifrMin: 0,
  actualImcMin: 0, xcMin: 0, takeoffsDay: 0, takeoffsNight: 0, landingsDay: 0, landingsNight: 0, approaches: 0,
  fstdSessions: 0, fstdMin: 0, simInstrumentMin: 0, holdings: 0, hudTakeoffs: 0, hudLandings: 0, groundTrainingMin: 0, soloMin: 0,
}) as Totals;

const SUM_KEYS = [
  "totalMin", "airMin", "singlePilotSeMin", "singlePilotMeMin", "multiPilotMin", "picMin", "picusMin", "copilotMin",
  "dualMin", "instructorMin", "examinerMin", "nightMin", "ifrMin", "actualImcMin", "xcMin", "takeoffsDay",
  "takeoffsNight", "landingsDay", "landingsNight", "fstdMin", "simInstrumentMin", "holdings", "hudTakeoffs", "hudLandings", "groundTrainingMin", "soloMin",
] as const;

export function sumFlights(flights: Flight[], base: Totals = ZERO_TOTALS): Totals {
  const t: Totals = { ...base };
  for (const f of flights) {
    if (f.deletedAt) continue;
    for (const k of SUM_KEYS) t[k] += (f[k] as number) || 0;
    t.approaches += (f.approaches ?? []).reduce((s, a) => s + (a.count || 0), 0);
    if (f.isFstd) t.fstdSessions++;
    else t.flights++;
  }
  return t;
}

export function openingTotals(balances: OpeningBalance[]): Totals {
  const t: Totals = { ...ZERO_TOTALS };
  for (const b of balances) {
    if (b.deletedAt) continue;
    t.totalMin += b.totalMin;
    t.singlePilotSeMin += b.singlePilotSeMin;
    t.singlePilotMeMin += b.singlePilotMeMin;
    t.multiPilotMin += b.multiPilotMin;
    t.picMin += b.picMin;
    t.copilotMin += b.copilotMin;
    t.dualMin += b.dualMin;
    t.instructorMin += b.instructorMin;
    t.nightMin += b.nightMin;
    t.ifrMin += b.ifrMin;
    t.landingsDay += b.landingsDay;
    t.landingsNight += b.landingsNight;
    t.fstdMin += b.fstdMin;
  }
  return t;
}

export function addTotals(a: Totals, b: Totals): Totals {
  const t = { ...a };
  for (const k of Object.keys(t) as (keyof Totals)[]) t[k] = a[k] + b[k];
  return t;
}

/** Flights whose date is within the last `days` days (inclusive of today). */
export function flightsInLastDays(flights: Flight[], days: number, today: string): Flight[] {
  const from = addDays(today, -(days - 1));
  return flights.filter((f) => !f.deletedAt && f.date >= from && f.date <= today);
}

export interface DashboardPeriods {
  d28: Totals;
  d90: Totals;
  m12: Totals;
  year: Totals;
  all: Totals;
}

export function dashboardPeriods(flights: Flight[], balances: OpeningBalance[], today: string): DashboardPeriods {
  return {
    d28: sumFlights(flightsInLastDays(flights, 28, today)),
    d90: sumFlights(flightsInLastDays(flights, 90, today)),
    m12: sumFlights(flightsInLastDays(flights, 365, today)),
    year: sumFlights(flights.filter((f) => f.date.slice(0, 4) === today.slice(0, 4))),
    all: sumFlights(flights, openingTotals(balances)),
  };
}

export type GroupKey = "aircraftTypeIcao" | "registration" | "function" | "year" | "month" | "airport";

/** Block minutes and flight counts grouped by a dimension, sorted by minutes desc. */
export function groupTotals(flights: Flight[], key: GroupKey): { key: string; minutes: number; flights: number }[] {
  const map = new Map<string, { minutes: number; flights: number }>();
  const add = (k: string, f: Flight) => {
    const e = map.get(k) ?? { minutes: 0, flights: 0 };
    e.minutes += f.isFstd ? f.fstdMin : f.totalMin;
    e.flights++;
    map.set(k, e);
  };
  for (const f of flights) {
    if (f.deletedAt) continue;
    switch (key) {
      case "year": add(f.date.slice(0, 4), f); break;
      case "month": add(f.date.slice(0, 7), f); break;
      case "airport": if (!f.isFstd) { add(f.depIcao, f); if (f.arrIcao !== f.depIcao) add(f.arrIcao, f); } break;
      default: add(String((f[key] as string | undefined) || (f.isFstd ? "FSTD" : "—")), f);
    }
  }
  return [...map.entries()].map(([k, v]) => ({ key: k, ...v })).sort((a, b) => b.minutes - a.minutes);
}
