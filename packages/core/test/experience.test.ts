import { describe, expect, it } from "vitest";
import { experience, picIncludingPicus, goalValue, type Flight, type OpeningBalance } from "../src";

const ENGINE: Record<string, string> = { A320: "jet", C68A: "jet", AT76: "turboprop", PC12: "turboprop", C172: "piston" };
const engineOf = (i: string) => ENGINE[i];
const f = (type: string, totalMin: number, extra: Partial<Flight> = {}) =>
  ({ aircraftTypeIcao: type, isFstd: false, totalMin, picMin: 0, picusMin: 0, copilotMin: 0, dualMin: 0, instructorMin: 0, examinerMin: 0, multiPilotMin: 0, singlePilotSeMin: 0, singlePilotMeMin: 0, fstdMin: 0, ...extra }) as Flight;

describe("experience definitions", () => {
  const flights = [
    f("A320", 120, { picMin: 120, multiPilotMin: 120 }),
    f("A320", 90, { picusMin: 90, multiPilotMin: 90 }),
    f("A320", 100, { copilotMin: 100, multiPilotMin: 100 }),
    f("AT76", 60, { picMin: 60, multiPilotMin: 60 }),
    f("PC12", 45, { picMin: 45, singlePilotSeMin: 45 }),
    f("C172", 50, { picMin: 50, singlePilotSeMin: 50 }),
    f("ZZZZ", 30, { picMin: 30 }),
    f("A320", 240, { isFstd: true, fstdMin: 240, picMin: 240 }),
    f("A320", 500, { picMin: 500, deletedAt: "2026-01-01" }),
  ];
  const x = experience(flights, [], engineOf);
  it("keeps PIC strict: PICUS apart, simulator and deleted rows out, minutes exact", () => {
    expect(x.picMin).toBe(120 + 60 + 45 + 50 + 30);
    expect(x.picusMin).toBe(90);
    expect(picIncludingPicus(x)).toBe(305 + 90);
    expect(x.totalMin).toBe(120 + 90 + 100 + 60 + 45 + 50 + 30);
    expect(x.simMin).toBe(240);
    expect(x.sicMin).toBe(100);
  });
  it("PIC on jet or multi-engine turboprop: a single-engine turboprop and a piston do not count", () => {
    expect(x.picJetMin).toBe(120);
    expect(x.picMeTurbopropMin).toBe(60);
    expect(x.picJetOrMeTurbopropMin).toBe(180);
    expect(x.turbineMin).toBe(120 + 90 + 100 + 60 + 45);
  });
  it("never guesses an unknown engine", () => {
    expect(x.unknown.engineMin).toBe(30);
    expect(x.jetMin).toBe(310);
  });
  it("type rows keep PIC and PICUS apart", () => {
    expect(x.byType.A320).toEqual({ totalMin: 310, picMin: 120, picusMin: 90, sicMin: 100 });
  });
  it("carry-forwards: no type → not attributed to jet/turbine; paper PIC flagged as possibly including PICUS", () => {
    const opening = [
      { totalMin: 600, picMin: 300, copilotMin: 0, dualMin: 0, instructorMin: 0, multiPilotMin: 0, singlePilotSeMin: 600, singlePilotMeMin: 0, fstdMin: 0 },
      { totalMin: 200, picMin: 200, copilotMin: 0, dualMin: 0, instructorMin: 0, multiPilotMin: 200, singlePilotSeMin: 0, singlePilotMeMin: 0, fstdMin: 0, aircraftTypeIcao: "C68A" },
    ] as OpeningBalance[];
    const y = experience([], opening, engineOf);
    expect(y.totalMin).toBe(800);
    expect(y.picMin).toBe(500);
    expect(y.picJetMin).toBe(200);
    expect(y.unknown.openingNoTypeMin).toBe(600);
    expect(y.unknown.openingPicMin).toBe(500);
  });
  it("goals count PIC strictly", () => {
    expect(goalValue("pic", flights, [])).toBe(305);
  });
});
