/**
 * Actual flight times from FlightAware AeroAPI (v4), looked up by aircraft registration and date, server-side
 * with FLIGHTAWARE_API_KEY (x-apikey header). Recent flights (≤ 10 days) come from /flights/{ident},
 * older ones from /history/flights/{ident}. Nothing is stored.
 */

export interface FoundFlight {
  id: string;
  ident?: string;
  registration?: string;
  aircraftType?: string;
  dep?: string;
  arr?: string;
  /** UTC ISO date-times */
  out?: string;
  off?: string;
  on?: string;
  in?: string;
  status?: string;
  blocked?: boolean;
  diverted?: boolean;
  cancelled?: boolean;
}

export class FlightAwareError extends Error {
  constructor(public code: "not_configured" | "not_found" | "upstream" | "history_off", message: string, public status = 502) {
    super(message);
  }
}

interface FaFlight {
  fa_flight_id: string;
  ident?: string;
  registration?: string | null;
  aircraft_type?: string | null;
  origin?: { code_icao?: string | null; code?: string | null } | null;
  destination?: { code_icao?: string | null; code?: string | null } | null;
  actual_out?: string | null;
  actual_off?: string | null;
  actual_on?: string | null;
  actual_in?: string | null;
  status?: string;
  blocked?: boolean;
  diverted?: boolean;
  cancelled?: boolean;
}

/** FlightAware idents for registrations drop the dash: F-HBXA → FHBXA, N123AB stays N123AB. */
export const faIdent = (registration: string) => registration.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

const addDay = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);

/** Flights of one aircraft on one UTC day (a day either side is searched so late/early flights are found). */
export async function flightsForRegistration(registration: string, date: string): Promise<FoundFlight[]> {
  const key = process.env.FLIGHTAWARE_API_KEY;
  if (!key) throw new FlightAwareError("not_configured", "FLIGHTAWARE_API_KEY is not set", 503);
  const ident = faIdent(registration);
  const ageDays = (Date.now() - Date.parse(`${date}T00:00:00Z`)) / 86400_000;
  const recent = ageDays < 9;
  const qs = new URLSearchParams({ ident_type: "registration", start: addDay(date, -1), end: addDay(date, 2), max_pages: "2" });
  const path = recent ? `/flights/${encodeURIComponent(ident)}` : `/history/flights/${encodeURIComponent(ident)}`;
  const r = await fetch(`https://aeroapi.flightaware.com/aeroapi${path}?${qs}`, { headers: { "x-apikey": key, Accept: "application/json" }, cache: "no-store" });
  if (r.status === 404) return [];
  // the key's plan has no history (AeroAPI Personal): only the last ten days or so
  if (!recent && (r.status === 401 || r.status === 403)) throw new FlightAwareError("history_off", "no historical data on this AeroAPI plan", 403);
  if (!r.ok) throw new FlightAwareError("upstream", `AeroAPI ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = (await r.json()) as { flights?: FaFlight[] };
  return (d.flights ?? [])
    .filter((f) => !f.cancelled)
    .map((f) => ({
      id: f.fa_flight_id,
      ident: f.ident,
      registration: f.registration ?? undefined,
      aircraftType: f.aircraft_type ?? undefined,
      dep: f.origin?.code_icao ?? f.origin?.code ?? undefined,
      arr: f.destination?.code_icao ?? f.destination?.code ?? undefined,
      out: f.actual_out ?? undefined,
      off: f.actual_off ?? undefined,
      on: f.actual_on ?? undefined,
      in: f.actual_in ?? undefined,
      status: f.status,
      blocked: f.blocked,
      diverted: f.diverted,
    }))
    // keep the flights that departed on the requested UTC day
    .filter((f) => (f.out ?? f.off ?? "").slice(0, 10) === date)
    .sort((a, b) => (a.out ?? a.off ?? "").localeCompare(b.out ?? b.off ?? ""));
}

interface FaPosition {
  timestamp: string;
  latitude: number;
  longitude: number;
  /** hundreds of feet */
  altitude?: number | null;
  groundspeed?: number | null;
}

/**
 * The recorded positions of one FlightAware flight, as [unix s, lat, lon, alt ft, gs kt]. Recent flights come
 * from /flights/{id}/track, older ones from /history/flights/{id}/track.
 */
export async function trackForFlight(faFlightId: string, recent: boolean): Promise<[number, number, number, number | null, number | null][]> {
  const key = process.env.FLIGHTAWARE_API_KEY;
  if (!key) throw new FlightAwareError("not_configured", "FLIGHTAWARE_API_KEY is not set", 503);
  const path = `${recent ? "" : "/history"}/flights/${encodeURIComponent(faFlightId)}/track`;
  const r = await fetch(`https://aeroapi.flightaware.com/aeroapi${path}`, { headers: { "x-apikey": key, Accept: "application/json" }, cache: "no-store" });
  if (r.status === 404) throw new FlightAwareError("not_found", "no track", 404);
  if (!recent && (r.status === 401 || r.status === 403)) throw new FlightAwareError("history_off", "no historical data on this AeroAPI plan", 403);
  if (!r.ok) throw new FlightAwareError("upstream", `AeroAPI ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = (await r.json()) as { positions?: FaPosition[] };
  return (d.positions ?? [])
    .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
    .map((p) => [Math.round(Date.parse(p.timestamp) / 1000), p.latitude, p.longitude, p.altitude != null ? p.altitude * 100 : null, p.groundspeed ?? null]);
}

/** The flight of that aircraft whose block (or runway) times are closest to the logged ones, within 45 min. */
export function matchFlight(flights: FoundFlight[], outUtc: string, inUtc: string): FoundFlight | undefined {
  const t0 = Date.parse(outUtc);
  const t1 = Date.parse(inUtc);
  let best: { f: FoundFlight; d: number } | undefined;
  for (const f of flights) {
    const a = Date.parse(f.out ?? f.off ?? "");
    const b = Date.parse(f.in ?? f.on ?? "");
    if (Number.isNaN(a) || Number.isNaN(b)) continue;
    const d = Math.abs(a - t0) + Math.abs(b - t1);
    if (d <= 90 * 60_000 && (!best || d < best.d)) best = { f, d };
  }
  return best?.f;
}

/**
 * How long a stored answer stands: a day that ended over a day ago is final; a recent one is asked again only
 * while some of its flights are not finished (no block-in yet), and not more than every 20 min.
 */
export function stillGood(day: string, fetchedAt: string, flights: FoundFlight[]): boolean {
  const dayEnd = Date.parse(`${day}T23:59:59Z`);
  if (Date.parse(fetchedAt) - dayEnd > 24 * 3600_000) return true;
  const open = flights.some((f) => !f.in && !f.on);
  if (!open && flights.length && Date.parse(fetchedAt) > dayEnd) return true;
  return Date.now() - Date.parse(fetchedAt) < 20 * 60_000;
}
