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
    const f = deriveFlightTimes(row!.input!, { airports: () => undefined });
    expect(f.takeoffsDay + f.takeoffsNight).toBe(0);
    expect(f.landingsDay + f.landingsNight).toBe(1);
  });
});

describe("EP5 read again over a logbook without landings", () => {
  const logged = { id: "a", takeoffsDay: 0, takeoffsNight: 0, landingsDay: 0, landingsNight: 0, pilotFlying: false, remarks: undefined, signatureId: null, locked: false } as never;
  const read = { takeoffsDay: 1, takeoffsNight: 0, landingsDay: 0, landingsNight: 1, hudTakeoffs: 1, hudLandings: 1 } as never;
  it("adds the takeoffs, landings and HUD counts to the logged flight", () => {
    expect(landingsFill(read, logged)).toMatchObject({ id: "a", takeoffsDay: 1, landingsNight: 1, pilotFlying: true, hudTakeoffs: 1, hudLandings: 1 });
  });
  it("adds the HUD counts to a flight imported with its landings and a HUD note", () => {
    const earlier = { ...(logged as object), takeoffsDay: 1, landingsNight: 1, pilotFlying: true, remarks: "HUD" } as never;
    expect(landingsFill(read, earlier)).toMatchObject({ hudTakeoffs: 1, hudLandings: 1, remarks: undefined, takeoffsDay: 1 });
  });
  it("leaves a signed flight or one that already has landings", () => {
    expect(landingsFill(read, { ...(logged as object), signatureId: "s" } as never)).toBeNull();
    expect(landingsFill(read, { ...(logged as object), landingsDay: 1, hudLandings: 1 } as never)).toBeNull();
  });
});

describe("HUD recency", () => {
  it("needs 3 HUD takeoffs and 3 HUD landings in 90 days, only for a pilot who flies with the HUD", async () => {
    const { computeRecency, computeCurrency } = await import("../src");
    const f = (date: string, hud: number) => ({ id: date, date, takeoffsDay: 1, takeoffsNight: 0, landingsDay: 1, landingsNight: 0, hudTakeoffs: hud, hudLandings: hud, aircraftTypeIcao: "A320", isFstd: false, approaches: [] }) as never;
    expect(computeRecency([f("2026-11-01", 0)], "2026-11-24").hud).toBeUndefined();
    const r = computeRecency([f("2026-11-01", 1), f("2026-10-01", 1), f("2026-09-10", 1)], "2026-11-24");
    expect(r.hud).toMatchObject({ valid: true, takeoffs: 3, landings: 3, validUntil: "2026-12-08" });
    expect(computeRecency([f("2026-11-01", 1), f("2026-10-01", 1)], "2026-11-24").hud).toMatchObject({ valid: false });
    expect(computeCurrency([f("2026-11-01", 1)], "2026-11-24", { framework: "EASA" }).some((i) => i.kind === "hud")).toBe(true);
  });
  it("reads the HUD counts from the SAB code", () => {
    const [row] = legsToRows([{ date: "2026-09-02", dep: "LFPG", arr: "EGCC", out: "10:00", in: "11:30", totalMin: 90, takeoffs: 0, landings: 1, hudTakeoffs: 0, hudLandings: 1 }], (c) => c, { function: "SIC", pilotFlying: false, airline: true });
    expect([row!.input!.hudTakeoffs, row!.input!.hudLandings]).toEqual([undefined, 1]);
  });
});
