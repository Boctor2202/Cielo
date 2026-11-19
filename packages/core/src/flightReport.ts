/**
 * Post-flight reports in "Field : value" form, as some airlines e-mail them to their pilots after each flight
 * (Ryanair's "Flights for 12-Nov-26", ACARS / EFB summaries and the like). The fields are recognised by name,
 * whatever their order, so one reader serves many airlines; nothing is guessed from position.
 */

export interface FlightReport {
  /** YYYY-MM-DD */
  date?: string;
  flightNumber?: string;
  registration?: string;
  /** as written: IATA or ICAO */
  from?: string;
  to?: string;
  /** HH:MM, UTC as printed */
  out?: string;
  off?: string;
  on?: string;
  in?: string;
  /** names printed for the take-off and the landing, and for the pilot flying */
  takeoffBy?: string;
  landingBy?: string;
  pilotFlying?: string;
  captain?: string;
  pax?: number;
  /** the fields recognised, for the review screen */
  found: string[];
}

/** Nationality prefixes of aircraft registrations (those written with a dash). */
const PREFIXES = "9A 9H 9M 9V 4X 4R 4K 4L A4 A6 A7 A9 B C CS CN CC CP CU CX D EC EI EK EP ER ES EW EX F G HA HB HC HK HP HS HZ I JY LN LV LX LY LZ OB OD OE OH OK OM OO OY P4 PH PK PP PR PT PZ RA S2 S5 SE SP SU SX T7 TC TF TS UK UN UR VH VN VP VQ VT XA YL YR YU Z ZK ZS 5B 5Y 7T".split(" ");

/** A registration printed without its dash gets it back: EIIKC → EI-IKC, FHZUN → F-HZUN (US "N" ones have none). */
export function withDash(reg: string): string {
  const r = reg.toUpperCase().replace(/\s/g, "");
  if (r.includes("-") || /^N\d/.test(r) || /^(JA|HL)\d/.test(r)) return r;
  const p = PREFIXES.filter((x) => r.startsWith(x) && r.length - x.length >= 3 && r.length - x.length <= 5).sort((a, b) => b.length - a.length)[0];
  return p ? `${p}-${r.slice(p.length)}` : r;
}

const norm = (k: string) => k.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
const TIME = /^(\d{1,2})[:h.]?(\d{2})(?:\s*(?:z|utc|lt))?$/i;
const CODE = /^[A-Z]{3,4}$/;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const ALIASES: Record<string, string[]> = {
  flightNumber: ["flightnumber", "flightno", "flightnbr", "flight", "flt", "fltno", "callsign", "numerodevol", "vol"],
  registration: ["registration", "reg", "acreg", "aircraftregistration", "tail", "tailnumber", "immatriculation", "immat", "aircraft"],
  pair: ["citypair", "route", "sector", "leg", "trajet", "etape"],
  from: ["from", "origin", "departureairport", "depairport", "dep", "departure", "depart"],
  to: ["to", "destination", "arrivalairport", "arrairport", "arr", "arrival", "arrivee"],
  out: ["offblock", "blockoff", "out", "chocksoff", "offblocks", "atd", "blockout", "departblock"],
  off: ["airborne", "takeofftime", "wheelsup", "off", "takeofft", "liftoff", "decollage"],
  on: ["landed", "landingtime", "touchdown", "wheelsdown", "on", "atterrissage"],
  in: ["onblock", "blockon", "in", "chockson", "onblocks", "ata", "blockin", "arriveeblock"],
  takeoffBy: ["takeoff", "takeoffby", "tobyy", "takeoffpilot"],
  landingBy: ["landing", "landingby", "landingpilot"],
  pilotFlying: ["pilotflying", "pf"],
  captain: ["captain", "commander", "cdb", "pic", "commandant"],
  pax: ["actualpax", "pax", "totalpax", "passengers"],
  date: ["date", "flightdate", "dateofflight", "datedevol"],
};
const fieldOf = (key: string) => {
  const k = norm(key);
  for (const [f, list] of Object.entries(ALIASES)) if (list.includes(k)) return f;
  return undefined;
};

/** 2026/11/12, 2026-11-12, 12/11/2026, 12.11.26, 12-Nov-26, 12 Nov 2026 → YYYY-MM-DD */
export function reportDate(s: string): string | undefined {
  let m = /(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
  m = /(\d{1,2})[\s/.-]([A-Za-z]{3})[a-z]*[\s/.-](\d{2,4})/.exec(s);
  if (m) {
    const mo = MONTHS.indexOf(m[2]!.toLowerCase());
    if (mo >= 0) return `${m[3]!.length === 2 ? `20${m[3]}` : m[3]}-${String(mo + 1).padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  }
  m = /(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/.exec(s);
  if (m) return `${m[3]!.length === 2 ? `20${m[3]}` : m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  return undefined;
}

const hhmm = (v: string) => {
  const m = TIME.exec(v.trim());
  if (!m) return undefined;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h < 24 && mi < 60 ? `${String(h).padStart(2, "0")}:${m[2]}` : undefined;
};

/** Reads a pasted report; undefined when it is not one (fewer than three flight fields recognised). */
export function parseFlightReport(text: string): FlightReport | undefined {
  const r: FlightReport = { found: [] };
  const set = <K extends keyof FlightReport>(k: K, v: FlightReport[K]) => {
    if (v === undefined || v === "" || r[k] !== undefined) return;
    r[k] = v;
    r.found.push(k);
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/ /g, " ").trim();
    const m = /^([^:=]{1,40}?)\s*[:=]\s*(.*)$/.exec(line);
    if (!m) {
      if (!r.date) set("date", reportDate(line));
      continue;
    }
    const field = fieldOf(m[1]!);
    const v = m[2]!.trim();
    if (!field || !v || v === "--") continue;
    switch (field) {
      case "flightNumber":
        if (/^[A-Z0-9]{2,3}\s?\d{1,4}[A-Z]?$/i.test(v)) set("flightNumber", v.replace(/\s/g, "").toUpperCase());
        break;
      case "registration": {
        const reg = v.toUpperCase().replace(/\s/g, "");
        if (/^[A-Z0-9-]{3,8}$/.test(reg) && /[A-Z]/.test(reg)) set("registration", withDash(reg));
        break;
      }
      case "pair": {
        const p = v.toUpperCase().split(/\s*(?:-|–|—|→|>|\/|\s)\s*/).filter((x) => CODE.test(x));
        if (p.length >= 2) {
          set("from", p[0]);
          set("to", p[p.length - 1]);
        }
        break;
      }
      // "Dep : 8850" is fuel on some reports: an airport only when it reads as a code
      case "from":
      case "to":
        if (CODE.test(v.toUpperCase())) set(field, v.toUpperCase());
        break;
      case "out":
      case "off":
      case "on":
      case "in":
        set(field, hhmm(v));
        break;
      // a name, not a time: who did the take-off / the landing
      case "takeoffBy":
      case "landingBy":
      case "pilotFlying":
      case "captain":
        if (!hhmm(v) && /[A-Za-z]/.test(v)) set(field, v.replace(/\s+/g, " ").trim());
        else if (field === "takeoffBy") set("off", hhmm(v));
        else if (field === "landingBy") set("on", hhmm(v));
        break;
      case "pax":
        if (/^\d{1,3}$/.test(v)) set("pax", Number(v));
        break;
      case "date":
        set("date", reportDate(v));
        break;
    }
  }
  const flightFields = r.found.filter((f) => ["flightNumber", "registration", "from", "to", "out", "off", "on", "in"].includes(f));
  return flightFields.length >= 3 ? r : undefined;
}

/** Whether a name printed on the report is the pilot's (by surname, or any word of the name). */
export function isPilot(printed: string | undefined, fullName: string | undefined): boolean {
  if (!printed || !fullName) return false;
  const a = norm(printed);
  const words = fullName.split(/\s+/).map(norm).filter((w) => w.length >= 3);
  return words.some((w) => a.includes(w) || w.includes(a));
}
