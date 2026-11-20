import { describe, expect, it } from "vitest";
import { checkImport, type Flight, type ImportedRow } from "../src";

const row = (i: number, explicit: ImportedRow["explicit"], ldg?: number, errors: string[] = []): ImportedRow =>
  ({ rowIndex: i, explicit, errors, input: errors.length ? undefined : ({ date: "2026-01-01", landingsDay: ldg } as never) }) as ImportedRow;
const fl = (totalMin: number, x: Partial<Flight> = {}) => ({ totalMin, nightMin: 0, ifrMin: 0, picMin: 0, picusMin: 0, copilotMin: 0, dualMin: 0, instructorMin: 0, multiPilotMin: 0, landingsDay: 1, landingsNight: 0, ...x }) as Flight;

describe("check your totals", () => {
  const rows = [row(0, { total: 90, pic: 90 }, 1), row(1, { total: 60, pic: 60 }, 1), row(2, {}, undefined, ["route"]), row(3, { total: 45 }, 1)];
  // row 1: the clock times give 55 min, not the file's 60; row 3 is already in the logbook
  const built = [{ rowIndex: 0, flight: fl(90, { picMin: 90 }) }, { rowIndex: 1, flight: fl(55, { picMin: 55 }) }];
  const c = checkImport(rows, built, [3]);
  it("sums the file's columns and Geardown's values over the kept rows, with the rows that differ", () => {
    const total = c.lines.find((l) => l.field === "total")!;
    expect(total).toEqual({ field: "total", file: 150, geardown: 145, rows: [3] });
    expect(c.lines.find((l) => l.field === "pic")!.rows).toEqual([3]);
    expect(c.lines.find((l) => l.field === "landings")).toMatchObject({ file: 2, geardown: 2, rows: [] });
  });
  it("a column the file does not have has no file total", () => {
    expect(c.lines.find((l) => l.field === "night")!.file).toBeUndefined();
  });
  it("lists the rows left out with their reason", () => {
    expect(c.rejected).toEqual([{ row: 4, reasons: ["route"] }, { row: 5, reasons: ["duplicate"] }]);
    expect(c.kept).toBe(2);
  });
});
