import { describe, expect, it } from "vitest";
import { analyseFtl, dutyPeriodsFromRoster, splitBreak, DEFAULT_FTL_SETTINGS, type RosterEvent } from "../src";

const ev = (id: string, dep: string, arr: string, start: string, end: string) =>
  ({ id, pilotId: "p", kind: "FLIGHT", depIcao: dep, arrIcao: arr, startUtc: start, endUtc: end, createdAt: start, updatedAt: start }) as RosterEvent;

describe("split duty (CS FTL.1.220)", () => {
  it("needs a 3 h break once the 30 min of post/pre-flight duties are taken off", () => {
    expect(splitBreak("2026-11-24T08:00:00Z", "2026-11-24T11:20:00Z", "Europe/Paris")).toBeUndefined();
    const b = splitBreak("2026-11-24T08:00:00Z", "2026-11-24T12:00:00Z", "Europe/Paris")!;
    expect(b.breakMin).toBe(210);
    expect(b.extensionMin).toBe(105);
    expect(b.accommodationRequired).toBe(false);
  });
  it("asks for accommodation from 6 h or in the WOCL, and counts less without it", () => {
    const day = splitBreak("2026-11-24T07:00:00Z", "2026-11-24T18:00:00Z", "Europe/Paris")!;
    expect(day.accommodationRequired).toBe(true);
    expect(day.extensionWithoutAccommodationMin).toBe(180);
    const night = splitBreak("2026-11-24T23:30:00Z", "2026-11-25T04:00:00Z", "Europe/Paris")!;
    expect(night.woclMin).toBe(165);
    expect(night.accommodationRequired).toBe(true);
    expect(night.extensionWithoutAccommodationMin).toBe(0);
  });
  it("keeps a roster day with a long wait as one duty, with the extension", () => {
    const roster = [
      ev("1", "LFPB", "EDLV", "2026-11-24T06:00:00Z", "2026-11-24T07:15:00Z"),
      ev("2", "EDLV", "LFPB", "2026-11-24T18:00:00Z", "2026-11-24T19:15:00Z"),
    ];
    const duties = dutyPeriodsFromRoster(roster, DEFAULT_FTL_SETTINGS);
    expect(duties).toHaveLength(1);
    const a = analyseFtl(duties, "2026-11-20T00:00:00Z").duties[0]!;
    expect(a.split?.breakMin).toBe(615);
    expect(a.splitExtensionMin).toBe(308);
    expect(a.split?.accommodationRequired).toBe(true);
  });
});

describe("roster whole-day markers", () => {
  it("does not chain flights through all-day ON standby days", () => {
    const on = (id: string, day: string, next: string) => ({ id, pilotId: "p", kind: "STANDBY", title: "ON", startUtc: `${day}T23:00:00Z`, endUtc: `${next}T22:59:00Z`, createdAt: day, updatedAt: day }) as RosterEvent;
    const roster = [
      on("a", "2026-11-23", "2026-11-24"),
      ev("1", "LFPB", "EHLE", "2026-11-24T06:00:00Z", "2026-11-24T07:13:00Z"),
      ev("2", "EHLE", "EDLV", "2026-11-24T08:00:00Z", "2026-11-24T08:40:00Z"),
      ev("3", "EDLV", "LFPB", "2026-11-24T17:45:00Z", "2026-11-24T18:48:00Z"),
      on("b", "2026-11-24", "2026-11-25"),
      on("c", "2026-11-25", "2026-11-26"),
      ev("4", "LFPB", "LIML", "2026-11-26T16:30:00Z", "2026-11-26T17:56:00Z"),
    ];
    const d = dutyPeriodsFromRoster(roster, DEFAULT_FTL_SETTINGS);
    expect(d.map((x) => x.sectors)).toEqual([3, 1]);
    const a = analyseFtl(d, "2026-11-20T00:00:00Z").duties[0]!;
    expect(a.fdpMin).toBe(13 * 60 + 48);
    expect(a.split?.breakMin).toBe(9 * 60 + 5 - 30);
  });
});
