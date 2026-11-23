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

describe("times that disagree with the written total", () => {
  it("lists the row (numbered from 1 for a document) when off/on-block do not match the total kept", () => {
    const rows = [
      { rowIndex: 0, explicit: { total: 62 }, errors: [], input: { date: "2021-08-04" } },
      { rowIndex: 1, explicit: { total: 61 }, errors: [], input: { date: "2021-08-03" } },
    ] as never;
    const f = (out: string, inn: string, total: number) => ({ outUtc: `2021-08-04T${out}:00.000Z`, inUtc: `2021-08-04T${inn}:00.000Z`, totalMin: total, landingsDay: 1 }) as never;
    // flight 1: 13:02 read instead of 15:02 -> 3:02 of block for 1:02 written
    const c = checkImport(rows, [{ rowIndex: 0, flight: f("13:02", "16:04", 62) }, { rowIndex: 1, flight: f("14:29", "15:30", 61) }], [], 1);
    expect(c.timesToCheck).toEqual([1]);
  });
});

describe("simulator sessions", () => {
  it("their written total is session time: not compared with flight time, not flagged", () => {
    const rows = [row(0, { total: 60, pic: 60 }, 0), row(1, { total: 90, pic: 90 }, 1)];
    const built = [{ rowIndex: 0, flight: fl(0, { isFstd: true, fstdMin: 60, landingsDay: 0 }) }, { rowIndex: 1, flight: fl(90, { picMin: 90 }) }];
    const c = checkImport(rows, built, []);
    expect(c.lines.find((l) => l.field === "total")).toEqual({ field: "total", file: 90, geardown: 90, rows: [] });
    expect(c.lines.find((l) => l.field === "fstd")!.geardown).toBe(60);
    expect(c.flags).toEqual({});
  });
});
