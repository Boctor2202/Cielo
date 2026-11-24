import { describe, expect, it } from "vitest";
import { TABULAR_HEADERS, flightsToRows } from "../src";

describe("HUD in the exports", () => {
  it("has its own CSV columns", () => {
    const f = { id: "a", date: "2026-11-01", depIcao: "LFPG", arrIcao: "EGCC", totalMin: 90, singlePilotSeMin: 0, singlePilotMeMin: 0, multiPilotMin: 90, picMin: 0, picusMin: 0, copilotMin: 90, dualMin: 0, instructorMin: 0, examinerMin: 0, nightMin: 0, ifrMin: 90, actualImcMin: 0, xcMin: 0, takeoffsDay: 1, takeoffsNight: 0, landingsDay: 1, landingsNight: 0, pilotFlying: true, hudTakeoffs: 1, hudLandings: 1, function: "SIC", isFstd: false, fstdMin: 0, approaches: [] } as never;
    const [row] = flightsToRows([f]);
    expect(row![TABULAR_HEADERS.indexOf("HUD takeoffs")]).toBe(1);
    expect(row![TABULAR_HEADERS.indexOf("HUD landings")]).toBe(1);
    expect(row!.length).toBe(TABULAR_HEADERS.length);
  });
});
