import { parseDuration, parseClock } from "./time";
import type { FlightFormInput } from "./flight";
import type { PilotFunction } from "./types";

/** Canonical import fields. */
export type ImportField =
  | "date" | "flightNumber" | "dep" | "arr" | "out" | "off" | "on" | "in" | "registration" | "type"
  | "function" | "picName" | "total" | "night" | "ifr" | "landingsDay" | "landingsNight" | "takeoffsDay"
  | "takeoffsNight" | "pic" | "copilot" | "dual" | "instructor" | "multiPilot" | "remarks" | "fstdType" | "fstdTime";

export const IMPORT_FIELDS: ImportField[] = [
  "date", "flightNumber", "dep", "arr", "out", "off", "on", "in", "registration", "type", "function", "picName",
  "total", "night", "ifr", "takeoffsDay", "takeoffsNight", "landingsDay", "landingsNight", "pic", "copilot", "dual",
  "instructor", "multiPilot", "remarks", "fstdType", "fstdTime",
];

/**
 * Header names seen in paper EASA/FAA logbooks (two-row headers are merged: "Departure" + "Place"), and in the
 * exports of the usual logbook apps (LogTen, ForeFlight, mccPILOTLOG, Flylog, CrewLounge, Logbook Pro…).
 * Matched on whole words after normalisation (accents, case, camelCase and punctuation removed).
 */
const SYNONYMS: Record<ImportField, string[]> = {
  date: ["date", "flight date", "date utc", "date du vol", "jour", "dato", "datum", "fecha", "data", "day"],
  flightNumber: ["flight number", "flight no", "flight nr", "flight num", "flight #", "flt no", "flt", "flight", "n vol", "no vol", "numero de vol", "numero vol", "vol", "callsign", "call sign", "indicatif"],
  dep: ["from", "dep", "departure", "departure place", "dep place", "dep airport", "dep code", "dep icao", "depart", "lieu de depart", "depart lieu", "origin", "orig", "aeroport depart", "airport from", "dep apt", "place of departure"],
  arr: ["to", "arr", "arrival", "arrival place", "arr place", "arr airport", "arr code", "arr icao", "arrivee", "lieu d arrivee", "arrivee lieu", "destination", "dest", "aeroport arrivee", "airport to", "arr apt", "place of arrival"],
  out: ["out", "block start", "time block start", "start block", "block out", "time out block", "time out", "off block", "offblock", "block off", "blocks off", "chocks off", "departure time", "dep time", "departure time utc", "dep time utc", "heure depart", "heure de depart", "depart heure", "std", "atd", "aobt", "start"],
  off: ["off", "time takeoff", "takeoff time utc", "time off", "takeoff", "take off", "takeoff time", "t o", "airborne", "decollage", "heure decollage", "wheels up", "atot"],
  on: ["on", "time landing", "landing time utc", "time on", "landing time", "ldg time", "touchdown", "atterrissage", "heure atterrissage", "wheels down", "aldt"],
  in: ["in", "block end", "time block end", "end block", "block in", "time in", "on block", "onblock", "block on", "blocks on", "chocks on", "arrival time", "arr time", "arrival time utc", "arr time utc", "heure arrivee", "heure d arrivee", "arrivee heure", "sta", "ata", "aibt", "stop"],
  registration: ["registration", "reg", "aircraft registration", "ac reg", "a c reg", "aircraft id", "aircraftid", "aircraft ident", "immatriculation", "immat", "tail", "tail number", "tail no", "ident"],
  type: ["type", "aircraft type", "ac type", "a c type", "ac model", "aircraft model", "make model", "make model variant", "aircraft make model variant", "model", "type avion", "type appareil", "modele", "type aeronef", "aircraft"],
  function: ["function", "pilot role", "role on board", "role", "fonction", "capacity", "pilot function", "seat", "position", "crew function"],
  picName: ["pic name", "name pic", "name of pic", "captain", "captain name", "commandant", "cdb", "nom cdb", "nom du cdb", "nom commandant", "pic", "instructor name"],
  total: ["total", "duration total", "duration block", "total duration", "block duration", "time block", "block hours", "flight duration", "duration flight", "total block", "total time", "total flight time", "time total", "total time of flight", "block", "block time", "flight time", "temps total", "temps de vol", "temps bloc", "duree", "duration", "ttl", "totaltime"],
  night: ["night", "duration night", "night duration", "time night duration", "night time", "time night", "nuit", "temps nuit", "operational condition time night"],
  ifr: ["ifr", "duration ifr", "ifr time", "time ifr", "instrument", "actual instrument", "ifr temps", "operational condition time ifr", "temps ifr"],
  landingsDay: ["landings day", "ldgs day", "ldg day", "day ldgs", "landing day", "day landings", "ldg day", "day ldg", "atterrissages jour", "att jour", "day landings full stop", "landings", "ldg", "atterrissages"],
  landingsNight: ["landings night", "ldgs night", "ldg night", "night ldgs", "landing night", "night landings", "ldg night", "night ldg", "atterrissages nuit", "att nuit", "night landings full stop"],
  takeoffsDay: ["takeoffs day", "takeoff day", "tos day", "tkof day", "day takeoffs", "to day", "t o day", "decollages jour", "dec jour", "takeoffs"],
  takeoffsNight: ["takeoffs night", "takeoff night", "tos night", "tkof night", "night takeoffs", "to night", "t o night", "decollages nuit", "dec nuit"],
  pic: ["pic", "duration pic", "pic time", "time pic", "pilot function time pic", "temps cdb", "cdb temps", "commandant de bord", "p1"],
  copilot: ["co pilot", "duration sic", "duration copilot", "duration co pilot", "copilot", "sic", "sic time", "time sic", "copilote", "fo", "pilot function time co pilot", "p2", "temps opl", "opl"],
  dual: ["dual", "duration dual", "dual received", "time dual", "double commande", "pilot function time dual", "instruction recue"],
  instructor: ["instructor", "duration instructor", "dual given", "time instructor", "instructeur", "pilot function time instructor", "fi time", "cfi"],
  multiPilot: ["multi pilot", "duration multi pilot", "duration mp", "multi pilot time", "multipilote", "mp", "mcc", "multi crew", "time mp"],
  remarks: ["remarks", "remarques", "notes", "note", "comments", "comment", "pilot comments", "observations", "remarks and endorsements", "route"],
  fstdType: ["fstd type", "simulator type", "sim type", "sim type", "simulator", "simulator type", "simulateur", "fstd", "fstd session type", "synthetic"],
  fstdTime: ["fstd time", "duration simulator", "duration sim", "duration fstd", "simulator duration", "time simulator", "sim time", "simulator time", "time sim", "simulated flight", "temps simulateur", "fstd total", "fstd session total time of session", "total time of session"],
};

const DURATION_FIELDS: ImportField[] = ["total", "night", "ifr", "pic", "copilot", "dual", "instructor", "multiPilot", "fstdTime"];
const COUNT_FIELDS: ImportField[] = ["landingsDay", "landingsNight", "takeoffsDay", "takeoffsNight"];
const CLOCK_FIELDS: ImportField[] = ["out", "off", "on", "in"];
/** Words that rule a header out for a field ("LDGS_NIGHT" is not night time, "TIME_BLOCK_START" is not the total). */
const NOT: Partial<Record<ImportField, string[]>> = Object.fromEntries([
  ...DURATION_FIELDS.map((f) => [f, ["ldg", "ldgs", "landing", "landings", "takeoff", "takeoffs", "tos", "atterrissages", "decollages", "start", "end", "debut", "fin", "name", "nom", "type", "count", "nb", "number"]]),
  ...COUNT_FIELDS.map((f) => [f, ["duration", "time", "temps", "duree", "hours", "minutes"]]),
  ...CLOCK_FIELDS.map((f) => [f, ["duration", "total", "duree", "ldgs", "ldg", "landings", "takeoffs", "airport", "place", "icao", "name"]]),
  ["dep", ["time", "duration", "heure"]],
  ["arr", ["time", "duration", "heure"]],
  ["registration", ["type", "model", "name"]],
  ["type", ["simulator", "fstd", "sim", "registration", "reg"]],
  ["picName", ["duration", "time"]],
  ["flightNumber", ["duration", "time", "date", "total"]],
]) as Partial<Record<ImportField, string[]>>;

/** lowercase, no accents, camelCase split ("TimeOut" -> "time out"), punctuation to spaces */
const norm = (s: string) =>
  s
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/* ---------- what a column's values look like ---------- */

type Kind = "date" | "icao" | "clock" | "duration" | "reg" | "actype" | "func" | "int" | "text" | "hm";

const DATE_RE = /^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})([ t]\d{1,2}:\d{2}(:\d{2})?)?$/i;
const ICAO_RE = /^[A-Z]{4}$|^[A-Z]{3}$/;
const CLOCK_RE = /^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}[ T])?([01]?\d|2[0-3])[:h.]?[0-5]\d(:\d{2})?z?$/i;
const DUR_RE = /^\d{1,4}[:h]\d{2}$|^\d{1,3}[.,]\d{1,2}$/;
const REG_RE = /^([A-Z]{1,2}|[A-Z]\d|\d[A-Z])-[A-Z0-9]{2,5}$|^N\d{1,5}[A-Z]{0,2}$|^HL\d{4}$|^JA[0-9A-Z]{4}$|^B-?\d{4,5}$/;
const TYPE_RE = /^[A-Z][A-Z0-9]{1,3}$/;
const FUNC_RE = /^(pic|sic|picus|p1|p2|p1s|p1us|fo|f\/o|cdb|opl|cpt|capt|captain|dual|fi|fe|tri|tre|cfi|instructor|student|copilot|co-pilot|copilote|eleve)$/i;

type Profile = Record<Kind, number> & { filled: number };

function profile(values: string[]): Profile {
  const p: Profile = { date: 0, icao: 0, clock: 0, duration: 0, reg: 0, actype: 0, func: 0, int: 0, text: 0, hm: 0, filled: 0 };
  const vals = values.map((v) => v.trim()).filter(Boolean);
  if (!vals.length) return p;
  for (const v of vals) {
    const u = v.toUpperCase();
    if (DATE_RE.test(v) || /^\d{5}$/.test(v) && +v > 20000 && +v < 60000) p.date++;
    if (ICAO_RE.test(u) && u === v) p.icao++;
    if (CLOCK_RE.test(v)) p.clock++;
    if (DUR_RE.test(v) || /^\d{1,2}$/.test(v)) p.duration++;
    if (REG_RE.test(u)) p.reg++;
    if (TYPE_RE.test(u) && /\d/.test(u)) p.actype++;
    if (FUNC_RE.test(v)) p.func++;
    if (/^\d{1,2}$/.test(v)) p.int++;
    if (/^\d{1,4}[:h]\d{2}$|^\d{1,3}[.,]\d{1,2}$/.test(v)) p.hm++;
    if (/[a-z]{3,}/i.test(v) && v.length > 3) p.text++;
  }
  for (const k of Object.keys(p) as (keyof Profile)[]) if (k !== "filled") p[k] /= vals.length;
  p.filled = vals.length / values.length;
  return p;
}

/** How well a column's values suit a field (1 = fits, 0 = impossible). Empty columns stay possible. */
function fit(field: ImportField, p: Profile): number {
  if (p.filled === 0) return 0.6;
  switch (field) {
    case "date": return p.date;
    case "dep": case "arr": return p.icao;
    case "out": case "off": case "on": case "in": return p.clock;
    case "registration": return Math.max(p.reg, p.actype * 0.3);
    case "type": return Math.max(p.actype, p.text * 0.6);
    case "function": return p.func;
    case "total": case "night": case "ifr": case "pic": case "copilot": case "dual": case "instructor": case "multiPilot": case "fstdTime":
      // a column of small whole numbers only (0, 1, 2…) is a count of landings, not a duration
      if (p.hm === 0 && p.int > 0.9) return 0.2;
      return Math.max(p.duration, p.clock * 0.9);
    case "landingsDay": case "landingsNight": case "takeoffsDay": case "takeoffsNight": return p.hm > 0.2 ? 0 : p.int;
    case "picName": return p.text;
    case "flightNumber": return /* AF1234, 1234, EZY12AB */ 1 - p.date - p.clock * 0.5;
    case "remarks": case "fstdType": return 1 - p.date;
  }
}

/** Header score: whole-word synonym match, longer synonyms win ("departure time" beats "departure"). */
function headerScore(field: ImportField, header: string): number {
  const h = norm(header);
  if (!h) return 0;
  const words = new Set(h.split(" "));
  if (NOT[field]?.some((w) => words.has(w))) return 0;
  let best = 0;
  for (const syn of SYNONYMS[field]) {
    const sw = norm(syn);
    if (h === sw) best = Math.max(best, 100 + sw.length);
    const toks = sw.split(" ");
    if (toks.every((tk) => words.has(tk))) best = Math.max(best, 40 + 12 * toks.length - 3 * (words.size - toks.length));
  }
  return best;
}

/** Maps each import field to a column index (or -1), from the header row and, when given, sample data rows. */
export function detectMapping(header: string[], sample: string[][] = []): Record<ImportField, number> {
  const result = Object.fromEntries(IMPORT_FIELDS.map((f) => [f, -1])) as Record<ImportField, number>;
  const profiles = header.map((_, i) => profile(sample.slice(0, 200).map((r) => r[i] ?? "")));
  const hasData = sample.length > 0;

  // 1) header names, weighted by how well the values fit
  const cands: { f: ImportField; i: number; s: number }[] = [];
  for (const f of IMPORT_FIELDS) {
    header.forEach((h, i) => {
      const hs = headerScore(f, h);
      if (!hs) return;
      const fi = hasData ? fit(f, profiles[i]!) : 1;
      if (hasData && fi < 0.35) return;
      cands.push({ f, i, s: hs * (0.5 + fi / 2) });
    });
  }
  cands.sort((a, b) => b.s - a.s);
  const used = new Set<number>();
  for (const c of cands) {
    if (result[c.f] !== -1 || used.has(c.i)) continue;
    result[c.f] = c.i;
    used.add(c.i);
  }
  if (!hasData) return result;

  // 2) the values alone, for what the headers did not give
  const free = (pred: (p: Profile) => boolean) => header.map((_, i) => i).filter((i) => !used.has(i) && profiles[i]!.filled > 0.3 && pred(profiles[i]!));
  const take = (f: ImportField, i: number | undefined) => {
    if (i === undefined || result[f] !== -1) return;
    result[f] = i;
    used.add(i);
  };
  take("date", free((p) => p.date > 0.8)[0]);
  // airports: the first ICAO-looking column is the departure, the next one the arrival
  const apts = free((p) => p.icao > 0.8);
  if (result.dep === -1 && result.arr === -1) {
    take("dep", apts[0]);
    take("arr", apts[1]);
  } else if (result.dep === -1) take("dep", apts.find((i) => i < result.arr) ?? apts[0]);
  else if (result.arr === -1) take("arr", apts.find((i) => i > result.dep) ?? apts[0]);
  take("registration", free((p) => p.reg > 0.7)[0]);
  take("type", free((p) => p.actype > 0.7 && p.reg < 0.3)[0]);
  take("function", free((p) => p.func > 0.7)[0]);

  // clock times: block out / in (and takeoff / landing when there are four), in file order
  const clocks = free((p) => p.clock > 0.8 && p.date < 0.5);
  const missing = (["out", "off", "on", "in"] as const).filter((f) => result[f] === -1);
  if (missing.length === 4 && clocks.length >= 4) (["out", "off", "on", "in"] as const).forEach((f, k) => take(f, clocks[k]));
  else if (result.out === -1 && result.in === -1 && clocks.length >= 2) {
    // two clock columns followed by a duration equal to their difference: out, in, total
    take("out", clocks[0]);
    take("in", clocks[1]);
  }
  // total: a duration column, preferring the one that matches in - out
  if (result.total === -1) {
    const durs = free((p) => p.duration > 0.8 && p.int < 0.9);
    const diffOk = (i: number) => {
      if (result.out === -1 || result.in === -1) return 0;
      let ok = 0;
      let n = 0;
      for (const r of sample.slice(0, 100)) {
        const a = parseClock(clockPart(r[result.out] ?? ""));
        const b = parseClock(clockPart(r[result.in] ?? ""));
        const d = parseDuration(r[i] ?? "");
        if (!a || !b || d === null) continue;
        n++;
        const diff = (b.h * 60 + b.m - (a.h * 60 + a.m) + 1440) % 1440;
        if (Math.abs(diff - d) <= 5) ok++;
      }
      return n ? ok / n : 0;
    };
    const best = durs.map((i) => ({ i, s: diffOk(i) })).sort((a, b) => b.s - a.s)[0];
    take("total", best && (best.s > 0.5 || durs.length === 1) ? best.i : undefined);
  }
  return result;
}

/** "2024-05-26 08:30:00", "08:30:00Z", "0830" -> the HH:MM part */
const clockPart = (v: string) => {
  const m = v.trim().match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*z?$/i);
  return m ? `${m[1]}:${m[2]}` : v.trim();
};

/** A doubt about a mapped column, found by cross-checking the values row by row. */
export interface MappingCheck {
  field: ImportField;
  /** i18n key: totalVsBlock, exceedsTotal, functionsVsTotal, notACount */
  issue: "totalVsBlock" | "exceedsTotal" | "functionsVsTotal" | "notACount" | "blockTooLong";
  /** share of the checked rows that disagree (0..1) */
  ratio: number;
  rows: number;
}

/**
 * Cross-checks the mapped columns against each other on the data itself (total = on-block − off-block,
 * night and IFR within the total, function times adding up to the total, landings as small counts).
 * Only reports a column when at least 20 % of the rows that can be checked disagree.
 */
export function checkMapping(rows: string[][], mapping: Record<ImportField, number>): MappingCheck[] {
  const sample = rows.slice(0, 300);
  const val = (r: string[], f: ImportField) => (mapping[f] >= 0 ? (r[mapping[f]] ?? "").trim() : "");
  const dur = (v: string) => (v ? parseDuration(v) : null);
  const out: MappingCheck[] = [];
  const add = (field: ImportField, issue: MappingCheck["issue"], bad: number, n: number) => {
    if (n >= 3 && bad / n >= 0.2) out.push({ field, issue, ratio: bad / n, rows: n });
  };
  if (mapping.total >= 0 && mapping.out >= 0 && mapping.in >= 0) {
    let n = 0;
    let bad = 0;
    for (const r of sample) {
      const a = parseClock(clockPart(val(r, "out")));
      const b = parseClock(clockPart(val(r, "in")));
      const t = dur(val(r, "total"));
      if (!a || !b || t === null || t === 0) continue;
      n++;
      const diff = (b.h * 60 + b.m - (a.h * 60 + a.m) + 1440) % 1440;
      if (Math.abs(diff - t) > 5) bad++;
    }
    add("total", "totalVsBlock", bad, n);
  }
  // a duration read as a clock time ("0:45" taken as 00:45) gives blocks of 10 h or more
  if (mapping.out >= 0 && mapping.in >= 0) {
    let n = 0;
    let bad = 0;
    for (const r of sample) {
      const a = parseClock(clockPart(val(r, "out")));
      const b = parseClock(clockPart(val(r, "in")));
      if (!a || !b) continue;
      n++;
      if ((b.h * 60 + b.m - (a.h * 60 + a.m) + 1440) % 1440 > 16 * 60) bad++;
      else if (mapping.total >= 0 && dur(val(r, "total")) === b.h * 60 + b.m && b.h * 60 + b.m < a.h * 60 + a.m) bad++;
    }
    add("in", "blockTooLong", bad, n);
  }
  for (const f of ["night", "ifr", "pic", "copilot", "dual", "instructor", "multiPilot"] as const) {
    if (mapping[f] < 0 || mapping.total < 0) continue;
    let n = 0;
    let bad = 0;
    for (const r of sample) {
      const t = dur(val(r, "total"));
      const v = dur(val(r, f));
      if (t === null || v === null || t === 0) continue;
      n++;
      if (v > t + 1) bad++;
    }
    add(f, "exceedsTotal", bad, n);
  }
  const fn = (["pic", "copilot", "dual", "instructor"] as const).filter((f) => mapping[f] >= 0);
  if (fn.length >= 2 && mapping.total >= 0) {
    let n = 0;
    let bad = 0;
    for (const r of sample) {
      const t = dur(val(r, "total"));
      if (t === null || t === 0) continue;
      const sum = fn.reduce((s, f) => s + (dur(val(r, f)) ?? 0), 0);
      if (sum === 0) continue;
      n++;
      if (Math.abs(sum - t) > 2 && sum < t) bad++;
    }
    if (n >= 3 && bad / n >= 0.2) out.push({ field: "total", issue: "functionsVsTotal", ratio: bad / n, rows: n });
  }
  for (const f of ["landingsDay", "landingsNight", "takeoffsDay", "takeoffsNight"] as const) {
    if (mapping[f] < 0) continue;
    let n = 0;
    let bad = 0;
    for (const r of sample) {
      const v = val(r, f);
      if (!v) continue;
      n++;
      if (!/^\d{1,2}$/.test(v) || Number(v) > 20) bad++;
    }
    add(f, "notACount", bad, n);
  }
  return out;
}

export interface TableAnalysis {
  /** index of the header row in the file (title lines above it are skipped) */
  headerRow: number;
  /** column names (a two-row header is merged: "Departure Place") */
  header: string[];
  /** data rows, after the header */
  rows: string[][];
  mapping: Record<ImportField, number>;
  dateOrder: DateOrder;
  /** doubts found by cross-checking the values */
  checks: MappingCheck[];
  /** columns with data that no field uses */
  unused: string[];
}

/**
 * Finds the header (it may sit under a title, or span two rows as in the EASA paper logbook), maps every
 * column from its name and its values, and guesses the date order (31/12 vs 12/31).
 */
export function analyseTable(table: string[][]): TableAnalysis {
  const rows = table.filter((r) => r.some((c) => (c ?? "").trim()));
  const hits = (r: string[]) => r.reduce((n, c) => n + (IMPORT_FIELDS.some((f) => headerScore(f, c) > 0) && !DATE_RE.test(c.trim()) ? 1 : 0), 0);
  let headerRow = 0;
  let best = -1;
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const h = hits(rows[i]!);
    if (h > best) {
      best = h;
      headerRow = i;
    }
  }
  let header = (rows[headerRow] ?? []).map((c) => (c ?? "").trim());
  let dataStart = headerRow + 1;
  // two-row header: the next row holds sub-headers (Place / Time, Day / Night, SE / ME…) and no data
  const next = rows[dataStart];
  if (next && hits(next) >= 2 && !next.some((c) => DATE_RE.test((c ?? "").trim())) && profile(next).clock < 0.2) {
    let parent = "";
    header = header.map((h, i) => {
      if (h) parent = h;
      const sub = (next[i] ?? "").trim();
      return sub ? `${h || parent} ${sub}`.trim() : h;
    });
    dataStart++;
  }
  const data = rows.slice(dataStart);
  const mapping = detectMapping(header, data);
  const used = new Set(Object.values(mapping));
  const unused = header.filter((h, i) => h && !used.has(i) && data.some((r) => (r[i] ?? "").trim()));
  return {
    headerRow,
    header,
    rows: data,
    mapping,
    dateOrder: guessDateOrder(data.map((r) => (mapping.date >= 0 ? r[mapping.date] ?? "" : ""))),
    checks: checkMapping(data, mapping),
    unused,
  };
}

/** 31/12/2024 -> dmy, 12/31/2024 -> mdy, 2024-12-31 -> ymd (default dmy, the European order). */
export function guessDateOrder(values: string[]): DateOrder {
  let dmy = 0;
  let mdy = 0;
  let ymd = 0;
  for (const v of values) {
    const s = v.trim();
    if (/^\d{4}[-/.]/.test(s)) ymd++;
    const m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/);
    if (m) {
      if (+m[1]! > 12) dmy++;
      if (+m[2]! > 12) mdy++;
    }
  }
  if (ymd > dmy && ymd > mdy) return "ymd";
  return mdy > dmy ? "mdy" : "dmy";
}

export type DateOrder = "dmy" | "mdy" | "ymd";

export function parseFlexibleDate(input: string, order: DateOrder = "dmy"): string | null {
  const s = input.trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return iso(+m[1]!, +m[2]!, +m[3]!);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    let y = +m[3]!;
    if (y < 100) y += y > 70 ? 1900 : 2000;
    const [a, b] = [+m[1]!, +m[2]!];
    return order === "mdy" ? iso(y, a, b) : iso(y, b, a);
  }
  // Excel serial date
  if (/^\d{5}$/.test(s)) {
    const t = Date.UTC(1899, 11, 30) + Number(s) * 86_400_000;
    return new Date(t).toISOString().slice(0, 10);
  }
  return null;
}

function iso(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function parseFunction(v: string): PilotFunction | null {
  const s = norm(v);
  if (!s) return null;
  if (/picus|puis/.test(s)) return "PICUS";
  if (/^(pic|cdb|captain|cpt|commandant|p1)/.test(s)) return "PIC";
  if (/^(sic|fo|f\/o|copi|co pi|opl|p2|first officer)/.test(s)) return "SIC";
  if (/(dual|eleve|student|double)/.test(s)) return "DUAL";
  if (/^(fe|examin)/.test(s)) return "FE";
  if (/^(fi|cfi|instruc|tri|cri|iri)/.test(s)) return "FI";
  return null;
}

export interface ImportedRow {
  rowIndex: number;
  input?: FlightFormInput;
  /** When the file provides totals, they win over computed values. */
  explicit: { total?: number; night?: number; ifr?: number; pic?: number; copilot?: number; dual?: number; instructor?: number; multiPilot?: number };
  errors: string[];
}

export function rowsToFlights(
  rows: string[][],
  mapping: Record<ImportField, number>,
  opts: { dateOrder?: DateOrder; defaultFunction?: PilotFunction; pilotFlying?: boolean } = {},
): ImportedRow[] {
  const get = (r: string[], f: ImportField) => (mapping[f] >= 0 ? (r[mapping[f]] ?? "").trim() : "");
  const num = (v: string) => (v === "" ? undefined : Number.isFinite(Number(v)) ? Number(v) : undefined);
  const dur = (v: string) => (v === "" ? undefined : parseDuration(v) ?? undefined);
  const clock = (v: string) => {
    if (!v) return undefined;
    const c = parseClock(clockPart(v));
    return c ? `${String(c.h).padStart(2, "0")}:${String(c.m).padStart(2, "0")}` : undefined;
  };

  return rows.map((r, rowIndex) => {
    const errors: string[] = [];
    const date = parseFlexibleDate(get(r, "date"), opts.dateOrder);
    if (!date) errors.push("date");
    // A "simulator" / "FSTD" column often holds the session time (the EASA logbook's FSTD "total time of
    // session"), not the device type: a value that reads as a duration is taken as the session time.
    const rawFstd = get(r, "fstdType");
    const fstdTypeIsTime = /^\d{1,2}\s*[:hH]\s*\d{2}$|^\d+([.,]\d+)?$/.test(rawFstd.trim());
    const fstdTime = dur(get(r, "fstdTime")) ?? (fstdTypeIsTime ? dur(rawFstd.trim()) : undefined);
    const fstdType = fstdTypeIsTime ? undefined : rawFstd || undefined;
    const isFstd = !!rawFstd || (!!fstdTime && !get(r, "registration"));
    const dep = get(r, "dep").toUpperCase();
    const arr = get(r, "arr").toUpperCase();
    if (!isFstd && (!dep || !arr)) errors.push("route");

    const explicit: ImportedRow["explicit"] = {
      total: dur(get(r, "total")),
      night: dur(get(r, "night")),
      ifr: dur(get(r, "ifr")),
      pic: dur(get(r, "pic")),
      copilot: dur(get(r, "copilot")),
      dual: dur(get(r, "dual")),
      instructor: dur(get(r, "instructor")),
      multiPilot: dur(get(r, "multiPilot")),
    };
    let fn = parseFunction(get(r, "function"));
    if (!fn) {
      if (explicit.pic) fn = "PIC";
      else if (explicit.copilot) fn = "SIC";
      else if (explicit.dual) fn = "DUAL";
      else if (explicit.instructor) fn = "FI";
    }
    const out = clock(get(r, "out"));
    const inn = clock(get(r, "in"));
    if (!isFstd && !out && !inn && !explicit.total) errors.push("times");

    const input: FlightFormInput | undefined = date
      ? {
          date,
          flightNumber: get(r, "flightNumber") || undefined,
          depIcao: dep || (isFstd ? "FSTD" : ""),
          arrIcao: arr || (isFstd ? "FSTD" : ""),
          out,
          off: clock(get(r, "off")),
          on: clock(get(r, "on")),
          in: inn,
          registration: get(r, "registration").toUpperCase() || undefined,
          aircraftTypeIcao: get(r, "type").toUpperCase() || undefined,
          function: fn ?? opts.defaultFunction ?? "PIC",
          picName: get(r, "picName") || undefined,
          ifr: (explicit.ifr ?? 0) > 0,
          nightOverrideMin: explicit.night,
          ifrOverrideMin: explicit.ifr,
          takeoffsDay: num(get(r, "takeoffsDay")),
          takeoffsNight: num(get(r, "takeoffsNight")),
          landingsDay: num(get(r, "landingsDay")),
          landingsNight: num(get(r, "landingsNight")),
          autoLandings: false,
          pilotFlying: opts.pilotFlying ?? (num(get(r, "landingsDay")) ?? 0) + (num(get(r, "landingsNight")) ?? 0) > 0,
          isFstd,
          fstdType,
          fstdMin: fstdTime,
          remarks: get(r, "remarks") || undefined,
        }
      : undefined;
    return { rowIndex, input, explicit, errors };
  });
}
