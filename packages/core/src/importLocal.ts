import type { LogbookLeg } from "./airFranceEp5";
import type { ImportedRow } from "./import";

/* ---------- Totals printed at the foot of each page of a paper logbook ---------- */

/** One page spread of a paper logbook, as read: how many legs it holds and the totals printed on it. */
export interface LogbookPageTotals {
  flights: number;
  /** flight time brought forward from the previous page (minutes); 0 on an empty first line, -1 when absent */
  broughtForwardMin: number;
  /** flight time carried forward at the foot of the page (minutes); -1 when absent */
  carriedForwardMin: number;
}

export interface PageTotalsCheck {
  /** flight time the pages' totals account for, and the flight time of the legs read */
  expectedMin: number;
  readMin: number;
  /** the pages whose legs do not add up to their totals: dates of their first and last leg */
  off: { from?: string; to?: string; expectedMin: number; readMin: number }[];
}

/** Flight time of a leg as written: its total, or the time of its function columns. */
const legMinutes = (l: LogbookLeg) => l.totalMin ?? (l.picMin ?? 0) + (l.dualMin ?? 0) + (l.copilotMin ?? 0) + (l.instructorMin ?? 0);
const isSim = (l: LogbookLeg) => (l.fstdMin ?? 0) > 0;

/**
 * The legs read from a paper logbook against the totals printed at the foot of its pages ("Totaux à reporter"
 * minus "Reports"): a row missed or a time misread shows as a page that does not add up. Null when the pages
 * carry no usable totals.
 */
export function checkPageTotals(legs: LogbookLeg[], pages: LogbookPageTotals[] | undefined): PageTotalsCheck | null {
  if (!pages?.length) return null;
  const flown = (ls: LogbookLeg[]) => ls.filter((l) => !isSim(l)).reduce((t, l) => t + legMinutes(l), 0);
  const sliced = pages.reduce((t, p) => t + Math.max(0, p.flights), 0) === legs.length;
  let expectedMin = 0;
  let readMin = 0;
  let counted = false;
  const off: PageTotalsCheck["off"] = [];
  let at = 0;
  let prevCarried = -1;
  for (const p of pages) {
    const mine = sliced ? legs.slice(at, at + Math.max(0, p.flights)) : [];
    at += Math.max(0, p.flights);
    const from = p.broughtForwardMin >= 0 ? p.broughtForwardMin : prevCarried;
    if (p.carriedForwardMin >= 0) prevCarried = p.carriedForwardMin;
    if (!sliced || from < 0 || p.carriedForwardMin < 0) continue;
    const expected = p.carriedForwardMin - from;
    const read = flown(mine);
    counted = true;
    expectedMin += expected;
    readMin += read;
    if (Math.abs(expected - read) > 1) {
      const dated = mine.filter((l) => /^\d{4}-\d{2}-\d{2}$/.test(l.date));
      off.push({ from: dated[0]?.date, to: dated[dated.length - 1]?.date, expectedMin: expected, readMin: read });
    }
  }
  if (counted) return { expectedMin, readMin, off };
  // the legs cannot be put back on their pages: the whole document against its first and last totals
  const first = pages.find((p) => p.broughtForwardMin >= 0)?.broughtForwardMin;
  const last = [...pages].reverse().find((p) => p.carriedForwardMin >= 0)?.carriedForwardMin;
  if (first === undefined || last === undefined) return null;
  const all = flown(legs);
  return { expectedMin: last - first, readMin: all, off: Math.abs(last - first - all) > 1 ? [{ expectedMin: last - first, readMin: all }] : [] };
}

/* ---------- Flights read without an airport (local flights of a paper logbook) ---------- */

type Row = ImportedRow & { excluded?: boolean };

/** A flight kept out of the import until the pilot gives its airfield. */
export const missingAirport = (r: Row) => !r.excluded && !!r.input && !r.input.isFstd && r.errors.includes("route");

const reg = (r: Row) => (r.input?.registration ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
const known = (r: Row) => !!r.input && !r.input.isFstd && !r.excluded && !!r.input.depIcao && !!r.input.arrIcao;

/**
 * The airfield a flight without one most likely left from, shown to the pilot to confirm, never filled in:
 * the one airport written on the row (a local flight), else the airport the same aircraft was at on the same
 * day — where the flight before it landed and the flight after it left, when they agree.
 */
export function localAirportSuggestion(rows: Row[], rowIndex: number): string | undefined {
  const at = rows.findIndex((r) => r.rowIndex === rowIndex);
  const r = rows[at];
  if (!r?.input) return undefined;
  const one = r.input.depIcao || r.input.arrIcao;
  if (one) return one;
  const same = (o: Row) => known(o) && o.input!.date === r.input!.date && !!reg(r) && reg(o) === reg(r);
  let before: string | undefined;
  for (let k = at - 1; k >= 0; k--) if (same(rows[k]!)) { before = rows[k]!.input!.arrIcao; break; }
  let after: string | undefined;
  for (let k = at + 1; k < rows.length; k++) if (same(rows[k]!)) { after = rows[k]!.input!.depIcao; break; }
  if (before && after) return before === after ? before : undefined;
  return before ?? after;
}

/** The other flights without an airport on the same aircraft, to give them the same airfield in one go. */
export function sameAircraftMissing(rows: Row[], rowIndex: number): Row[] {
  const r = rows.find((x) => x.rowIndex === rowIndex);
  if (!r || !reg(r)) return [];
  return rows.filter((o) => o.rowIndex !== rowIndex && missingAirport(o) && reg(o) === reg(r));
}

/** The checks of several readings of one logbook (photos sent in batches, PDFs read in parts) as one. */
export function mergePageChecks(checks: (PageTotalsCheck | null | undefined)[]): PageTotalsCheck | null {
  const ok = checks.filter((c): c is PageTotalsCheck => !!c);
  if (!ok.length) return null;
  return { expectedMin: ok.reduce((t, c) => t + c.expectedMin, 0), readMin: ok.reduce((t, c) => t + c.readMin, 0), off: ok.flatMap((c) => c.off) };
}
