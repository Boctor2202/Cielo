/**
 * Logbook files exported by other apps, made ready for the column detection of import.ts: the header row is
 * found (title lines skipped), app-specific layouts are flattened and the app is named for the pilot.
 *  - ForeFlight: one CSV with an "Aircraft Table" then a "Flights Table"; the aircraft type comes from the
 *    aircraft table (AircraftID → TypeCode / Model) and is added to each flight as an "Aircraft Type" column.
 *  - LogTen Pro: tab-separated with columns named "flight_from", "flight_totalTime"…: the prefixes are dropped.
 *  - MyFlightbook and others with a single "Route" column ("LFPB LFMN", "LFPB-LFMN"): split into From / To.
 *  - mccPILOTLOG, CrewLounge, Flylog, Logbook Pro, APDL, Safelog: plain tables, recognised by their column names.
 */

export type LogbookApp = "ForeFlight" | "LogTen" | "mccPILOTLOG" | "CrewLounge" | "MyFlightbook" | "Flylog" | "LogbookPro" | "APDL" | "Safelog";

export interface PreparedTable {
  header: string[];
  rows: string[][];
  /** the app the file was exported from, when recognised */
  app?: LogbookApp;
}

const lc = (s: string) => s.trim().toLowerCase();
const looksLikeHeader = (r: string[]) => {
  const cells = r.map(lc).filter(Boolean);
  if (cells.length < 3) return false;
  const known = ["date", "from", "to", "dep", "arr", "departure", "arrival", "total", "aircraft", "registration", "tail", "pic", "night", "time", "route", "flight"];
  return cells.filter((c) => known.some((k) => c.includes(k))).length >= 3;
};

function detectApp(header: string[], raw: string[][]): LogbookApp | undefined {
  const h = header.map(lc);
  const has = (re: RegExp) => h.some((x) => re.test(x));
  const firstCells = raw.slice(0, 5).map((r) => lc(r[0] ?? ""));
  if (firstCells.some((c) => c.includes("foreflight"))) return "ForeFlight";
  // LogTen names its columns flight_flightDate, flight_from… (Flylog's FLIGHT_NUMBER is not one of them)
  if (has(/^flight_(flightdate|from|to|totaltime)$/) || has(/^aircraft_aircraftid$/)) return "LogTen";
  if (has(/^duration_block$/) || has(/^time_block_start$/)) return "Flylog";
  if (has(/^pilotlog_date$/) || has(/^is_prevexp$/) || has(/crewlounge/)) return "CrewLounge";
  if (has(/^mcc_|pilotlog/)) return "mccPILOTLOG";
  if (has(/^holder's operating capacity$/) || has(/^day t-o$/)) return "Safelog";
  if (has(/^category\/class$/) && has(/^tail number$/)) return "MyFlightbook";
  if (has(/flylog/)) return "Flylog";
  if (has(/^apdl/)) return "APDL";
  if (has(/safelog/)) return "Safelog";
  return undefined;
}

/** Splits a route ("LFPB LFMN", "LFPB-LIML-LFPB", "LFPB → LFMN") into its first and last airport. */
export function splitRoute(route: string): [string, string] | null {
  const codes = route.toUpperCase().match(/\b[A-Z0-9]{3,4}\b/g)?.filter((c) => /[A-Z]/.test(c)) ?? [];
  if (codes.length < 2) return null;
  return [codes[0]!, codes[codes.length - 1]!];
}

export function prepareLogbookTable(raw: string[][]): PreparedTable {
  const rows = raw.filter((r) => r.some((c) => c.trim()));

  // ForeFlight: two sections in one file
  const flightsAt = rows.findIndex((r) => /^flights table/i.test((r[0] ?? "").trim()));
  if (flightsAt >= 0) {
    const aircraftAt = rows.findIndex((r) => /^aircraft table/i.test((r[0] ?? "").trim()));
    const typeOf = new Map<string, string>();
    if (aircraftAt >= 0 && aircraftAt < flightsAt) {
      const ah = (rows[aircraftAt + 1] ?? []).map(lc);
      const id = ah.indexOf("aircraftid");
      const tc = ah.indexOf("typecode");
      const model = ah.indexOf("model");
      for (const r of rows.slice(aircraftAt + 2, flightsAt)) {
        const k = (r[id] ?? "").trim();
        const v = ((tc >= 0 ? r[tc] : "") || (model >= 0 ? r[model] : "") || "").trim();
        if (k && v) typeOf.set(k.toUpperCase(), v);
      }
    }
    const header = [...(rows[flightsAt + 1] ?? [])];
    const idCol = header.map(lc).indexOf("aircraftid");
    const body = rows.slice(flightsAt + 2).map((r) => [...r, idCol >= 0 ? typeOf.get((r[idCol] ?? "").trim().toUpperCase()) ?? "" : ""]);
    header.push("Aircraft Type");
    return withRoute({ header, rows: body, app: "ForeFlight" });
  }

  // other files: the header is the first row that looks like one (title lines before it are skipped)
  const at = Math.max(0, rows.findIndex(looksLikeHeader));
  const header = (rows[at] ?? []).map((c) => c.trim());
  const app = detectApp(header, rows);
  const cleanHeader = app === "LogTen" ? header.map((c) => c.replace(/^(flight|aircraft|aircraftType|pilot)_/i, "")) : header;
  if (app === "Safelog") return withRoute(sumSplitColumns({ header: cleanHeader, rows: rows.slice(at + 1), app }));
  return withRoute({ header: cleanHeader, rows: rows.slice(at + 1), app });
}

const toMin = (v: string) => {
  const m = v.trim().match(/^(\d+):(\d{2})$/) ?? v.trim().match(/^(\d+)[.,](\d+)$/);
  if (!m) return 0;
  return v.includes(":") ? +m[1]! * 60 + +m[2]! : Math.round(parseFloat(`${m[1]}.${m[2]}`) * 60);
};
const hhmm = (n: number) => (n ? `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}` : "");

/**
 * Safelog (EASA layout) splits each function time by day / night and single / multi-engine ("Night Multi-Engine
 * (ME) Co-Pilot"): the parts are added up into one column per function, plus the night time, and the split
 * columns are dropped so no single part is read as the whole.
 */
function sumSplitColumns(t: PreparedTable): PreparedTable {
  const groups: [string, RegExp][] = [
    ["PIC", /\bin command\b/i],
    ["PICUS", /\bpicus\b/i],
    ["Dual", /\bdual\b/i],
    ["Co-pilot", /\b(co-?pilot|p2)\b/i],
  ];
  const split = (h: string) => /^(day|night)\b.*\b(single|multi)-engine\b/i.test(h);
  const idx = t.header.map((h, i) => (split(h) ? i : -1)).filter((i) => i >= 0);
  if (!idx.length) return t;
  const keep = t.header.map((_, i) => i).filter((i) => !idx.includes(i));
  const header = [...keep.map((i) => t.header[i]!), ...groups.map(([name]) => name), "Night"];
  const rows = t.rows.map((r) => {
    const sums = groups.map(([, re]) => idx.filter((i) => re.test(t.header[i]!)).reduce((n, i) => n + toMin(r[i] ?? ""), 0));
    const night = idx.filter((i) => /^night\b/i.test(t.header[i]!)).reduce((n, i) => n + toMin(r[i] ?? ""), 0);
    return [...keep.map((i) => r[i] ?? ""), ...sums.map(hhmm), hhmm(night)];
  });
  return { ...t, header, rows };
}

/** A single route column and no From / To columns: add them from the route. */
function withRoute(t: PreparedTable): PreparedTable {
  const h = t.header.map(lc);
  const hasDep = h.some((x) => /^(from|dep|departure|origin|af_dep|depart)/.test(x));
  const hasArr = h.some((x) => /^(to|arr|arrival|destination|af_arr|arrivee)/.test(x));
  const route = h.findIndex((x) => x === "route");
  if (route < 0 || (hasDep && hasArr)) return t;
  return {
    ...t,
    header: [...t.header, "From", "To"],
    rows: t.rows.map((r) => {
      const s = splitRoute(r[route] ?? "");
      return [...r, s?.[0] ?? "", s?.[1] ?? ""];
    }),
  };
}

export const LOGBOOK_APPS: LogbookApp[] = ["LogTen", "ForeFlight", "mccPILOTLOG", "CrewLounge", "Flylog", "MyFlightbook", "LogbookPro", "APDL", "Safelog"];
