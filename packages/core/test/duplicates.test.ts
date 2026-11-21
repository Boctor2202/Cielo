import { describe, expect, it } from "vitest";
import { findDuplicate } from "../src";

const f = (id: string, date: string, dep: string, arr: string, out: string | null, total: number, isFstd = false) =>
  ({ id, date, depIcao: dep, arrIcao: arr, outUtc: out ? `${date}T${out}:00.000Z` : null, offUtc: null, totalMin: total, isFstd, fstdMin: isFstd ? total : 0, deletedAt: null }) as never;

describe("flights already in the logbook", () => {
  const logbook = [f("a", "2021-08-03", "LFPN", "LFOX", "14:30", 61), f("b", "2021-08-04", "LFPN", "LFPN", null, 62), f("s", "2021-08-18", "FSTD", "FSTD", null, 75, true)];
  it("the same flight to the minute", () => {
    expect(findDuplicate(f("n", "2021-08-03", "LFPN", "LFOX", "14:30", 61), logbook)).toMatchObject({ kind: "exact" });
  });
  it("a time read a few minutes off is a probable duplicate; half an hour later is another flight", () => {
    expect(findDuplicate(f("n", "2021-08-03", "LFPN", "LFOX", "14:29", 58), logbook)).toMatchObject({ kind: "probable", flight: { id: "a" } });
    expect(findDuplicate(f("n", "2021-08-03", "LFPN", "LFOX", "15:00", 61), logbook)).toBeNull();
  });
  it("one of the two without times: same day, airports and total within 5 minutes", () => {
    expect(findDuplicate(f("n", "2021-08-04", "LFPN", "LFPN", "15:02", 64), logbook)).toMatchObject({ kind: "probable", flight: { id: "b" } });
    expect(findDuplicate(f("n", "2021-08-04", "LFPN", "LFPN", null, 62), logbook)).toMatchObject({ kind: "exact" });
    expect(findDuplicate(f("n", "2021-08-04", "LFPN", "LFOX", null, 62), logbook)).toBeNull();
  });
  it("simulator sessions on the same day with the same time", () => {
    expect(findDuplicate(f("n", "2021-08-18", "FSTD", "FSTD", null, 75, true), logbook)).toMatchObject({ kind: "exact" });
  });
});
