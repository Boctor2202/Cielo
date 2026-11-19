import { describe, expect, it } from "vitest";
import { experienceFromLogbook } from "../src";
import { operatorIndex, type Flight } from "@cielo/core";
describe("experienceFromLogbook", () => {
  const f = (o: Partial<Flight>): Flight => ({ id: Math.random().toString(36), date: "2026-01-01", depIcao: "LFPB", arrIcao: "EGSC", totalMin: 60, function: "SIC", deletedAt: null, ...o }) as Flight;
  it("one experience per operator, most recent first, skipping those already on the CV", () => {
    const flights = [
      f({ date: "2024-03-02", flightNumber: "AFR12", aircraftTypeIcao: "A320", function: "SIC" }),
      f({ date: "2025-01-10", flightNumber: "AFR13", aircraftTypeIcao: "A320", function: "SIC" }),
      f({ date: "2026-11-12", flightNumber: "AJD214K", aircraftTypeIcao: "C68A" }),
      f({ date: "2026-05-01", flightNumber: "AJD100", aircraftTypeIcao: "C68A" }),
      f({ date: "2026-06-01", operator: "Aéroclub de Paris", aircraftTypeIcao: "DR40", function: "PIC", depIcao: "LFPN" }),
    ];
    const s = experienceFromLogbook(flights, operatorIndex(flights), [{ role: "Pilot", employer: "Aéroclub de Paris", start: "2020-01", bullets: [] }], "2026-11-19");
    expect(s.map((x) => [x.employer, x.role, x.start, x.end ?? "now", x.aircraft?.join()])).toEqual([
      ["Astonjet Ltd", "First Officer", "2026-05", "now", "C68A"],
      ["Air France", "First Officer", "2024-03", "2025-01", "A320"],
    ]);
  });
});
