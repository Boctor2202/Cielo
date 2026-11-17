import { describe, expect, it } from "vitest";
import { layoverStays, nightsByCountry, type Flight } from "../src";

const leg = (dep: string, arr: string, out: string, inn: string) => ({ id: out, date: out.slice(0, 10), depIcao: dep, arrIcao: arr, outUtc: out, inUtc: inn, isFstd: false }) as unknown as Flight;
const country = (i: string) => ({ LFPB: "FR", LFBZ: "FR", LEVT: "ES", LEMD: "ES", EGLF: "GB", KTEB: "US" })[i];

describe("layover nights", () => {
  const flights = [
    leg("LFPB", "LFBZ", "2026-11-13T16:41:00Z", "2026-11-13T18:04:00Z"),
    leg("LFBZ", "LFPB", "2026-11-15T14:07:00Z", "2026-11-15T15:37:00Z"), // 2 nights in Biarritz (France, away from base)
    leg("LFPB", "LEVT", "2026-11-15T19:42:00Z", "2026-11-15T23:27:00Z"),
    leg("LEVT", "LEMD", "2026-11-18T19:30:00Z", "2026-11-18T20:30:00Z"), // 3 nights in Vitoria
    leg("LEMD", "LFPB", "2026-11-18T21:32:00Z", "2026-11-18T23:30:00Z"), // same day: no night
    leg("LFPB", "EGLF", "2026-12-31T10:00:00Z", "2026-12-31T11:00:00Z"),
    leg("EGLF", "LFPB", "2027-01-02T10:00:00Z", "2027-01-02T11:00:00Z"), // 1 night in 2026, 1 in 2027
    leg("LFPB", "KTEB", "2026-06-01T10:00:00Z", "2026-06-01T18:00:00Z"),
    leg("LFBZ", "LFPB", "2026-06-03T10:00:00Z", "2026-06-03T11:00:00Z"), // next leg from elsewhere: not a layover
  ];
  it("counts nights per country, base excluded, split by year", () => {
    const r = nightsByCountry(layoverStays(flights, "LFPB", country), 2026);
    expect(r.countries).toEqual([
      { country: "ES", nights: 3, stays: 1, airports: ["LEVT"] },
      { country: "FR", nights: 2, stays: 1, airports: ["LFBZ"] },
      { country: "GB", nights: 1, stays: 1, airports: ["EGLF"] },
    ]);
    expect(r.total).toBe(6);
    expect(nightsByCountry(layoverStays(flights, "LFPB", country), 2027).total).toBe(1);
  });
});
