import { describe, expect, it } from "vitest";
import { callsignPrefix, logbookGains, operatorIndex, type Flight } from "../src";

const f = (o: Partial<Flight>): Flight => ({ id: o.id ?? Math.random().toString(36), date: "2026-11-01", depIcao: "LFPB", arrIcao: "EGSC", totalMin: 60, nightMin: 0, landingsDay: 1, landingsNight: 0, deletedAt: null, ...o }) as Flight;

describe("operators", () => {
  it("reads the designator of a flight number or call sign", () => {
    expect(callsignPrefix("AFR1234")).toEqual({ icao: "AFR" });
    expect(callsignPrefix("AJD214K")).toEqual({ icao: "AJD" });
    expect(callsignPrefix("AF 1234")).toEqual({ iata: "AF" });
    expect(callsignPrefix("1234")).toEqual({});
  });
  it("recognises from the table, the aircraft, and what the logbook teaches", () => {
    const flights = [
      f({ flightNumber: "AJD214K", operator: "Astonjet" }),
      f({ flightNumber: "AJD301A" }),
      f({ flightNumber: "AF1234" }),
      f({ registration: "9H-J4K" }),
      f({ flightNumber: "XYZ1", registration: "F-HZUN" }),
    ];
    const idx = operatorIndex(flights, [{ registration: "9H-J4K", operator: "Astonjet", deletedAt: null }]);
    expect(idx.of(flights[1]!)).toBe("Astonjet");
    expect(idx.of(flights[2]!)).toBe("Air France");
    expect(idx.of(flights[3]!)).toBe("Astonjet");
    expect(idx.of(flights[4]!)).toBeUndefined();
    expect(idx.all[0]).toBe("Astonjet");
  });
});

describe("logbookGains", () => {
  const ap = (icao: string) => ({ LFPB: { country: "FR", lat: 48.97, lon: 2.44 }, EGSC: { country: "GB", lat: 52.2, lon: 0.18 }, LIML: { country: "IT", lat: 45.45, lon: 9.28 } })[icao];
  it("counts what the new flights added", () => {
    const old = f({ id: "a" });
    const nw = f({ id: "b", arrIcao: "LIML", totalMin: 90, aircraftTypeIcao: "C68A" });
    const g = logbookGains([old, nw], ["b"], ap);
    expect(g.flights).toBe(1);
    expect(g.minutes).toBe(90);
    expect(g.nm).toBeGreaterThan(300);
    expect(g.newAirports).toEqual(["LIML"]);
    expect(g.newCountries).toEqual(["IT"]);
    expect(g.newTypes).toEqual(["C68A"]);
  });
});
