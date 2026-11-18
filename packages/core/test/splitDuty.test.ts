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
