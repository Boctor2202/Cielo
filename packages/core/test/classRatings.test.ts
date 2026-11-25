import { describe, expect, it } from "vitest";
import { classRatingStatus, pistonClassOf } from "../src";

const types = [
  { id: "ref-C172", icao: "C172", category: "airplane", engineType: "piston", engineCount: 1, multiPilot: false, classOrTypeRating: "SEP(land)" },
  { id: "ref-DA42", icao: "DA42", category: "airplane", engineType: "piston", engineCount: 2, multiPilot: false, classOrTypeRating: "MEP(land)" },
  { id: "ref-A320", icao: "A320", category: "airplane", engineType: "jet", engineCount: 2, multiPilot: true, classOrTypeRating: "A320" },
] as never[];
const fl = (date: string, type: string, o: Record<string, number> = {}) =>
  ({ id: date + type, date, aircraftTypeIcao: type, isFstd: false, totalMin: 60, picMin: 60, dualMin: 0, takeoffsDay: 1, takeoffsNight: 0, landingsDay: 1, landingsNight: 0, ...o }) as never;

describe("SEP and MEP class ratings", () => {
  it("reads the class of a flight", () => {
    expect(pistonClassOf(fl("2026-01-01", "C172"), types)).toBe("SEP");
    expect(pistonClassOf(fl("2026-01-01", "DA42"), types)).toBe("MEP");
    expect(pistonClassOf(fl("2026-01-01", "A320"), types)).toBeUndefined();
  });
  it("follows SEP revalidation by experience in the 12 months before expiry", () => {
    const flights = [
      ...Array.from({ length: 11 }, (_, i) => fl(`2026-0${(i % 9) + 1}-10`, "C172")),
      fl("2026-10-01", "C172", { picMin: 0, dualMin: 60 }),
    ];
    const license = { id: "l", code: "SEP(L)", validUntil: "2026-12-31" } as never;
    const [sep, mep] = classRatingStatus(flights, types, [license], "2026-11-25");
    expect(sep!.sep).toMatchObject({ from: "2025-12-31", hours: 12, picHours: 11, takeoffs: 12, landings: 12, instructorFlight: "2026-10-01", met: true });
    expect(sep!.recency).toMatchObject({ valid: false, landings: 2 });
    expect(mep!.flights).toBe(0);
    expect(mep!.recency.valid).toBe(false);
  });
  it("counts MEP route sectors in the validity year and the check window", () => {
    const license = { id: "m", code: "MEP(L)", validUntil: "2027-03-31" } as never;
    const [, mep] = classRatingStatus([fl("2026-06-01", "DA42"), fl("2026-02-01", "DA42")], types, [license], "2026-11-25");
    expect(mep!.mep).toEqual({ checkFrom: "2026-12-31", sectors: 1 });
  });
});
