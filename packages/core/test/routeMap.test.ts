import { describe, expect, it } from "vitest";
import { decodeShareRoutes, encodeShareRoutes, routeMapChoices, routeMapFlights, routeMapTotals, type Flight } from "../src";

const AP: Record<string, { lat: number; lon: number; country: string }> = {
  LFPG: { lat: 49.0, lon: 2.55, country: "FR" },
  EGLL: { lat: 51.47, lon: -0.45, country: "GB" },
  LFMN: { lat: 43.66, lon: 7.21, country: "FR" },
};
const f = (date: string, dep: string, arr: string, extra: Partial<Flight> = {}) => ({ id: date + dep + arr, date, depIcao: dep, arrIcao: arr, aircraftTypeIcao: "A320", ...extra }) as Flight;
const flights = [f("2025-03-01", "LFPG", "EGLL"), f("2025-03-02", "EGLL", "LFPG"), f("2024-05-01", "LFPG", "LFMN", { aircraftTypeIcao: "A321" }), f("2025-04-01", "LFPG", "LFMN", { isFstd: true }), f("2025-06-01", "LFPG", "EGLL", { deletedAt: "2025-06-02" })];

describe("route map", () => {
  it("counts flights, airports, miles and countries", () => {
    const t = routeMapTotals(routeMapFlights(flights, { period: "all" }), (i) => AP[i]);
    expect(t).toMatchObject({ flights: 3, airports: 3, countries: 2 });
    expect(t.routes[0]).toEqual({ a: "EGLL", b: "LFPG", n: 2 });
    expect(t.nm).toBeGreaterThan(2 * 180);
  });
  it("filters by year, last 12 months and type", () => {
    expect(routeMapFlights(flights, { period: "2024" })).toHaveLength(1);
    expect(routeMapFlights(flights, { period: "12m" }, new Date("2026-01-15"))).toHaveLength(2);
    expect(routeMapFlights(flights, { period: "all", type: "A321" })).toHaveLength(1);
    expect(routeMapChoices(flights)).toEqual({ years: ["2025", "2024"], types: ["A320", "A321"] });
  });
  it("encodes the routes for the share image", () => {
    const r = [{ a: "EGLL", b: "LFPG", n: 2 }];
    expect(decodeShareRoutes(encodeShareRoutes(r))).toEqual(r);
    expect(decodeShareRoutes("bad,<x>.y.1")).toEqual([]);
  });
});
