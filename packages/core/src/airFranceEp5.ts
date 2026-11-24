import { normalizeRegistration } from "./registration";
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
  /** the line number (EP4), e.g. 1168 */
  line?: string;
  /** the "situation à bord" (SAB) code, e.g. "JHD": its middle letter says who took off and landed */
  sab?: string;
}

/**
 * The middle letter of the SAB code: H takeoff and landing with the HUD, B takeoff and landing without it,
 * T takeoff only, L landing only, G takeoff only with the HUD, K landing only with the HUD. Any other letter:
 * the pilot did neither (pilot monitoring, relief, positioning).
 */
export function sabLandings(sab: string | undefined): { takeoffs: number; landings: number; hud: boolean } | null {
  const c = sab && /^[A-Z]{3}$/.test(sab) ? sab[1] : undefined;
  if (!c) return null;
  const takeoffs = "HBTG".includes(c) ? 1 : 0;
  const landings = "HBLK".includes(c) ? 1 : 0;
  return { takeoffs, landings, hud: "HGK".includes(c) };
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
  return (/CARNET DE VOL/.test(text) && /EP\s?5/.test(text)) || isEp4(text);
}

/**
 * The EP4 ("FEUILLE HORAIRE D'ACTIVITE"), the same month as the EP5 laid out for pay: each leg has its actual
 * and scheduled times, then its actual flight time; day and night are not split per leg (the night figure on
 * a duty's last line is the whole duty's), so the logbook works night out itself.
 */
const isEp4 = (text: string) => /FEUILLE HORAIRE/.test(text) && /EP\s?4/.test(text);
const DH = "(\\d{1,2})\\s*[|I¦l]?\\s*(\\d{1,2}\\.\\d{2})";
const DH_ = "\\d{1,2}\\s*[|I¦l]?\\s*\\d{1,2}\\.\\d{2}";
// nature, line number, type, registration, SAB code, departure, actual, scheduled, arrival, actual, scheduled, flight time
const LEG4 = new RegExp(`^(\\d(?:\\s?\\d)?)\\s+(\\S+)\\s+(\\S+)\\s+([A-Z0-9]{4,5})\\s+([A-Z]{3})\\s+([A-Z]{3})\\s+${DH}\\s+${DH_}\\s+([A-Z]{3})\\s+${DH}\\s+${DH_}\\s+(\\d{1,2}\\.\\d{2})`);

const LEG = /^(\d+)\s+(\S+)\s+([A-Z0-9]{4,5})\s+([A-Z]{3})\s+([A-Z]{3})\s+(\d{1,2})\s*[|I¦l]?\s*(\d{1,2}\.\d{2})\s+([A-Z]{3})\s+(\d{1,2})\s*[|I¦l]?\s*(\d{1,2}\.\d{2})\s+(\d{1,2}\.\d{2})/;

export function parseAirFranceEp5(pages: PdfTextItem[][]): Ep5 | null {
  if (!isAirFranceEp5(pages)) return null;
  const out: Ep5 = { legs: [] };
  const seen = new Set<string>();
  for (const page of pages) {
    const text = plain(page.map((i) => i.s).join(" "));
    const ep4 = isEp4(text);
    if (!/CARNET DE VOL/.test(text) && !ep4) continue;
    // the statement's month, not the day it was printed ("EDITE LE 29 OCTOBRE 2026")
    const mm = [...text.matchAll(new RegExp(`(\\d{1,2}\\s+)?(${MOIS.join("|")})\\s+(\\d{4})`, "g"))].map((x) => [x[0], x[2], x[3]] as const).find((x) => !/^\d/.test(x[0]));
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
      let line: string | undefined;
      let m = LEG.exec(joined);
      if (ep4) {
        const q = LEG4.exec(joined);
        // the same groups as an EP5 line
        line = q?.[2];
        m = q ? ([q[0], q[1], q[3], q[4], q[5], q[6], q[7], q[8], q[9], q[10], q[11], q[12]] as unknown as RegExpExecArray) : null;
      }
      if (!m) continue;
      const [, nature, typeCode, reg, sab, dep, d1, h1, arr, d2, h2, total] = m;
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
      for (const it of ep4 ? [] : after) {
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
        line,
        sab,
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
  off?: string;
  on?: string;
  in?: string;
  totalMin?: number;
  nightMin?: number;
  ifrMin?: number;
  /** time per function, when the document has those columns (paper logbooks) */
  picMin?: number;
  copilotMin?: number;
  dualMin?: number;
  instructorMin?: number;
  multiPilotMin?: number;
  /** cross-country time */
  xcMin?: number;
  landingsDay?: number;
  landingsNight?: number;
  /** takeoffs and landings by the pilot, not split day/night: the logbook splits them by the sun */
  takeoffs?: number;
  landings?: number;
  /** of those, flown with the head-up display */
  hudTakeoffs?: number;
  hudLandings?: number;
  registration?: string;
  aircraftType?: string;
  flightNumber?: string;
  /** PIC, SIC… when the document says */
  function?: string;
  picName?: string;
  remarks?: string;
  /** a simulator (FSTD) session: device type and session time, instead of a flight */
  fstdType?: string;
  fstdMin?: number;
}

export const ep5Legs = (ep5: Ep5): LogbookLeg[] =>
  ep5.legs.map((l) => {
    const sab = sabLandings(l.sab);
    return {
      date: l.date, dep: l.dep, arr: l.arr, out: l.out, in: l.in, totalMin: l.totalMin, nightMin: l.nightMin, registration: l.registration,
      flightNumber: l.line && /^\d{1,4}[A-Z]?$/.test(l.line) ? `AF${l.line}` : undefined,
      ...(sab ? { takeoffs: sab.takeoffs, landings: sab.landings, hudTakeoffs: sab.hud ? sab.takeoffs : 0, hudLandings: sab.hud ? sab.landings : 0 } : {}),
    };
  });

const FUNCTIONS = ["PIC", "PICUS", "SIC", "DUAL", "FI", "FE"];

/** Legs as import rows (the document's totals win over computed values). */
/** Characters a handwritten or scanned code is often misread as (0/O, 1/I/L, 5/S, 8/B…). */
const LOOK_ALIKE: Record<string, string[]> = {
  "0": ["O", "D"], O: ["0", "D", "Q"], D: ["O", "0"], Q: ["O"], "1": ["I", "L"], I: ["1", "L", "T"], L: ["1", "I"], T: ["I", "F"],
  "5": ["S"], S: ["5"], "8": ["B"], B: ["8", "R"], R: ["B", "P"], P: ["F", "R"], F: ["P", "E", "T"], E: ["F"], "2": ["Z"], Z: ["2"],
  "6": ["G"], G: ["6", "C"], C: ["G"], X: ["K"], K: ["X"], U: ["V"], V: ["U"], N: ["M", "H"], M: ["N"], H: ["N"],
};

/**
 * An airport code as read, made a known airport: as written, else the only look-alike reading that is a known
 * airport (preferring one already used in the same document). Unknown codes are kept as written, to check.
 */
function resolveAirport(raw: string, toIcao: (code: string) => string | undefined, used: Set<string>): { code: string; known: boolean } {
  const c = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!c) return { code: "", known: false };
  const direct = toIcao(c);
  if (direct) return { code: direct, known: true };
  const found = new Set<string>();
  for (let i = 0; i < c.length; i++)
    for (const alt of LOOK_ALIKE[c[i]!] ?? []) {
      const v = toIcao(c.slice(0, i) + alt + c.slice(i + 1));
      if (v) found.add(v);
    }
  const inDoc = [...found].filter((v) => used.has(v));
  if (inDoc.length === 1) return { code: inDoc[0]!, known: true };
  if (found.size === 1) return { code: [...found][0]!, known: true };
  return { code: c, known: false };
}

export { normalizeRegistration };

/**
 * Legs read from a document, as rows to import. `airline`: an airline statement (EP5…), where every leg is a
 * multi-pilot IFR flight; otherwise (a paper logbook, an e-mail) IFR and multi-pilot come from the document or,
 * when it does not say, from the aircraft type — never assumed.
 */
export function legsToRows(legs: LogbookLeg[], toIcao: (code: string) => string | undefined, base: Pick<FlightFormInput, "function" | "pilotFlying"> & { airline?: boolean }): ImportedRow[] {
  // airports read without doubt in this document: a misread code is matched to one of them first
  const used = new Set(legs.flatMap((l) => [toIcao((l.dep ?? "").trim().toUpperCase()), toIcao((l.arr ?? "").trim().toUpperCase())]).filter((c): c is string => !!c));
  return legs.map((l, i) => {
    // a simulator session (FNPT II, FFS…) has no airports
    const sim = (l.fstdMin ?? 0) > 0;
    const d = resolveAirport(l.dep ?? "", toIcao, used);
    const a = resolveAirport(l.arr ?? "", toIcao, used);
    const dep = sim ? "FSTD" : d.code;
    const arr = sim ? "FSTD" : a.code;
    const errors: string[] = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(l.date)) errors.push("date");
    // a missing airport leaves the flight out; an unknown one is kept as written, to check
    if (!sim && (!dep || !arr)) errors.push("route");
    const fn = l.function && FUNCTIONS.includes(l.function.toUpperCase()) ? (l.function.toUpperCase() as FlightFormInput["function"]) : base.function;
    const input: FlightFormInput = {
      date: l.date,
      depIcao: dep,
      arrIcao: arr,
      out: l.out,
      off: l.off,
      on: l.on,
      in: l.in,
      registration: sim ? undefined : normalizeRegistration(l.registration),
      remarks: l.remarks,
      aircraftTypeIcao: l.aircraftType && /^[A-Z][A-Z0-9]{1,3}$/.test(l.aircraftType) ? l.aircraftType : undefined,
      flightNumber: l.flightNumber,
      function: fn,
      picName: l.picName,
      // the SAB code says the pilot took off or landed: pilot flying
      pilotFlying: l.takeoffs || l.landings ? true : base.pilotFlying,
      ifr: base.airline ? true : (l.ifrMin ?? 0) > 0,
      xcMin: l.xcMin,
      isFstd: sim,
      fstdType: sim ? l.fstdType || undefined : undefined,
      fstdMin: sim ? l.fstdMin : undefined,
      operation: l.multiPilotMin !== undefined ? (l.multiPilotMin > 0 ? "multi_pilot" : "single_pilot") : base.airline ? "multi_pilot" : undefined,
      // counted takeoffs and landings, split day and night by the sun at each end
      autoLandings: l.takeoffs !== undefined || l.landings !== undefined,
      takeoffs: l.takeoffs,
      landings: l.landings,
      hudTakeoffs: l.hudTakeoffs || undefined,
      hudLandings: l.hudLandings || undefined,
      takeoffsDay: l.landingsDay ?? 0,
      takeoffsNight: l.landingsNight ?? 0,
      landingsDay: l.landingsDay ?? 0,
      landingsNight: l.landingsNight ?? 0,
    };
    return {
      rowIndex: i,
      input,
      warnings: !sim && ((dep && !d.known) || (arr && !a.known)) ? ["airport"] : undefined,
      explicit: { total: l.totalMin, night: l.nightMin, ifr: l.ifrMin, pic: l.picMin, copilot: l.copilotMin, dual: l.dualMin, instructor: l.instructorMin, multiPilot: l.multiPilotMin, xc: l.xcMin },
      errors,
    };
  });
}
