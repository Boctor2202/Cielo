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
  constructor(public code: "not_configured" | "not_found" | "upstream", message: string, public status = 502) {
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
