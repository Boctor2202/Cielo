import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { legsToRows, parseLogTenEasa } from "../src";

// the text of a LogTen "EASA-FCL Compliant" export (A4, 16 lines), names and registrations replaced
const pages = JSON.parse(readFileSync(new URL("./fixtures-logten-easa.json", import.meta.url), "utf8"));

describe("LogTen EASA-FCL PDF", () => {
  const r = parseLogTenEasa(pages)!;
  it("reads every flight of the two facing pages, checked against the page totals", () => {
    expect(r.legs).toHaveLength(14);
    expect(r.checked).toEqual({ pages: 2, mismatches: 0 });
    const sum = (k: "totalMin" | "nightMin" | "ifrMin" | "picMin" | "multiPilotMin") => r.legs.reduce((s, l) => s + (l[k] ?? 0), 0);
    expect([sum("totalMin"), sum("nightMin"), sum("ifrMin"), sum("picMin"), sum("multiPilotMin")]).toEqual([19 * 60 + 30, 4 * 60 + 5, 18 * 60 + 48, 13 * 60 + 33, 17 * 60 + 5]);
  });
  it("reads a line in full: times, takeoffs and landings by day and night, remarks", () => {
    expect(r.legs[0]).toMatchObject({ date: "2026-10-09", dep: "LFPB", arr: "LFLS", out: "05:00", in: "06:20", totalMin: 80, nightMin: 26, takeoffsNight: 1, landingsDay: 1, registration: "F-HGDN", aircraftType: "C510", function: "PIC" });
    expect(r.legs[13]).toMatchObject({ date: "2026-10-29", ifrMin: 30, picMin: 72, instructorMin: 72, function: "FI", remarks: "TRI Base training" });
    expect(r.legs[8]!.remarks).toBe("SPO");
  });
  it("gives the totals carried from the previous pages", () => {
    expect(r.previous).toEqual({ totalMin: 2950 * 60 + 28, landingsDay: 3559, landingsNight: 192 });
  });
  it("makes import rows with the document's takeoffs and times", () => {
    const [row] = legsToRows(r.legs, (c) => c, { function: "SIC", pilotFlying: false });
    expect(row!.errors).toEqual([]);
    expect(row!.input).toMatchObject({ takeoffsNight: 1, takeoffsDay: 0, landingsDay: 1, function: "PIC" });
    expect(row!.explicit).toMatchObject({ total: 80, night: 26, pic: 80, multiPilot: 80 });
  });
});
