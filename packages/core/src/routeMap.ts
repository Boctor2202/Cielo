import { distanceNm, type LatLon } from "./geo";
import type { Flight } from "./types";

/** Which flights the route map shows: a period and, optionally, one aircraft type. */
export interface RouteMapFilter {
  /** "all", "12m" (the last twelve months) or a year ("2025") */
  period: string;
  /** an aircraft type ICAO code, or "" for every type */
  type?: string;
}

export interface RouteMapTotals {
  flights: number;
  airports: number;
  nm: number;
  countries: number;
  /** each route flown once per direction pair, with how many times */
  routes: { a: string; b: string; n: number }[];
  /** each airport, with how many departures and arrivals */
  visits: Map<string, number>;
}

type AirportLookup = (icao: string) => (LatLon & { country?: string }) | undefined;

/** Keeps the flights of the map: real flights (no simulator), in the period, of the type. */
export function routeMapFlights(flights: Flight[], filter: RouteMapFilter, today = new Date()): Flight[] {
  const from12 = new Date(Date.UTC(today.getUTCFullYear() - 1, today.getUTCMonth(), today.getUTCDate())).toISOString().slice(0, 10);
  return flights.filter((f) => {
    if (f.deletedAt || f.isFstd) return false;
    if (filter.period === "12m" ? f.date < from12 : filter.period !== "all" && !f.date.startsWith(filter.period)) return false;
    return !filter.type || f.aircraftTypeIcao === filter.type;
  });
}

/** The four totals of the map (flights, airports, nautical miles flown, countries) and its routes. */
export function routeMapTotals(flights: Flight[], airport: AirportLookup): RouteMapTotals {
  const routes = new Map<string, { a: string; b: string; n: number }>();
  const visits = new Map<string, number>();
  const countries = new Set<string>();
  let nm = 0;
  for (const f of flights) {
    for (const icao of [f.depIcao, f.arrIcao]) {
      if (!icao) continue;
      visits.set(icao, (visits.get(icao) ?? 0) + 1);
      const c = airport(icao)?.country;
      if (c) countries.add(c);
    }
    if (!f.depIcao || !f.arrIcao || f.depIcao === f.arrIcao) continue;
    const A = airport(f.depIcao);
    const B = airport(f.arrIcao);
    if (A && B) nm += distanceNm(A, B);
    const [a, b] = [f.depIcao, f.arrIcao].sort() as [string, string];
    const k = `${a}-${b}`;
    routes.set(k, { a, b, n: (routes.get(k)?.n ?? 0) + 1 });
  }
  return { flights: flights.length, airports: visits.size, nm: Math.round(nm), countries: countries.size, routes: [...routes.values()].sort((x, y) => y.n - x.n), visits };
}

/** The years with flights, newest first, and the aircraft types flown (most flown first). */
export function routeMapChoices(flights: Flight[]): { years: string[]; types: string[] } {
  const years = new Set<string>();
  const types = new Map<string, number>();
  for (const f of flights) {
    if (f.deletedAt || f.isFstd) continue;
    years.add(f.date.slice(0, 4));
    if (f.aircraftTypeIcao) types.set(f.aircraftTypeIcao, (types.get(f.aircraftTypeIcao) ?? 0) + 1);
  }
  return { years: [...years].sort().reverse(), types: [...types.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t) };
}

/** The routes for the share image, as "LFPG.EGLL.3" joined by commas (the most flown first, up to `max`). */
export const encodeShareRoutes = (routes: { a: string; b: string; n: number }[], max = 300) =>
  routes
    .slice(0, max)
    .map((r) => `${r.a}.${r.b}.${r.n}`)
    .join(",");

export function decodeShareRoutes(s: string | null | undefined): { a: string; b: string; n: number }[] {
  return (s ?? "")
    .split(",")
    .slice(0, 300)
    .flatMap((x) => {
      const m = /^([A-Z0-9]{3,4})\.([A-Z0-9]{3,4})\.(\d{1,5})$/.exec(x.trim().toUpperCase());
      return m ? [{ a: m[1]!, b: m[2]!, n: Number(m[3]) }] : [];
    });
}
