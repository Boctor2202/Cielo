import type { RosterEvent, RosterEventKind } from "./types";
import { tzOffsetMs } from "./ical";

/**
 * Reader for the roster PDF printed by Leon ("Printed by Leon", columns Day / Aircraft Type / Check In /
 * Description / Check Out / Function / Crew / Block / Home Base), from the positioned text of its pages,
 * without any AI. Each day is a framed block whose date cell is centred vertically on the block's rows,
 * so rows are grouped into days by matching each block's centre to its date label.
 */

export interface PdfTextItem {
  x: number;
  y: number;
  s: string;
}

/** A duty as printed (same shape as the AI reader's output): times HH:MM, date of the start. */
export interface PrintedDuty {
  kind: RosterEventKind;
  date: string;
  report: string | null;
  start: string | null;
  end: string | null;
  endDayOffset: number;
  flightNumber: string | null;
  dep: string | null;
  arr: string | null;
  aircraftReg: string | null;
  aircraftType: string | null;
  title: string | null;
}

export interface PrintedRoster {
  timeBasis: "UTC" | "local";
  pilotName: string | null;
  events: PrintedDuty[];
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const MONTH_NAMES = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
const WEEKDAYS = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/;
const DATE_LABEL = /^(\d{1,2}) ([A-Z][a-z]{2})(?: (Mon|Tue|Wed|Thu|Fri|Sat|Sun))?$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const pad = (n: number) => String(n).padStart(2, "0");
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** True when the pages look like a Leon roster print. */
export function isLeonRoster(pages: PdfTextItem[][]): boolean {
  const all = pages.flat().map((i) => i.s.trim());
  return all.includes("Description") && all.includes("Function") && all.some((s) => s === "Check") && all.some((s) => DATE_LABEL.test(s));
}

/** Column x positions from the header row (first page), with defaults from Leon's layout. */
function columns(pages: PdfTextItem[][]) {
  const first = pages[0] ?? [];
  const at = (label: string, dflt: number) => first.find((i) => i.s.trim() === label)?.x ?? dflt;
  const desc = at("Description", 190);
  return {
    aircraftMax: at("Check", 127) - 4,
    checkIn: at("Check", 127),
    descMin: 150,
    descMax: desc + 30, // the time printed at ~200 still belongs to the description cell
    // Check Out header is the second "Check"
    checkOut: first.filter((i) => i.s.trim() === "Check").map((i) => i.x).sort((a, b) => a - b)[1] ?? 277,
    func: at("Function", 310),
    crew: at("Crew", 369),
    block: at("Block", 410),
  };
}

interface Row {
  y: number;
  items: PdfTextItem[];
}

/** Rows of the table body: items of the duty columns, grouped by baseline. */
function rowsOf(items: PdfTextItem[], headerY: number, xMin: number, xMax: number): Row[] {
  const body = items.filter((i) => i.y < headerY - 8 && i.x >= xMin && i.x < xMax).sort((a, b) => b.y - a.y);
  const rows: Row[] = [];
  for (const it of body) {
    const r = rows.find((x) => Math.abs(x.y - it.y) < 1.5);
    if (r) r.items.push(it);
    else rows.push({ y: it.y, items: [it] });
  }
  return rows.sort((a, b) => b.y - a.y);
}

export function parseLeonRoster(pages: PdfTextItem[][]): PrintedRoster | null {
  if (!isLeonRoster(pages)) return null;
  const all = pages.flat();
  const col = columns(pages);
  const timeBasis = all.some((i) => /all times in utc/i.test(i.s)) ? "UTC" : "local";

  // header values (first page): the item to the right of a label on the same line
  const head = pages[0] ?? [];
  const valueAfter = (label: string) => {
    const l = head.find((i) => i.s.trim() === label);
    if (!l) return null;
    return head.filter((i) => Math.abs(i.y - l.y) < 2 && i.x > l.x + 5).sort((a, b) => a.x - b.x)[0]?.s.trim() ?? null;
  };
  const year = Number(valueAfter("YEAR")) || new Date().getUTCFullYear();
  const headerMonth = MONTH_NAMES.indexOf((valueAfter("MONTH") ?? "").toUpperCase());
  const name = valueAfter("NAME")?.replace(/^[A-Z0-9]+\s*-\s*/, "") ?? null;
  const isoFor = (day: number, mon: string) => {
    const m = MONTHS.indexOf(mon.toUpperCase());
    let y = year;
    if (headerMonth === 11 && m === 0) y++;
    if (headerMonth === 0 && m === 11) y--;
    return `${y}-${pad(m + 1)}-${pad(day)}`;
  };

  type Code = { kind: "S" | "E"; code: string; date: string; time: string };
  const codes: Code[] = [];
  const events: PrintedDuty[] = [];

  for (const items of pages) {
    const header = items.find((i) => i.s.trim() === "Description");
    const headerY = header ? header.y : Infinity;

    // date labels, centred on their block: "14 Nov" with "Sat" underneath (or "20 Nov Fri" on one line)
    const labels = items
      .filter((i) => i.x < col.aircraftMax - 20 && DATE_LABEL.test(i.s.trim()) && i.y < headerY - 8)
      .map((i) => {
        const m = DATE_LABEL.exec(i.s.trim())!;
        const wd = m[3] ? null : items.find((w) => WEEKDAYS.test(w.s.trim()) && w.x < col.aircraftMax - 20 && i.y - w.y > 0 && i.y - w.y < 14);
        return { iso: isoFor(Number(m[1]), m[2]!), center: wd ? (i.y + wd.y) / 2 : i.y - 3 };
      })
      .sort((a, b) => b.center - a.center);
    if (!labels.length) continue;

    const rows = rowsOf(items, headerY, col.checkIn - 4, col.func - 4).filter((r) => r.items.some((i) => i.x >= col.descMin || TIME.test(i.s.trim())));
    const aircraftItems = items.filter((i) => i.x < col.aircraftMax && i.x > col.aircraftMax - 70 && /^[A-Z0-9]{2,4}\s+[A-Z0-9-]{3,10}$/.test(i.s.trim()) && i.y < headerY - 8);

    // group rows into day blocks: grow each block while its centre gets closer to the label
    let cursor = 0;
    labels.forEach((lab, li) => {
      if (cursor >= rows.length) return;
      const group: Row[] = [rows[cursor]!];
      cursor++;
      const centre = (g: Row[]) => (g[0]!.y + g[g.length - 1]!.y) / 2;
      while (cursor < rows.length) {
        const next = [...group, rows[cursor]!];
        const last = li === labels.length - 1;
        if (!last && Math.abs(centre(next) - lab.center) >= Math.abs(centre(group) - lab.center)) break;
        group.push(rows[cursor]!);
        cursor++;
      }
      const bandAircraft = aircraftItems.filter((a) => a.y <= group[0]!.y + 12 && a.y >= group[group.length - 1]!.y - 12);

      for (const row of group) {
        const cell = (x: number, w = 12) => row.items.find((i) => Math.abs(i.x - x) < w)?.s.trim() ?? null;
        const desc = row.items.filter((i) => i.x >= col.descMin && i.x < col.descMax).sort((a, b) => a.x - b.x);
        const descText = desc.map((d) => d.s.trim()).join(" ");
        const leg = /(\d{2}:\d{2})\s*([A-Z]{4}|[A-Z]{3})\b/.exec(descText);
        const afterDesc = row.items.filter((i) => i.x >= col.descMax).sort((a, b) => a.x - b.x);
        if (leg) {
          const arr = afterDesc.find((i) => /^[A-Z]{3,4}$/.test(i.s.trim()))?.s.trim() ?? null;
          const times = afterDesc.filter((i) => TIME.test(i.s.trim())).map((i) => i.s.trim());
          const end = times[0] ?? null;
          const report = cell(col.checkIn + 3, 10);
          // the function column is outside the row band (crew names wrap on several lines): look it up on the page
          const fn = items.find((i) => Math.abs(i.y - row.y) < 1.5 && Math.abs(i.x - (col.func + 20)) < 25 && /^[A-Z]{2,4}$/.test(i.s.trim()))?.s.trim() ?? null;
          const ac = bandAircraft.sort((a, b) => Math.abs(a.y - row.y) - Math.abs(b.y - row.y))[0]?.s.trim().split(/\s+/);
          const start = leg[1]!;
          events.push({
            kind: fn && /^(DH|PAX|POS)$/.test(fn) ? "DEADHEAD" : "FLIGHT",
            date: lab.iso,
            report: report && TIME.test(report) ? report : null,
            start,
            end,
            endDayOffset: end && end < start ? 1 : 0,
            flightNumber: null,
            dep: leg[2]!,
            arr,
            aircraftReg: ac?.[1] ?? null,
            aircraftType: ac?.[0] ?? null,
            title: null,
          });
          continue;
        }
        const code = /^([A-Z]{2,5})\b/.exec(descText)?.[1];
        if (!code) continue;
        // "ON 23:00 LFPB": the time sits in the description cell → start; "ON LFPB 22:59": after the airport → end
        const startTime = desc.map((d) => d.s.trim()).find((s) => TIME.test(s));
        const endTime = afterDesc.map((d) => d.s.trim()).find((s) => TIME.test(s));
        if (startTime) codes.push({ kind: "S", code, date: lab.iso, time: startTime });
        else if (endTime) codes.push({ kind: "E", code, date: lab.iso, time: endTime });
      }
    });
  }

  // pair each start with the next end of the same code: one event per stretch (e.g. a day on call)
  const kindOf = (code: string): RosterEventKind =>
    code === "OFF" ? "OFF" : code === "SIM" ? "SIM" : code === "LVE" || code === "LEAVE" || code === "VAC" ? "LEAVE" : /^(ON|SBY|RES|STBY|HSBY|ASBY)$/.test(code) ? "STANDBY" : code === "REST" ? "REST" : "OTHER";
  const used = new Set<number>();
  codes.forEach((c, i) => {
    if (used.has(i)) return;
    used.add(i);
    if (c.kind === "S") {
      const j = codes.findIndex((d, k) => k > i && !used.has(k) && d.kind === "E" && d.code === c.code);
      const e = j >= 0 ? codes[j]! : null;
      if (j >= 0) used.add(j);
      const endDate = e?.date ?? addDays(c.date, 1);
      events.push({ kind: kindOf(c.code), date: c.date, report: null, start: c.time, end: e?.time ?? "22:59", endDayOffset: Math.max(0, Math.min(2, daysBetween(c.date, endDate))), flightNumber: null, dep: null, arr: null, aircraftReg: null, aircraftType: null, title: c.code });
    } else {
      // an end whose start is before the printed period
      events.push({ kind: kindOf(c.code), date: c.date, report: null, start: "00:00", end: c.time, endDayOffset: 0, flightNumber: null, dep: null, arr: null, aircraftReg: null, aircraftType: null, title: c.code });
    }
  });

  events.sort((a, b) => `${a.date}${a.start ?? ""}`.localeCompare(`${b.date}${b.start ?? ""}`));
  return { timeBasis, pilotName: name, events };
}

const addDaysIso = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** A wall-clock time on a day, in a zone (or UTC when null), as an ISO instant. */
function wallInstant(date: string, time: string, tz: string | null | undefined): string {
  const [h, m] = time.split(":").map(Number) as [number, number];
  const [y, mo, d] = date.split("-").map(Number) as [number, number, number];
  const wall = Date.UTC(y, mo - 1, d, h, m);
  return new Date(tz ? wall - tzOffsetMs(tz, wall) : wall).toISOString();
}

/**
 * Duties as printed on a PDF roster → roster events in UTC (without id/timestamps: the caller stamps them).
 * Local times are converted with the airport's time zone, all-day items with the home base's.
 */
export function printedDutiesToEvents(
  list: PrintedDuty[],
  basis: "UTC" | "local",
  o: { pilotId: string; rosterId: string; toIcao: (code: string) => string; timezoneOf: (icao: string) => string | undefined; homeTimezone?: string },
): Omit<RosterEvent, "id" | "createdAt" | "updatedAt">[] {
  const home = o.homeTimezone ?? null;
  const out: Omit<RosterEvent, "id" | "createdAt" | "updatedAt">[] = [];
  for (const e of list) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) continue;
    const dep = e.dep?.trim() ? o.toIcao(e.dep.trim().toUpperCase()) : "";
    const arr = e.arr?.trim() ? o.toIcao(e.arr.trim().toUpperCase()) : "";
    const tzOf = (icao: string) => (basis === "UTC" ? null : (icao ? o.timezoneOf(icao) : undefined) ?? home);
    const startTz = tzOf(dep);
    const endTz = tzOf(arr || dep);
    const allDay = !e.start && !e.end;
    const startUtc = wallInstant(e.date, e.start ?? "00:00", allDay ? home : startTz);
    let endUtc = wallInstant(addDaysIso(e.date, e.endDayOffset || 0), e.end ?? "23:59", allDay ? home : endTz);
    // an end printed before the start without a day offset: it is the next day
    if (endUtc <= startUtc) endUtc = new Date(Date.parse(endUtc) + 86_400_000).toISOString();
    let reportUtc: string | null = null;
    if (e.report) {
      reportUtc = wallInstant(e.date, e.report, startTz);
      if (reportUtc > startUtc) reportUtc = new Date(Date.parse(reportUtc) - 86_400_000).toISOString();
    }
    out.push({
      pilotId: o.pilotId,
      rosterId: o.rosterId,
      kind: e.kind,
      title: e.title || [e.flightNumber, dep && arr ? `${dep}-${arr}` : ""].filter(Boolean).join(" ") || undefined,
      reportUtc,
      startUtc,
      endUtc,
      flightNumber: e.flightNumber || undefined,
      depIcao: dep || undefined,
      arrIcao: arr || undefined,
      aircraftReg: e.aircraftReg?.toUpperCase() || undefined,
      aircraftTypeIcao: e.aircraftType?.toUpperCase() || undefined,
      flightId: null,
    });
  }
  return out;
}
