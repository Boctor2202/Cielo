import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseLeonRoster, type PdfTextItem } from "../src";

const pages = JSON.parse(readFileSync(new URL("./fixtures/leon-items.json", import.meta.url), "utf8")) as PdfTextItem[][];

describe("parseLeonRoster", () => {
  const r = parseLeonRoster(pages)!;
  const legs = r.events.filter((e) => e.kind === "FLIGHT");

  it("reads the header", () => {
    expect(r.timeBasis).toBe("UTC");
    expect(r.pilotName).toBe("Test Pilot");
  });

  it("puts every leg on the day of its block, with times, airports and aircraft", () => {
    expect(legs.map((l) => `${l.date} ${l.start} ${l.dep}-${l.arr} ${l.end}`)).toEqual([
      "2026-11-15 14:07 LFBZ-LFPB 15:37",
      "2026-11-15 19:42 LFPB-LFBD 20:54",
      "2026-11-15 22:37 LFBD-LEVT 23:27",
      "2026-11-18 19:30 LEVT-LEMD 20:30",
      "2026-11-18 21:32 LEMD-LFPB 23:30",
      "2026-11-24 06:00 LFPB-EHLE 07:13",
      "2026-11-24 08:00 EHLE-EDLV 08:40",
      "2026-11-24 17:45 EDLV-LFPB 18:48",
      "2026-11-26 16:30 LFPB-LIML 17:56",
      "2026-11-28 10:00 LIML-LFPB 11:27",
    ]);
    expect(legs.every((l) => l.aircraftType === "C68A" && l.aircraftReg === "9H-J4K")).toBe(true);
    expect(legs.map((l) => l.report)).toEqual(["13:30", null, null, "18:30", null, "05:00", null, null, "15:30", "09:00"]);
  });

  it("joins the two-line ON days into one stand-by each", () => {
    const on = r.events.filter((e) => e.kind === "STANDBY");
    expect(on[0]).toMatchObject({ date: "2026-11-14", start: "23:00", end: "22:59", endDayOffset: 1 });
    expect(on.every((e) => e.endDayOffset === 1)).toBe(true);
    // one stand-by per local day from 15 to 30 November, plus the one starting on the 30th
    expect(on.length).toBe(17);
  });
});
