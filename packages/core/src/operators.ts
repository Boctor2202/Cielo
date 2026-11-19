import type { Aircraft, Flight } from "./types";

/**
 * Who operated a flight. Recognised, in this order:
 * 1. the operator typed on the flight;
 * 2. the operator of the aircraft (Aircraft page) by its registration;
 * 3. what the pilot's own logbook already says for the same call-sign prefix, then for the same registration
 *    (one flight given its operator teaches all the others);
 * 4. the airline designator of the flight number or call sign (AFR123, AF123, NJE7HA…).
 */

export interface AirlineInfo {
  name: string;
  iata?: string;
  country?: string;
  callsign?: string;
}

/** ICAO airline designators of common airlines and business-aviation operators. */
export const AIRLINES: Record<string, AirlineInfo> = {
  AFR: { name: "Air France", iata: "AF" },
  HOP: { name: "Air France Hop", iata: "A5" },
  BAW: { name: "British Airways", iata: "BA" },
  DLH: { name: "Lufthansa", iata: "LH" },
  CLH: { name: "Lufthansa CityLine" },
  DLA: { name: "Air Dolomiti", iata: "EN" },
  KLM: { name: "KLM", iata: "KL" },
  IBE: { name: "Iberia", iata: "IB" },
  IBS: { name: "Iberia Express", iata: "I2" },
  ITY: { name: "ITA Airways", iata: "AZ" },
  SWR: { name: "Swiss", iata: "LX" },
  AUA: { name: "Austrian Airlines", iata: "OS" },
  SAS: { name: "SAS Scandinavian Airlines", iata: "SK" },
  FIN: { name: "Finnair", iata: "AY" },
  TAP: { name: "TAP Air Portugal", iata: "TP" },
  EIN: { name: "Aer Lingus", iata: "EI" },
  RYR: { name: "Ryanair", iata: "FR" },
  RUK: { name: "Ryanair UK", iata: "RK" },
  MAY: { name: "Malta Air" },
  LDM: { name: "Lauda Europe" },
  EZY: { name: "easyJet", iata: "U2" },
  EJU: { name: "easyJet Europe", iata: "EC" },
  EZS: { name: "easyJet Switzerland", iata: "DS" },
  WZZ: { name: "Wizz Air", iata: "W6" },
  VLG: { name: "Vueling", iata: "VY" },
  VOE: { name: "Volotea", iata: "V7" },
  EWG: { name: "Eurowings", iata: "EW" },
  TRA: { name: "Transavia", iata: "HV" },
  TVF: { name: "Transavia France", iata: "TO" },
  BEL: { name: "Brussels Airlines", iata: "SN" },
  AEE: { name: "Aegean Airlines", iata: "A3" },
  LOT: { name: "LOT Polish Airlines", iata: "LO" },
  CSA: { name: "Czech Airlines", iata: "OK" },
  ROT: { name: "TAROM", iata: "RO" },
  BTI: { name: "airBaltic", iata: "BT" },
  LGL: { name: "Luxair", iata: "LG" },
  AEA: { name: "Air Europa", iata: "UX" },
  ANE: { name: "Air Nostrum", iata: "YW" },
  ASL: { name: "Air Serbia", iata: "JU" },
  CTN: { name: "Croatia Airlines", iata: "OU" },
  ICE: { name: "Icelandair", iata: "FI" },
  NAX: { name: "Norwegian", iata: "DY" },
  CFG: { name: "Condor", iata: "DE" },
  TOM: { name: "TUI Airways", iata: "BY" },
  TFL: { name: "TUI fly Netherlands", iata: "OR" },
  JAF: { name: "TUI fly Belgium", iata: "TB" },
  CRL: { name: "Corsair", iata: "SS" },
  FBU: { name: "French Bee", iata: "BF" },
  EXS: { name: "Jet2", iata: "LS" },
  ENT: { name: "Enter Air", iata: "E4" },
  SXS: { name: "SunExpress", iata: "XQ" },
  BCY: { name: "CityJet", iata: "WX" },
  VIR: { name: "Virgin Atlantic", iata: "VS" },
  THY: { name: "Turkish Airlines", iata: "TK" },
  PGT: { name: "Pegasus Airlines", iata: "PC" },
  TAR: { name: "Tunisair", iata: "TU" },
  RAM: { name: "Royal Air Maroc", iata: "AT" },
  DAH: { name: "Air Algérie", iata: "AH" },
  MSR: { name: "EgyptAir", iata: "MS" },
  ETH: { name: "Ethiopian Airlines", iata: "ET" },
  KQA: { name: "Kenya Airways", iata: "KQ" },
  SAA: { name: "South African Airways", iata: "SA" },
  UAE: { name: "Emirates", iata: "EK" },
  QTR: { name: "Qatar Airways", iata: "QR" },
  ETD: { name: "Etihad Airways", iata: "EY" },
  SVA: { name: "Saudia", iata: "SV" },
  GFA: { name: "Gulf Air", iata: "GF" },
  OMA: { name: "Oman Air", iata: "WY" },
  ELY: { name: "El Al", iata: "LY" },
  AAL: { name: "American Airlines", iata: "AA" },
  DAL: { name: "Delta Air Lines", iata: "DL" },
  UAL: { name: "United Airlines", iata: "UA" },
  SWA: { name: "Southwest Airlines", iata: "WN" },
  JBU: { name: "JetBlue", iata: "B6" },
  ASA: { name: "Alaska Airlines", iata: "AS" },
  ACA: { name: "Air Canada", iata: "AC" },
  WJA: { name: "WestJet", iata: "WS" },
  AMX: { name: "Aeroméxico", iata: "AM" },
  AVA: { name: "Avianca", iata: "AV" },
  CPA: { name: "Cathay Pacific", iata: "CX" },
  SIA: { name: "Singapore Airlines", iata: "SQ" },
  QFA: { name: "Qantas", iata: "QF" },
  ANZ: { name: "Air New Zealand", iata: "NZ" },
  JAL: { name: "Japan Airlines", iata: "JL" },
  ANA: { name: "All Nippon Airways", iata: "NH" },
  KAL: { name: "Korean Air", iata: "KE" },
  AAR: { name: "Asiana Airlines", iata: "OZ" },
  CCA: { name: "Air China", iata: "CA" },
  CES: { name: "China Eastern", iata: "MU" },
  CSN: { name: "China Southern", iata: "CZ" },
  THA: { name: "Thai Airways", iata: "TG" },
  MAS: { name: "Malaysia Airlines", iata: "MH" },
  GIA: { name: "Garuda Indonesia", iata: "GA" },
  AIC: { name: "Air India", iata: "AI" },
  FDX: { name: "FedEx", iata: "FX" },
  UPS: { name: "UPS Airlines", iata: "5X" },
  GTI: { name: "Atlas Air", iata: "5Y" },
  CLX: { name: "Cargolux", iata: "CV" },
  BOX: { name: "AeroLogic" },
  // business aviation
  NJE: { name: "NetJets Europe" },
  EJA: { name: "NetJets" },
  VJT: { name: "VistaJet" },
  LXJ: { name: "Flexjet" },
  AHO: { name: "Air Hamburg" },
  GAC: { name: "GlobeAir" },
  PJS: { name: "Jet Aviation" },
  // FAA JO 7340.2 / ICAO Doc 8585: SAS Astonjet (French AOC, telephony ASTONJET), Astonjet Limited (Maltese AOC, telephony CATCH ME)
  ASJ: { name: "Astonjet SAS", country: "France", callsign: "ASTONJET" },
  AJD: { name: "Astonjet Ltd", country: "Malta", callsign: "CATCH ME" },
};

/** An airline of the world directory. */
export interface Airline {
  icao: string;
  iata?: string;
  name: string;
  callsign?: string;
  country?: string;
  active?: boolean;
}

/** Every airline known: the world list (OpenFlights, in @cielo/reference-data) with the table above on top. */
export interface AirlineDirectory {
  all: Airline[];
  byIcao: (code: string) => Airline | undefined;
  byIata: (code: string) => Airline | undefined;
}

/** A directory from the world list's rows ([icao, iata, name, callsign, country, active]); the table above wins. */
export function airlineDirectory(rows: [string, string, string, string, string, number][] = []): AirlineDirectory {
  const byIcao = new Map<string, Airline>();
  const byIata = new Map<string, Airline>();
  const all: Airline[] = [];
  const add = (a: Airline, override: boolean) => {
    if (a.icao && byIcao.has(a.icao) && !override) return;
    if (a.icao) {
      const prev = byIcao.get(a.icao);
      if (prev) all.splice(all.indexOf(prev), 1, a);
      else all.push(a);
      byIcao.set(a.icao, a);
    } else all.push(a);
    if (a.iata && (override || !byIata.has(a.iata) || (a.active && !byIata.get(a.iata)!.active))) byIata.set(a.iata, a);
  };
  for (const [icao, iata, name, callsign, country, active] of rows) add({ icao, iata: iata || undefined, name, callsign: callsign || undefined, country: country || undefined, active: !!active }, false);
  for (const [icao, a] of Object.entries(AIRLINES)) add({ ...byIcao.get(icao), icao, iata: a.iata ?? byIcao.get(icao)?.iata, name: a.name, country: a.country ?? byIcao.get(icao)?.country, callsign: a.callsign ?? byIcao.get(icao)?.callsign, active: true }, true);
  return { all, byIcao: (c) => byIcao.get(c.toUpperCase()), byIata: (c) => byIata.get(c.toUpperCase()) };
}

let curated: AirlineDirectory | undefined;
const defaultDirectory = () => (curated ??= airlineDirectory());

/** The airline designator a flight number or call sign starts with: ICAO (AFR123, NJE7HA) or IATA (AF123). */
export function callsignPrefix(flightNumber?: string | null): { icao?: string; iata?: string } {
  const s = (flightNumber ?? "").toUpperCase().replace(/[\s-]/g, "");
  const icao = /^([A-Z]{3})\d/.exec(s)?.[1] ?? /^([A-Z]{3})[A-Z0-9]{1,4}$/.exec(s)?.[1];
  if (icao) return { icao };
  const iata = /^([A-Z0-9]{2})\d{1,4}[A-Z]?$/.exec(s)?.[1];
  return iata && /[A-Z]/.test(iata) ? { iata } : {};
}

const norm = (s?: string | null) => (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** The most frequent value of a list (undefined when empty). */
function mostFrequent(values: string[]): string | undefined {
  const n = new Map<string, number>();
  for (const v of values) n.set(v, (n.get(v) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

export interface OperatorIndex {
  /** the operator of a flight, as typed or recognised */
  of: (f: Pick<Flight, "operator" | "flightNumber" | "registration">) => string | undefined;
  /** every operator in the logbook, most flown first */
  all: string[];
}

/** What the logbook and the aircraft list teach about operators, to recognise them on every flight. */
export function operatorIndex(
  flights: Pick<Flight, "operator" | "flightNumber" | "registration" | "deletedAt">[],
  aircraft: Pick<Aircraft, "registration" | "operator" | "deletedAt">[] = [],
  directory: AirlineDirectory = defaultDirectory(),
): OperatorIndex {
  const byReg = new Map<string, string>();
  for (const a of aircraft) if (!a.deletedAt && a.operator?.trim()) byReg.set(norm(a.registration), a.operator.trim());
  const prefixSeen = new Map<string, string[]>();
  const regSeen = new Map<string, string[]>();
  const alive = flights.filter((f) => !f.deletedAt);
  for (const f of alive) {
    const op = f.operator?.trim();
    if (!op) continue;
    const p = callsignPrefix(f.flightNumber);
    const key = p.icao ?? p.iata;
    if (key) prefixSeen.set(key, [...(prefixSeen.get(key) ?? []), op]);
    if (f.registration) regSeen.set(norm(f.registration), [...(regSeen.get(norm(f.registration)) ?? []), op]);
  }
  const learnedPrefix = new Map([...prefixSeen].map(([k, v]) => [k, mostFrequent(v)!]));
  const learnedReg = new Map([...regSeen].map(([k, v]) => [k, mostFrequent(v)!]));
  const of = (f: Pick<Flight, "operator" | "flightNumber" | "registration">) => {
    const typed = f.operator?.trim();
    if (typed) return typed;
    const reg = norm(f.registration);
    if (reg && byReg.has(reg)) return byReg.get(reg);
    const p = callsignPrefix(f.flightNumber);
    const key = p.icao ?? p.iata;
    if (key && learnedPrefix.has(key)) return learnedPrefix.get(key);
    if (reg && learnedReg.has(reg)) return learnedReg.get(reg);
    return (p.icao ? directory.byIcao(p.icao) : p.iata ? directory.byIata(p.iata) : undefined)?.name;
  };
  const count = new Map<string, number>();
  for (const f of alive) {
    const o = of(f);
    if (o) count.set(o, (count.get(o) ?? 0) + 1);
  }
  return { of, all: [...count.entries()].sort((a, b) => b[1] - a[1]).map(([o]) => o) };
}

const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export interface OperatorHit {
  name: string;
  /** ICAO designator (and IATA) when the operator is in the table */
  icao?: string;
  iata?: string;
  country?: string;
  /** already in the pilot's logbook */
  known?: boolean;
}


/**
 * Operators matching what is typed: the ones already in the logbook first, then the table, by name, ICAO or
 * IATA code ("astj", "AFR", "netj", "U2").
 */
export function searchOperators(query: string, known: string[] = [], limit = 8, directory: AirlineDirectory = defaultDirectory()): OperatorHit[] {
  const q = fold(query.trim());
  const hits: (OperatorHit & { score: number })[] = [];
  const seen = new Set<string>();
  const add = (h: OperatorHit, score: number) => {
    const k = fold(h.name);
    if (seen.has(k)) return;
    seen.add(k);
    hits.push({ ...h, score });
  };
  const rank = (name: string, codes: (string | undefined)[]) => {
    if (!q) return 1;
    const n = fold(name);
    if (codes.some((c) => c && fold(c) === q)) return 0;
    if (n.startsWith(q)) return 1;
    if (n.split(/[\s-]+/).some((w) => w.startsWith(q))) return 2;
    if (q.length >= 3 && n.includes(q)) return 3;
    // letters in order ("astj" → "Astonjet"), only for a few letters typed
    if (q.length < 3) return -1;
    let i = 0;
    for (const ch of n) if (ch === q[i]) i++;
    return i === q.length ? 4 : -1;
  };
  const byName = new Map(directory.all.map((a) => [fold(a.name), a]));
  for (const name of known) {
    const t = byName.get(fold(name));
    const r = rank(name, t ? [t.icao, t.iata, t.callsign] : []);
    if (r >= 0) add({ name, icao: t?.icao || undefined, iata: t?.iata, known: true }, r - 0.5);
  }
  if (q)
    for (const a of directory.all) {
      const r = rank(a.name, [a.icao, a.iata, a.callsign]);
      // an airline still flying comes before a defunct one at the same rank
      if (r >= 0) add({ name: a.name, icao: a.icao || undefined, iata: a.iata, country: a.country }, r + (a.active ? 0 : 0.3));
    }
  // letters in order only help when nothing matches better
  const good = hits.some((h) => h.score < 3.5);
  return hits
    .filter((h) => !good || h.score < 3.5)
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ score: _s, ...h }) => h);
}

/** Flights that belong to no company: stored as these values, shown in the pilot's language. */
export const PRIVATE_OPERATOR = "Private";
export const TRAINING_OPERATOR = "Training";

/** A private or training flight: not an experience with a company. */
export const isNonCommercialOperator = (op?: string | null) => !!op && /^(private|priv[ée]|vol priv[ée]|private flight|training|formation|instruction)$/i.test(op.trim());
