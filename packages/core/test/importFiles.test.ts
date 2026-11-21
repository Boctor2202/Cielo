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

/**
 * Exports of other logbook apps, with their real column names (ForeFlight, MyFlightbook from their sources; the
 * others from public importers' samples): every flight read, simulator sessions recognised, times in the right unit.
 */
const readApp = (name: string, timezoneOf?: (c: string) => string | undefined) => {
  const text = readFileSync(new URL(`./fixtures/import/apps/${name}`, import.meta.url), "utf8").replace(/^﻿/, "");
  const a = analyseTable(parseCsv(text));
  const rows = rowsToFlights(a.rows, a.mapping, { dateOrder: a.dateOrder, timezoneOf });
  return { a, rows, ok: rows.filter((r) => !r.errors.length) };
};

describe("exports of other logbook apps", () => {
  it("ForeFlight: two sections, decimal hours, a flag column not taken for a flight number", () => {
    const { a, rows, ok } = readApp("foreflight-logbook.csv");
    expect(a.app).toBe("ForeFlight");
    expect(ok).toHaveLength(3);
    expect(rows[2]!.input).toMatchObject({ date: "2022-12-10", depIcao: "KPOU", arrIcao: "KHPN", out: "22:40", in: "00:01", registration: "N812RR", aircraftTypeIcao: "C172", landingsNight: 1 });
    expect(rows[2]!.input!.flightNumber).toBeUndefined();
    expect(rows[2]!.explicit).toMatchObject({ total: 84, night: 84, pic: 84 });
  });

  it("LogTen Pro: actual (not scheduled) times, simulator session", () => {
    const { a, rows, ok } = readApp("logten-pro-export-flights.txt");
    expect(a.app).toBe("LogTen");
    expect(ok).toHaveLength(3);
    expect(rows[0]!.input).toMatchObject({ out: "10:00", off: "10:12", on: "11:02", in: "11:10", flightNumber: "KL1023", registration: "PH-ABC" });
    expect(rows[1]!.input!.function).toBe("SIC");
    expect(rows[2]!.input).toMatchObject({ isFstd: true, fstdMin: 240 });
  });

  it("mccPILOTLOG: simulator flagged 'sim' with its total as session time", () => {
    const { ok, rows } = readApp("mccpilotlog-export.csv");
    expect(ok).toHaveLength(3);
    expect(rows[1]!.input).toMatchObject({ function: "SIC", registration: "PH-ABC" });
    expect(rows[2]!.input).toMatchObject({ isFstd: true, fstdMin: 180 });
  });

  it("CrewLounge: durations in minutes, registration without hyphen, previous experience left out", () => {
    const { a, rows, ok } = readApp("crewlounge-pilotlog-export.csv");
    expect(a.app).toBe("CrewLounge");
    expect(ok).toHaveLength(2);
    expect(rows[0]!.explicit.total).toBe(80);
    expect(rows[1]!.explicit).toMatchObject({ total: 86, night: 86, copilot: 86 });
    expect(rows[0]!.input).toMatchObject({ registration: "PHXYZ", isFstd: false });
  });

  it("MyFlightbook: decimal hours, IMC as IFR, route split into airports", () => {
    const { rows, ok } = readApp("myflightbook-export.csv");
    expect(ok).toHaveLength(3);
    expect(rows[2]!.input).toMatchObject({ depIcao: "KPAE", arrIcao: "KPDX", registration: "N4321K", aircraftTypeIcao: "P28A" });
    expect(rows[2]!.explicit.total).toBe(141);
    expect(rows[0]!.explicit.ifr).toBe(24);
    expect(rows[1]!.input!.function).toBe("DUAL");
  });

  it("Safelog: split function columns added up, local times converted to UTC", () => {
    const { a, rows, ok } = readApp("safelog-export.csv", (c) => (c.startsWith("EH") ? "Europe/Amsterdam" : undefined));
    expect(a.app).toBe("Safelog");
    expect(ok).toHaveLength(3);
    expect(rows[0]!.input).toMatchObject({ out: "08:00", in: "08:50", function: "PIC" });
    expect(rows[0]!.explicit.pic).toBe(50);
    // 09:00 LOCAL in Amsterdam in January = 08:00 UTC
    expect(rows[1]!.input).toMatchObject({ out: "08:00", in: "08:45", function: "DUAL" });
    expect(rows[1]!.explicit.dual).toBe(45);
    expect(rows[2]!.input).toMatchObject({ isFstd: true, fstdType: "FNPT2", fstdMin: 75 });
  });

  it("Flylog: not mistaken for LogTen, every column found", () => {
    const { a, rows, ok } = readApp("flylog-export.csv");
    expect(a.app).toBe("Flylog");
    expect(ok).toHaveLength(2);
    expect(rows[1]!.input).toMatchObject({ flightNumber: "FL101", registration: "PHFAKE", off: "16:20", on: "17:12" });
    expect(rows[1]!.explicit).toMatchObject({ total: 75, night: 40, copilot: 75 });
  });
});
