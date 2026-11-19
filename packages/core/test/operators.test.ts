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
    expect(operatorIndex([f({ flightNumber: "AJD214K" })]).of({ flightNumber: "AJD214K" })).toBe("Astonjet Ltd");
    expect(operatorIndex([]).of({ flightNumber: "ASJ12" })).toBe("Astonjet SAS");
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

import { searchOperators } from "../src";
describe("searchOperators", () => {
  it("finds by name, code and letters in order, logbook first", () => {
    expect(searchOperators("astonjet").map((h) => h.name)).toEqual(expect.arrayContaining(["Astonjet SAS", "Astonjet Ltd"]));
    expect(searchOperators("AFR")[0]?.name).toBe("Air France");
    expect(searchOperators("U2")[0]?.name).toBe("easyJet");
    expect(searchOperators("netj").map((h) => h.name)).toContain("NetJets Europe");
    expect(searchOperators("", ["Aéroclub de Paris"])[0]).toMatchObject({ name: "Aéroclub de Paris", known: true });
    expect(searchOperators("aero", ["Aéroclub de Paris"])[0]?.name).toBe("Aéroclub de Paris");
  });
});

import { readFileSync } from "node:fs";
import { airlineDirectory } from "../src";
describe("world airline directory", () => {
  const file = JSON.parse(readFileSync(new URL("../../reference-data/data/airlines.json", import.meta.url), "utf8"));
  const dir = airlineDirectory(file.rows);
  it("knows the airlines of the world, our table on top", () => {
    expect(dir.all.length).toBeGreaterThan(5000);
    expect(dir.byIcao("AJD")?.name).toBe("Astonjet Ltd");
    expect(dir.byIcao("ASJ")?.country).toBe("France");
    expect(dir.byIcao("LXJ")?.name).toBe("Flexjet");
    expect(dir.byIcao("QFA")?.name).toBe("Qantas");
    expect(dir.byIcao("SAA")?.name).toBe("South African Airways");
  });
  it("searches by name, code and call sign", () => {
    expect(searchOperators("ryanair", [], 8, dir)[0]?.name).toBe("Ryanair");
    expect(searchOperators("EXECJET", [], 8, dir)[0]?.name).toBe("NetJets");
    expect(searchOperators("CATCH ME", [], 8, dir)[0]?.name).toBe("Astonjet Ltd");
    expect(searchOperators("luxair", [], 8, dir)[0]?.name).toBe("Luxair");
    expect(searchOperators("qantas", [], 8, dir).map((h) => h.name)).toContain("Qantas");
  });
  it("recognises a flight number of any airline", () => {
    expect(operatorIndex([], [], dir).of({ flightNumber: "QTR15" })).toBe("Qatar Airways");
    expect(operatorIndex([], [], dir).of({ flightNumber: "SVA123" })).toBeTruthy();
  });
});
