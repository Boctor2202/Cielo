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

const SYNONYMS: Record<ImportField, string[]> = {
  date: ["date", "flight date", "jour", "date du vol", "dato", "datum"],
  flightNumber: ["flight number", "flight no", "flight", "flt", "n° vol", "numéro de vol", "vol", "callsign"],
  dep: ["from", "dep", "departure", "departure place", "départ", "depart", "origin", "lieu de départ", "dep icao", "orig"],
  arr: ["to", "arr", "arrival", "arrival place", "arrivée", "arrivee", "destination", "lieu d'arrivée", "arr icao", "dest"],
  out: ["out", "off block", "off-block", "offblock", "block off", "heure départ", "departure time", "dep time", "std", "atd", "chocks off"],
  off: ["takeoff", "take off", "take-off", "t/o", "airborne", "décollage", "decollage", "wheels up"],
  on: ["landing time", "touchdown", "atterrissage", "wheels down", "ldg time"],
  in: ["in", "on block", "on-block", "onblock", "block on", "heure arrivée", "arrival time", "arr time", "sta", "ata", "chocks on"],
  registration: ["registration", "reg", "immatriculation", "immat", "aircraft id", "tail", "tail number", "ident"],
  type: ["type", "aircraft type", "model", "make model", "type avion", "modèle", "ac type", "a/c type"],
  function: ["function", "role", "fonction", "capacity", "pilot function"],
  picName: ["pic name", "name pic", "captain", "commandant", "cdb", "nom cdb", "name of pic", "pic name"],
  total: ["total", "total time", "block", "block time", "temps total", "total flight time", "duration", "durée", "ttl"],
  night: ["night", "nuit", "night time"],
  ifr: ["ifr", "ifr time", "instrument", "ifr temps"],
  landingsDay: ["landings day", "day landings", "ldg day", "atterrissages jour", "att jour", "day ldg", "landings"],
  landingsNight: ["landings night", "night landings", "ldg night", "atterrissages nuit", "att nuit", "night ldg"],
  takeoffsDay: ["takeoffs day", "day takeoffs", "to day", "décollages jour"],
  takeoffsNight: ["takeoffs night", "night takeoffs", "to night", "décollages nuit"],
  pic: ["pic", "pic time", "cdb temps", "commandant de bord"],
  copilot: ["co-pilot", "copilot", "sic", "copilote", "fo", "co pilot"],
  dual: ["dual", "double commande", "dual received", "instruction"],
  instructor: ["instructor", "fi", "instructeur", "dual given", "cfi"],
  multiPilot: ["multi-pilot", "multi pilot", "mp", "multipilote", "mcc"],
  remarks: ["remarks", "remarques", "notes", "comments", "observations", "remarks and endorsements"],
  fstdType: ["fstd type", "sim type", "simulator", "simulateur", "fstd"],
  fstdTime: ["fstd time", "sim time", "simulator time", "temps simulateur", "fstd total"],
};

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[_.()]/g, " ").replace(/\s+/g, " ").trim();

/** Maps each import field to a column index (or -1), from the header row. */
export function detectMapping(header: string[]): Record<ImportField, number> {
  const h = header.map(norm);
  const result = Object.fromEntries(IMPORT_FIELDS.map((f) => [f, -1])) as Record<ImportField, number>;
  const used = new Set<number>();
  // exact matches first, then "contains" matches
  for (const pass of ["exact", "contains"] as const) {
    for (const field of IMPORT_FIELDS) {
      if (result[field] !== -1) continue;
      const syns = SYNONYMS[field].map(norm);
      const idx = h.findIndex((col, i) => !used.has(i) && syns.some((s) => (pass === "exact" ? col === s : col.includes(s) && s.length > 3)));
      if (idx !== -1) {
        result[field] = idx;
        used.add(idx);
      }
    }
  }
  return result;
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
    const c = parseClock(v.length > 5 ? v.slice(-5) : v);
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
