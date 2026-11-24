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

describe("Air France aircraft codes and flights confirmed from the roster", () => {
  it("reads the A220-300 from the EP5 and from the crew calendar", async () => {
    const { airFranceType, icalToRosterEvent, parseIcal } = await import("../src");
    expect(airFranceType("U-23")).toBe("BCS3");
    expect(airFranceType("223")).toBe("BCS3");
    expect(airFranceType("999")).toBeUndefined();
    const [ev] = parseIcal("BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:x\nSUMMARY:AF1747 (AGP-CDG) 223\nDTSTART:20261120T1200Z\nDTEND:20261120T1440Z\nEND:VEVENT\nEND:VCALENDAR");
    expect(icalToRosterEvent(ev!, "p", (c) => ({ AGP: "LEMG", CDG: "LFPG" })[c]).aircraftTypeIcao).toBe("BCS3");
  });
  it("replaces a roster flight by the statement's flight, same id", async () => {
    const { findDuplicate } = await import("../src");
    const planned = { id: "r", date: "2026-11-20", depIcao: "LEMG", arrIcao: "LFPG", outUtc: "2026-11-20T12:00:00.000Z", totalMin: 160, source: "roster", isFstd: false, takeoffsDay: 1, takeoffsNight: 0, landingsDay: 1, landingsNight: 0, pilotFlying: true, createdAt: "c", rosterEventId: "e", signatureId: null, locked: false } as never;
    const actual = { id: "n", date: "2026-11-20", depIcao: "LEMG", arrIcao: "LFPG", outUtc: "2026-11-20T12:40:00.000Z", totalMin: 151, isFstd: false, registration: "F-HZUA", aircraftTypeIcao: "BCS3", takeoffsDay: 0, takeoffsNight: 0, landingsDay: 0, landingsNight: 0, pilotFlying: false, hudTakeoffs: 0, hudLandings: 0 } as never;
    expect(findDuplicate(actual, [planned])?.flight.id).toBe("r");
    expect(landingsFill(actual, planned, "now", true)).toMatchObject({ id: "r", createdAt: "c", rosterEventId: "e", registration: "F-HZUA", aircraftTypeIcao: "BCS3", totalMin: 151, pilotFlying: false, landingsDay: 0 });
  });
});

describe("HUD widget on the Overview", () => {
  it("is offered to a pilot flying with a HUD, and stays off once taken off", async () => {
    const { dashboardWidgets, dashboardValue, isHudPilot, hudSummary } = await import("../src");
    const f = { id: "a", date: "2026-11-01", hudTakeoffs: 1, hudLandings: 1, isFstd: false } as never;
    expect(isHudPilot([f])).toBe(true);
    expect(isHudPilot([{ id: "b", date: "2026-11-01", operator: "Air France" } as never])).toBe(true);
    expect(isHudPilot([{ id: "c", date: "2026-11-01" } as never])).toBe(false);
    const shown = dashboardWidgets(undefined, { hud: true });
    expect(shown[1]).toEqual({ id: "hud", size: "l" });
    const saved = dashboardValue(shown.filter((w) => w.id !== "hud"), { dashboard: dashboardValue(shown) });
    expect(saved.dropped).toEqual(["hud"]);
    expect(dashboardWidgets({ dashboard: saved }, { hud: true }).some((w) => w.id === "hud")).toBe(false);
    expect(hudSummary([f], "2026-11-24")).toEqual({ takeoffs: 1, landings: 1, takeoffs90: 1, landings90: 1 });
  });
});
