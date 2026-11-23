/**
 * Block and runway times of an aircraft's recent flights from its ADS-B trace on adsb.lol (free, community
 * network, ODbL): the registration gives the aircraft's ICAO address (live, or the open tar1090 aircraft
 * database), the trace gives the flights (see flightsFromTrace), the nearest airports name the ends.
 * adsb.lol keeps about the last 24 h, so this is for flights just flown. Server-side only.
 */
import { gunzipSync } from "node:zlib";
import { flightsFromTrace, type TracePos } from "@cielo/core";
import { expandAirports, type AirportFile } from "@cielo/reference-data";
import airportFile from "@cielo/reference-data/airports.json";
import { AdsbError, aircraftByRegistration } from "./adsb";
import type { FoundFlight } from "./flightaware";
import { meteredFetch } from "./server/usage";

const BASE = "https://api.adsb.lol";
const DB_URL = "https://raw.githubusercontent.com/wiedehopf/tar1090-db/csv/aircraft.csv.gz";

// registration → ICAO address, from the open aircraft database (loaded once per server instance)
let db: Promise<Map<string, string>> | null = null;
function registrations(): Promise<Map<string, string>> {
  db ??= fetch(DB_URL, { next: { revalidate: 7 * 86_400 } })
    .then(async (r) => {
      if (!r.ok) throw new Error(`aircraft db ${r.status}`);
      const csv = gunzipSync(Buffer.from(await r.arrayBuffer())).toString("utf8");
      const m = new Map<string, string>();
      for (const line of csv.split("\n")) {
        const [hex, reg] = line.split(";");
        if (hex && reg) m.set(reg.replace(/[^A-Z0-9]/gi, "").toUpperCase(), hex.toLowerCase());
      }
      return m;
    })
    .catch((e) => {
      db = null;
      throw e;
    });
  return db;
}

const isHex = (h: unknown): h is string => typeof h === "string" && /^[0-9a-f]{6}$/i.test(h.trim());
const timeout = () => AbortSignal.timeout(6000);

/** adsbdb.com (open, community): registration → Mode S address. */
async function adsbdbHex(reg: string): Promise<string | undefined> {
  const r = await fetch(`https://api.adsbdb.com/v0/aircraft/${encodeURIComponent(reg)}`, { signal: timeout(), cache: "no-store" });
  if (!r.ok) return undefined;
  const d = (await r.json()) as { response?: { aircraft?: { mode_s?: string } } | string };
  const h = typeof d.response === "object" ? d.response.aircraft?.mode_s : undefined;
  return isHex(h) ? h.trim().toLowerCase() : undefined;
}

/** hexdb.io (open, community): registration → Mode S address, as plain text. */
async function hexdbHex(reg: string): Promise<string | undefined> {
  const r = await fetch(`https://hexdb.io/reg-hex?reg=${encodeURIComponent(reg)}`, { signal: timeout(), cache: "no-store" });
  if (!r.ok) return undefined;
  const h = (await r.text()).trim();
  return isHex(h) ? h.toLowerCase() : undefined;
}

/** ADS-B Exchange's open aircraft database (one JSON object per line), loaded once per server instance. */
const ADSBX_DB = "https://downloads.adsbexchange.com/downloads/basic-ac-db.json.gz";
let adsbxDb: Promise<Map<string, string>> | null = null;
function adsbxRegistrations(): Promise<Map<string, string>> {
  adsbxDb ??= fetch(ADSBX_DB, { signal: AbortSignal.timeout(20000), cache: "no-store" })
    .then(async (r) => {
      if (!r.ok) throw new Error(`adsbx db ${r.status}`);
      const text = gunzipSync(Buffer.from(await r.arrayBuffer())).toString("utf8");
      const m = new Map<string, string>();
      for (const line of text.split("\n")) {
        const reg = /"reg":"([^"]+)"/.exec(line)?.[1];
        const icao = /"icao":"([0-9a-fA-F]{6})"/.exec(line)?.[1];
        if (reg && icao) m.set(reg.replace(/[^A-Z0-9]/gi, "").toUpperCase(), icao.toLowerCase());
      }
      return m;
    })
    .catch((e) => {
      adsbxDb = null;
      throw e;
    });
  return adsbxDb;
}

/** Other community networks, live: the aircraft is found by registration while it is flying. */
async function liveHex(base: string, reg: string): Promise<string | undefined> {
  const r = await fetch(`${base}/${encodeURIComponent(reg)}`, { signal: timeout(), cache: "no-store" });
  if (!r.ok) return undefined;
  const d = (await r.json()) as { ac?: { hex?: string }[]; aircraft?: { hex?: string }[] };
  const h = (d.ac ?? d.aircraft ?? [])[0]?.hex;
  return isHex(h) ? h.toLowerCase() : undefined;
}

export const HEX_SOURCES: { key: string; find: (reg: string) => Promise<string | undefined> }[] = [
  { key: "adsb.lol (live)", find: async (reg) => (await aircraftByRegistration(reg).catch(() => []))[0]?.hex?.toLowerCase() },
  { key: "tar1090-db", find: async (reg) => (await registrations()).get(reg.replace(/[^A-Z0-9]/gi, "").toUpperCase()) },
  { key: "ADS-B Exchange db", find: async (reg) => (await adsbxRegistrations()).get(reg.replace(/[^A-Z0-9]/gi, "").toUpperCase()) },
  { key: "adsbdb.com", find: adsbdbHex },
  { key: "hexdb.io", find: hexdbHex },
  { key: "airplanes.live (live)", find: (reg) => liveHex("https://api.airplanes.live/v2/reg", reg) },
  { key: "adsb.fi (live)", find: (reg) => liveHex("https://opendata.adsb.fi/api/v2/registration", reg) },
];

// answers found by the slower sources, kept on this instance
const learned = new Map<string, string>();

/**
 * The aircraft's Mode S address, from the first open source that knows the registration: live on adsb.lol,
 * the tar1090 and ADS-B Exchange databases, adsbdb.com, hexdb.io, then live on airplanes.live and adsb.fi
 * (newer registrations are often missing from the first ones: recent business jets, re-registered aircraft).
 */
export async function hexForRegistration(reg: string): Promise<string | undefined> {
  const key = reg.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  if (learned.has(key)) return learned.get(key);
  for (const [i, src] of HEX_SOURCES.entries()) {
    const h = await src.find(reg.toUpperCase()).catch(() => undefined);
    if (isHex(h)) {
      if (i > 1) learned.set(key, h.toLowerCase());
      return h.toLowerCase();
    }
  }
  return undefined;
}

// airports with a code, for the nearest one to where a flight starts and ends
let airports: { icao: string; lat: number; lon: number; size: number }[] | null = null;
function nearestAirport(lat: number, lon: number): string | undefined {
  airports ??= expandAirports(airportFile as unknown as AirportFile)
    .filter((a) => /^[A-Z]{4}$/.test(a.icao))
    .map((a) => ({ icao: a.icao, lat: a.lat, lon: a.lon, size: a.size ?? 1 }));
  let best: { icao: string; d: number } | undefined;
  const k = Math.cos((lat * Math.PI) / 180);
  for (const a of airports) {
    const dy = a.lat - lat;
    const dx = (a.lon - lon) * k;
    // larger airports win a near tie (a strip next to the big airport)
    const d = Math.hypot(dx, dy) * 60 - a.size * 0.4;
    if (!best || d < best.d) best = { icao: a.icao, d };
  }
  return best && best.d < 6 ? best.icao : undefined;
}

/** The aircraft's flights that took off on `date` (UTC), from its ADS-B trace. */
export async function adsbFlights(reg: string, date: string, knownHex?: string, withDayBefore = false): Promise<FoundFlight[]> {
  const hex = knownHex || (await hexForRegistration(reg));
  // not in any open aircraft database: its ADS-B trace cannot be found from the registration
  if (!hex) throw new AdsbError("not_found", "unknown aircraft", 404);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.ADSBLOL_API_KEY) headers["x-api-key"] = process.env.ADSBLOL_API_KEY;
  const r = await meteredFetch("adsblol", "trace", `${BASE}/1/trace/full/${hex}`, { headers, cache: "no-store" });
  if (r.status === 404) return [];
  if (r.status === 429) throw new AdsbError("quota", "adsb.lol quota reached", 429);
  if (!r.ok) throw new AdsbError("upstream", `adsb.lol ${r.status}`);
  const d = (await r.json()) as { timestamp: number; r?: string; t?: string; trace?: unknown[][] };
  const pts: TracePos[] = [];
  let newLeg = false;
  for (const row of d.trace ?? []) {
    const flags = (row[6] as number) ?? 0;
    if (flags & 2) newLeg = true;
    if (typeof row[1] !== "number" || typeof row[2] !== "number" || flags & 1) continue;
    pts.push({ t: d.timestamp + (row[0] as number), lat: row[1], lon: row[2], alt: row[3] as TracePos["alt"], gs: (row[4] as number | null) ?? null, newLeg });
    newLeg = false;
  }
  return flightsFromTrace(pts)
    .filter((f) => {
      const d = (f.out ?? f.off).slice(0, 10);
      return d === date || (withDayBefore && d < date && d >= new Date(Date.parse(`${date}T12:00:00Z`) - 9 * 86_400_000).toISOString().slice(0, 10));
    })
    .sort((a, b) => (b.out ?? b.off).localeCompare(a.out ?? a.off))
    .map((f) => ({
      id: `adsb-${hex}-${f.off}`,
      registration: d.r ?? reg,
      aircraftType: d.t,
      dep: nearestAirport(f.from.lat, f.from.lon),
      arr: nearestAirport(f.to.lat, f.to.lon),
      out: f.out,
      off: f.off,
      on: f.on,
      in: f.in,
      source: "adsb" as const,
    }));
}
