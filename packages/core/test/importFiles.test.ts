import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyseTable, detectDelimiter, parseCsv, parseDuration, parseFlexibleDate, rowsToFlights, sheetCellText } from "../src";

/**
 * Real-world logbook files, read end to end as the apps read them: delimiter, header row, column mapping, date
 * order, then every row turned into a flight. Each file must import all its flights with the right values.
 */
const read = (name: string) => {
  const text = readFileSync(new URL(`./fixtures/import/${name}`, import.meta.url), "utf8").replace(/^﻿/, "");
  const a = analyseTable(parseCsv(text));
  const rows = rowsToFlights(a.rows, a.mapping, { dateOrder: a.dateOrder });
  return { a, rows, ok: rows.filter((r) => !r.errors.length) };
};

describe("logbook files", () => {
  it("French EASA spreadsheet with semicolons", () => {
    const { rows, ok } = read("easa-fr-semicolon.csv");
    expect(ok).toHaveLength(3);
    expect(rows[2]!.input).toMatchObject({ date: "2024-03-16", depIcao: "LFPG", arrIcao: "EGLL", out: "21:40", in: "22:55", function: "SIC", landingsNight: 1 });
    expect(rows[2]!.explicit).toMatchObject({ total: 75, night: 75, ifr: 75, copilot: 75 });
  });

  it("spreadsheet export with times in seconds and dates with a time", () => {
    const { rows, ok } = read("excel-seconds.csv");
    expect(ok).toHaveLength(2);
    expect(rows[0]!.input).toMatchObject({ date: "2024-03-15", out: "06:10", in: "07:45" });
    expect(rows[0]!.explicit.total).toBe(95);
  });

  it("US logbook: month/day/year and decimal hours", () => {
    const { a, rows, ok } = read("us-decimal.csv");
    expect(a.dateOrder).toBe("mdy");
    expect(ok).toHaveLength(3);
    expect(rows[1]!.input).toMatchObject({ date: "2024-03-16", depIcao: "KSQL", arrIcao: "KHAF", landingsNight: 1 });
    expect(rows[1]!.explicit).toMatchObject({ total: 108, night: 30, pic: 108 });
  });

  it("dates with month names", () => {
    const { rows, ok } = read("month-names.csv");
    expect(ok).toHaveLength(3);
    expect(rows.map((r) => r.input!.date)).toEqual(["2024-03-15", "2024-03-16", "2024-04-02"]);
  });

  it("IATA codes and a flight past midnight", () => {
    const { rows, ok } = read("iata-overnight.csv");
    expect(ok).toHaveLength(2);
    expect(rows[1]!.input).toMatchObject({ depIcao: "JFK", arrIcao: "CDG", out: "22:40", in: "07:10", function: "SIC", flightNumber: "AF011" });
    expect(rows[1]!.explicit.total).toBe(510);
  });

  it("title lines above the table, with any delimiter", () => {
    expect(read("title-lines.csv").ok).toHaveLength(2);
    const { rows, ok } = read("title-semicolon.csv");
    expect(ok).toHaveLength(2);
    expect(rows[0]!.input!.remarks).toBe("Vent fort, approche ILS 04");
  });

  it("two-row header as in the EASA paper logbook", () => {
    const { rows, ok } = read("two-row-header.csv");
    expect(ok).toHaveLength(2);
    expect(rows[1]!.input).toMatchObject({ depIcao: "LFOP", arrIcao: "LFPN", out: "11:00", in: "12:20", registration: "F-GSTR", aircraftTypeIcao: "DR40", landingsDay: 2 });
    expect(rows[1]!.explicit.pic).toBe(80);
  });

  it("tab-separated text, BOM and quoted cells", () => {
    expect(read("tabs.tsv").ok).toHaveLength(1);
    expect(read("bom-quoted.csv").ok).toHaveLength(1);
  });
});

describe("cell readers", () => {
  it("durations", () => {
    expect(parseDuration("1:35")).toBe(95);
    expect(parseDuration("01:35:00")).toBe(95);
    expect(parseDuration("1h35")).toBe(95);
    expect(parseDuration("1h35m")).toBe(95);
    expect(parseDuration("95 min")).toBe(95);
    expect(parseDuration("1.5")).toBe(90);
    expect(parseDuration("1,25")).toBe(75);
  });

  it("dates", () => {
    expect(parseFlexibleDate("15/03/2024 00:00")).toBe("2024-03-15");
    expect(parseFlexibleDate("2024-03-15T00:00:00Z")).toBe("2024-03-15");
    expect(parseFlexibleDate("15-Mar-2024")).toBe("2024-03-15");
    expect(parseFlexibleDate("15 mars 2024")).toBe("2024-03-15");
    expect(parseFlexibleDate("Mar 15, 2024")).toBe("2024-03-15");
    expect(parseFlexibleDate("03/15/2024", "mdy")).toBe("2024-03-15");
    expect(parseFlexibleDate("45366")).toBe("2024-03-15");
  });

  it("delimiter from the table, not from a title line", () => {
    expect(detectDelimiter("Logbook, J. Dupont\nDate;From;To\n1;2;3\n4;5;6")).toBe(";");
    expect(detectDelimiter("a\tb\tc\n1\t2\t3")).toBe("\t");
  });

  it("Excel cells", () => {
    expect(sheetCellText(new Date(Date.UTC(1899, 11, 30, 1, 35)))).toBe("01:35");
    expect(sheetCellText(new Date(Date.UTC(2024, 2, 15)))).toBe("2024-03-15");
    expect(sheetCellText(1.25)).toBe("1.25");
    expect(sheetCellText(null)).toBe("");
  });
});
