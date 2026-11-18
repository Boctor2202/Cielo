import { describe, expect, it } from "vitest";
import { defaultGoals, goalProgress, type Flight, type OpeningBalance } from "../src";

const f = (date: string, type: string, totalMin: number, extra: Partial<Flight> = {}) =>
  ({ id: date + type, date, aircraftTypeIcao: type, isFstd: false, totalMin, picMin: 0, picusMin: 0, multiPilotMin: totalMin, nightMin: 0, ifrMin: totalMin, landingsDay: 1, landingsNight: 0, ...extra }) as unknown as Flight;
const opening = [{ id: "o", totalMin: 600, picMin: 300, multiPilotMin: 0, nightMin: 60, ifrMin: 0, aircraftTypeIcao: "C172" }] as unknown as OpeningBalance[];

describe("goals", () => {
  const flights = [f("2026-10-01", "C68A", 120), f("2026-11-01", "C68A", 90, { picMin: 90 })];
  it("counts hours on a type, carried totals included, and the pace to a deadline", () => {
    const p = goalProgress({ id: "g", kind: "type", icao: "C68A", target: 600, by: "2027-02-08" }, flights, opening, "2026-11-10");
    expect(p.done).toBe(210);
    expect(p.left).toBe(390);
    expect(p.daysLeft).toBe(90);
    expect(p.perMonth).toBe(130);
  });
  it("adds the paper totals to total and PIC, and offers the next milestones", () => {
    expect(goalProgress({ id: "t", kind: "total", target: 60000 }, flights, opening, "2026-11-10").done).toBe(810);
    expect(defaultGoals(flights, opening).map((g) => g.target / 60)).toEqual([100, 100]);
  });
});

describe("goal projection", () => {
  it("projects the date from the pace of the last 12 months", async () => {
    const { goalProgress } = await import("../src/goals");
    // 100 h flown in the last year, 50 h left → about half a year
    const flights = Array.from({ length: 100 }, (_, i) => ({ date: `2026-${String((i % 10) + 1).padStart(2, "0")}-10`, totalMin: 60, isFstd: false } as never));
    const p = goalProgress({ id: "g", kind: "total", target: 150 * 60, by: "2027-12-31" }, flights, [], "2026-11-18");
    expect(p.lastYear).toBe(6000);
    expect(p.eta! > "2027-05-01" && p.eta! < "2027-06-01").toBe(true);
    expect(p.onTrack).toBe(true);
    const idle = goalProgress({ id: "g", kind: "total", target: 150 * 60 }, [], [], "2026-11-18");
    expect(idle.eta).toBeUndefined();
  });
});
