import { describe, expect, it } from "vitest";
import { deriveFlightTimes, legsToRows, sabLandings } from "../src";

describe("Air France SAB code", () => {
  it("reads takeoffs and landings from the middle letter", () => {
    expect(sabLandings("JHD")).toEqual({ takeoffs: 1, landings: 1, hud: true });
    expect(sabLandings("JBD")).toEqual({ takeoffs: 1, landings: 1, hud: false });
    expect(sabLandings("JTD")).toEqual({ takeoffs: 1, landings: 0, hud: false });
    expect(sabLandings("JLD")).toEqual({ takeoffs: 0, landings: 1, hud: false });
    expect(sabLandings("JGD")).toEqual({ takeoffs: 1, landings: 0, hud: true });
    expect(sabLandings("JKD")).toEqual({ takeoffs: 0, landings: 1, hud: true });
    expect(sabLandings("JND")).toEqual({ takeoffs: 0, landings: 0, hud: false });
    expect(sabLandings(undefined)).toBeNull();
  });
  it("logs a landing only for the leg the pilot landed", () => {
    const [row] = legsToRows([{ date: "2026-09-02", dep: "LFPG", arr: "EGCC", out: "10:00", in: "11:30", totalMin: 90, takeoffs: 0, landings: 1 }], (c) => c, { function: "SIC", pilotFlying: false, airline: true });
    const f = deriveFlightTimes(row!.input, { airports: () => undefined });
    expect(f.takeoffsDay + f.takeoffsNight).toBe(0);
    expect(f.landingsDay + f.landingsNight).toBe(1);
  });
});
