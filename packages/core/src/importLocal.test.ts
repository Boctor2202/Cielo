import { describe, expect, it } from "vitest";
import type { LogbookLeg } from "./airFranceEp5";
import type { ImportedRow } from "./import";
import { checkPageTotals, localAirportSuggestion, missingAirport, sameAircraftMissing } from "./importLocal";

const leg = (date: string, totalMin: number, extra: Partial<LogbookLeg> = {}): LogbookLeg => ({ date, dep: "", arr: "", totalMin, ...extra });

describe("checkPageTotals", () => {
  it("checks each page against the totals at its foot", () => {
    const legs = [leg("2006-01-14", 30), leg("2006-01-21", 42), leg("2006-11-22", 54), leg("2006-11-29", 60)];
    const r = checkPageTotals(legs, [
      { flights: 2, broughtForwardMin: 0, carriedForwardMin: 72 },
      { flights: 2, broughtForwardMin: 72, carriedForwardMin: 72 + 114 },
    ]);
    expect(r).toEqual({ expectedMin: 186, readMin: 186, off: [] });
  });

  it("names the page that does not add up", () => {
    const legs = [leg("2018-01-26", 36), leg("2018-01-29", 28), leg("2018-02-22", 48)];
    const r = checkPageTotals(legs, [
      { flights: 2, broughtForwardMin: 0, carriedForwardMin: 64 },
      // a row missed on this page: 48 read, 63 printed
      { flights: 1, broughtForwardMin: -1, carriedForwardMin: 127 },
    ]);
    expect(r?.off).toEqual([{ from: "2018-02-22", to: "2018-02-22", expectedMin: 63, readMin: 48 }]);
  });

  it("falls back on the whole document when the legs cannot be put back on their pages", () => {
    const legs = [leg("2019-01-01", 30), leg("2019-01-02", 30)];
    const r = checkPageTotals(legs, [
      { flights: 5, broughtForwardMin: 100, carriedForwardMin: 130 },
      { flights: 4, broughtForwardMin: 130, carriedForwardMin: 160 },
    ]);
    expect(r).toEqual({ expectedMin: 60, readMin: 60, off: [] });
  });

  it("leaves simulator sessions out and counts function time when no total is written", () => {
    const legs = [leg("2020-01-01", 0, { totalMin: undefined, dualMin: 30, picMin: 15 }), leg("2020-01-02", 0, { totalMin: undefined, fstdMin: 60 })];
    expect(checkPageTotals(legs, [{ flights: 2, broughtForwardMin: 0, carriedForwardMin: 45 }])).toEqual({ expectedMin: 45, readMin: 45, off: [] });
  });

  it("is null without totals", () => {
    expect(checkPageTotals([leg("2020-01-01", 30)], [])).toBeNull();
    expect(checkPageTotals([leg("2020-01-01", 30)], [{ flights: 1, broughtForwardMin: -1, carriedForwardMin: -1 }])).toBeNull();
  });
});

const row = (rowIndex: number, date: string, registration: string, dep = "", arr = ""): ImportedRow => ({
  rowIndex,
  input: { date, depIcao: dep, arrIcao: arr, registration, function: "PIC" } as ImportedRow["input"],
  explicit: { total: 30 },
  errors: dep && arr ? [] : ["route"],
});

describe("airfields of local flights", () => {
  const rows = [
    row(0, "2019-07-28", "F-GDDQ", "LFXA", "LFXA"),
    row(1, "2019-07-28", "F-GDDQ"),
    row(2, "2019-07-28", "F-GDDQ", "LFXA", "LFLY"),
    row(3, "2006-01-14", "F-GDOF"),
    row(4, "2006-01-21", "F-GDOF"),
    row(5, "2019-07-13", "F-GDOA", "LFMH"),
  ];

  it("knows a flight without an airport", () => {
    expect(rows.filter(missingAirport).map((r) => r.rowIndex)).toEqual([1, 3, 4, 5]);
  });

  it("proposes the airport the aircraft was at that day", () => {
    expect(localAirportSuggestion(rows, 1)).toBe("LFXA");
  });

  it("proposes the one airport written on the row", () => {
    expect(localAirportSuggestion(rows, 5)).toBe("LFMH");
  });

  it("proposes nothing when nothing is known", () => {
    expect(localAirportSuggestion(rows, 3)).toBeUndefined();
  });

  it("proposes nothing when the flights around disagree", () => {
    const r = [row(0, "2019-08-01", "F-GASX", "LFMA", "LFTF"), row(1, "2019-08-01", "F-GASX"), row(2, "2019-08-01", "F-GASX", "LFMA", "LFXA")];
    expect(localAirportSuggestion(r, 1)).toBeUndefined();
  });

  it("finds the other flights without an airport on the same aircraft", () => {
    expect(sameAircraftMissing(rows, 3).map((r) => r.rowIndex)).toEqual([4]);
    expect(sameAircraftMissing(rows, 1)).toEqual([]);
  });
});
