import type { FlightFormInput } from "./flight";
import type { ImportedRow } from "./import";
import type { PdfTextItem } from "./leon";

/**
 * Air France's monthly "CARNET DE VOL - EP5" (PDF): one line per leg with the aircraft (type code, registration
 * without its "F-"), the departure and arrival stations (IATA) and times written "day | decimal hours"
 * ("02 | 14.63" = the 2nd at 14:38), then the flight time, its day and night parts, in decimal hours.
 * The month comes from the header ("SEPTEMBRE 2026").
 */

export interface Ep5Leg {
  date: string;
  dep: string;
  arr: string;
  /** HH:MM */
  out: string;
  in: string;
  arrDate: string;
  totalMin: number;
  dayMin?: number;
  nightMin?: number;
  registration: string;
  typeCode: string;
  nature: string;
}

export interface Ep5 {
  pilot?: string;
  role?: string;
  legs: Ep5Leg[];
}

const MOIS = ["JANVIER", "FEVRIER", "MARS", "AVRIL", "MAI", "JUIN", "JUILLET", "AOUT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DECEMBRE"];
const plain = (s: string) => s.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const dec = (h: string) => Math.round(Number(h) * 60);
const clock = (h: string) => {
  const m = Math.round(Number(h) * 60);
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** Lines of a page: items grouped by their baseline, left to right. */
function lines(items: PdfTextItem[]): PdfTextItem[][] {
  const rows: PdfTextItem[][] = [];
  for (const it of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const row = rows.find((r) => Math.abs(r[0]!.y - it.y) < 2.5);
    if (row) row.push(it);
    else rows.push([it]);
  }
  return rows.map((r) => r.sort((a, b) => a.x - b.x));
}

export function isAirFranceEp5(pages: PdfTextItem[][]): boolean {
  const text = plain(pages.flat().map((i) => i.s).join(" "));
  return /CARNET DE VOL/.test(text) && /EP\s?5/.test(text);
}

const LEG = /^(\d+)\s+(\S+)\s+([A-Z0-9]{4,5})\s+([A-Z]{3})\s+([A-Z]{3})\s+(\d{1,2})\s*[|I¦l]?\s*(\d{1,2}\.\d{2})\s+([A-Z]{3})\s+(\d{1,2})\s*[|I¦l]?\s*(\d{1,2}\.\d{2})\s+(\d{1,2}\.\d{2})/;

export function parseAirFranceEp5(pages: PdfTextItem[][]): Ep5 | null {
  if (!isAirFranceEp5(pages)) return null;
  const out: Ep5 = { legs: [] };
  const seen = new Set<string>();
  for (const page of pages) {
    const text = plain(page.map((i) => i.s).join(" "));
    if (!/CARNET DE VOL/.test(text)) continue;
    const mm = new RegExp(`(${MOIS.join("|")})\\s+(\\d{4})`).exec(text);
    if (!mm) continue;
    const month = MOIS.indexOf(mm[1]!) + 1;
    const year = Number(mm[2]);
    const rows = lines(page);
    // where the "Jour" and "Nuit" columns are, to tell a lone figure's column
    const head = rows.find((r) => r.some((i) => plain(i.s) === "JOUR") && r.some((i) => plain(i.s) === "NUIT"));
    const xJour = head?.find((i) => plain(i.s) === "JOUR")?.x;
    const xNuit = head?.find((i) => plain(i.s) === "NUIT")?.x;
    if (!out.pilot) {
      const p = /OPL|CDB|CDT|OPL\s?\d+%/.exec(text);
      if (p) out.role = p[0].slice(0, 3);
    }
    for (const r of rows) {
      const joined = r.map((i) => i.s.trim()).join(" ").replace(/\s+/g, " ");
      const m = LEG.exec(joined);
      if (!m) continue;
      const [, nature, typeCode, reg, , dep, d1, h1, arr, d2, h2, total] = m;
      const day1 = Number(d1);
      const day2 = Number(d2);
      const date = `${year}-${String(month).padStart(2, "0")}-${String(day1).padStart(2, "0")}`;
      // the arrival is in the next month when its day is smaller
      const am = day2 < day1 ? (month % 12) + 1 : month;
      const ay = day2 < day1 && month === 12 ? year + 1 : year;
      const arrDate = `${ay}-${String(am).padStart(2, "0")}-${String(day2).padStart(2, "0")}`;
      // the figures after the total: in the Jour or Nuit column by their position
      const totalItem = r.find((i) => i.s.trim() === total && i.x > (r.find((x) => x.s.includes(arr!))?.x ?? 0));
      const after = r.filter((i) => totalItem && i.x > totalItem.x + 1 && /^\d{1,2}\.\d{2}$/.test(i.s.trim()));
      let dayMin: number | undefined;
      let nightMin: number | undefined;
      for (const it of after) {
        const v = dec(it.s.trim());
        if (xJour !== undefined && xNuit !== undefined) {
          if (Math.abs(it.x - xNuit) < Math.abs(it.x - xJour) && it.x < xNuit + (xNuit - xJour)) nightMin = v;
          else if (Math.abs(it.x - xJour) <= Math.abs(it.x - xNuit)) dayMin = v;
        } else if (dayMin === undefined) dayMin = v;
        else if (nightMin === undefined) nightMin = v;
      }
      const totalMin = dec(total!);
      if (nightMin === undefined && dayMin !== undefined) nightMin = Math.max(0, totalMin - dayMin);
      const key = `${date}|${dep}|${arr}|${h1}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.legs.push({
        date,
        arrDate,
        dep: dep!,
        arr: arr!,
        out: clock(h1!),
        in: clock(h2!),
        totalMin,
        dayMin,
        nightMin,
        registration: reg!.length === 4 ? `F-${reg}` : reg!,
        typeCode: typeCode!,
        nature: nature!,
      });
    }
  }
  return out.legs.length ? out : null;
}

/** A logged leg read from a document (any reader): times HH:MM UTC, durations in minutes, airports IATA or ICAO. */
export interface LogbookLeg {
  date: string;
  dep: string;
  arr: string;
  out?: string;
  in?: string;
  totalMin?: number;
  nightMin?: number;
  registration?: string;
  aircraftType?: string;
  flightNumber?: string;
  /** PIC, SIC… when the document says */
  function?: string;
  picName?: string;
}

export const ep5Legs = (ep5: Ep5): LogbookLeg[] => ep5.legs.map((l) => ({ date: l.date, dep: l.dep, arr: l.arr, out: l.out, in: l.in, totalMin: l.totalMin, nightMin: l.nightMin, registration: l.registration }));

const FUNCTIONS = ["PIC", "PICUS", "SIC", "DUAL", "FI", "FE"];

/** Legs as import rows (the document's totals win over computed values). */
export function legsToRows(legs: LogbookLeg[], toIcao: (code: string) => string | undefined, base: Pick<FlightFormInput, "function" | "pilotFlying">): ImportedRow[] {
  return legs.map((l, i) => {
    const dep = toIcao(l.dep);
    const arr = toIcao(l.arr);
    const errors: string[] = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(l.date)) errors.push("date");
    if (!dep) errors.push(`unknown airport ${l.dep}`);
    if (!arr) errors.push(`unknown airport ${l.arr}`);
    const fn = l.function && FUNCTIONS.includes(l.function.toUpperCase()) ? (l.function.toUpperCase() as FlightFormInput["function"]) : base.function;
    const input: FlightFormInput = {
      date: l.date,
      depIcao: dep ?? l.dep,
      arrIcao: arr ?? l.arr,
      out: l.out,
      in: l.in,
      registration: l.registration,
      aircraftTypeIcao: l.aircraftType && /^[A-Z][A-Z0-9]{1,3}$/.test(l.aircraftType) ? l.aircraftType : undefined,
      flightNumber: l.flightNumber,
      function: fn,
      picName: l.picName,
      pilotFlying: base.pilotFlying,
      ifr: true,
      isFstd: false,
      operation: "multi_pilot",
      autoLandings: false,
      takeoffsDay: 0,
      takeoffsNight: 0,
      landingsDay: 0,
      landingsNight: 0,
    };
    return { rowIndex: i, input, explicit: { total: l.totalMin, night: l.nightMin }, errors };
  });
}
