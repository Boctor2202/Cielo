import { describe, expect, it } from "vitest";
import { deriveFlightTimes, landingsFill, legsToRows, sabLandings } from "../src";

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

describe("EP5 read again over a logbook without landings", () => {
  const logged = { id: "a", takeoffsDay: 0, takeoffsNight: 0, landingsDay: 0, landingsNight: 0, pilotFlying: false, remarks: undefined, signatureId: null, locked: false } as never;
  const read = { takeoffsDay: 1, takeoffsNight: 0, landingsDay: 0, landingsNight: 1, remarks: "HUD" } as never;
  it("adds the takeoffs, landings and HUD to the logged flight", () => {
    expect(landingsFill(read, logged)).toMatchObject({ id: "a", takeoffsDay: 1, landingsNight: 1, pilotFlying: true, remarks: "HUD" });
  });
  it("leaves a signed flight or one that already has landings", () => {
    expect(landingsFill(read, { ...(logged as object), signatureId: "s" } as never)).toBeNull();
    expect(landingsFill(read, { ...(logged as object), landingsDay: 1 } as never)).toBeNull();
  });
});
