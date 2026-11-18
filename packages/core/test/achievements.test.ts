import { describe, expect, it } from "vitest";
import { hourLevel, loggingStreak, type Flight } from "../src";

const f = (date: string, createdAt: string, extra: Partial<Flight> = {}) =>
  ({ id: date + createdAt, date, inUtc: `${date}T18:00:00.000Z`, createdAt, updatedAt: createdAt, totalMin: 120, isFstd: false, source: "manual", ...extra }) as Flight;

describe("hourLevel", () => {
  it("places the pilot between two milestones", () => {
    const l = hourLevel([f("2026-01-01", "2026-01-01T19:00:00Z", { totalMin: 747 * 60 })]);
    expect(l.current?.hours).toBe(500);
    expect(l.next?.hours).toBe(1000);
    expect(l.ratio).toBeCloseTo(0.494, 2);
  });
});

describe("loggingStreak", () => {
  it("counts weeks logged within 48 h, a late week resets it, empty weeks do not", () => {
    const s = loggingStreak(
      [
        f("2026-10-05", "2026-10-05T20:00:00Z"),
        f("2026-10-12", "2026-10-20T08:00:00Z"), // late
        f("2026-10-19", "2026-10-20T08:00:00Z"),
        f("2026-11-02", "2026-11-03T08:00:00Z"),
        f("2026-11-16", "2026-11-16T19:00:00Z"),
        f("2025-01-01", "2026-11-01T00:00:00Z", { source: "import" }),
      ],
      "2026-11-18T12:00:00Z",
    );
    expect(s.current).toBe(3);
    expect(s.best).toBe(3);
    expect(s.weeks[11]!.state).toBe("onTime");
    expect(s.onTimeRate).toBeCloseTo(0.8);
  });
});
