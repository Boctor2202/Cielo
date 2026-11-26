import { describe, expect, it } from "vitest";
import { goAround, liveMinutes, nearestAirport, nextStep, setStepClock, shiftLast, stampStep, type LiveFlight } from "../src";

const t = (s: string) => new Date(`2026-11-27T${s}:00Z`);
const start: LiveFlight = { startedAt: "2026-11-27T07:29:00.000Z" };

describe("live flight", () => {
  it("stamps the steps in order and counts the times", () => {
    let f = stampStep(start, t("07:30"));
    expect(nextStep(f)).toBe("off");
    f = stampStep(f, t("07:47"));
    f = stampStep(f, t("09:46"));
    f = stampStep(f, t("09:58"));
    expect(nextStep(f)).toBeUndefined();
    expect(liveMinutes(f.out, f.in, new Date())).toBe(148);
    expect(liveMinutes(f.off, f.on, new Date())).toBe(119);
    // nothing left to stamp
    expect(stampStep(f, t("10:30"))).toBe(f);
  });
  it("never stamps a step before the previous one", () => {
    const f = stampStep(stampStep(start, t("07:30")), t("07:10"));
    expect(f.off).toBe(f.out);
  });
  it("runs the clock until the next stamp", () => {
    const f = stampStep(stampStep(start, t("07:30")), t("07:47"));
    expect(liveMinutes(f.off, f.on, t("08:51"))).toBe(64);
    expect(liveMinutes(f.out, f.in, t("08:51"))).toBe(81);
  });
  it("moves the last stamp back a minute, never before the step before", () => {
    let f = stampStep(stampStep(start, t("07:30")), t("07:47"));
    f = shiftLast(f, -1);
    expect(f.off).toBe(t("07:46").toISOString());
    const g = stampStep(stampStep(start, t("07:30")), t("07:30"));
    expect(shiftLast(g, -1)).toBe(g);
  });
  it("sets a clock time, past midnight on the next day", () => {
    let f = stampStep(stampStep(start, t("07:30")), t("07:47"));
    f = setStepClock(f, "off", "07:52");
    expect(f.off).toBe(t("07:52").toISOString());
    const night: LiveFlight = { startedAt: "2026-11-27T23:00:00.000Z", out: "2026-11-27T23:10:00.000Z", off: "2026-11-27T23:25:00.000Z" };
    expect(setStepClock(night, "on", "01:05").on).toBe("2026-11-28T01:05:00.000Z");
    expect(setStepClock(night, "on", "25:00")).toBe(night);
  });
  it("takes a landing back for a go-around or a touch-and-go", () => {
    let f = stampStep(stampStep(stampStep(start, t("07:30")), t("07:47")), t("08:20"));
    f = goAround(f);
    expect(f.on).toBeUndefined();
    expect(f.touchAndGos).toBe(1);
    expect(nextStep(f)).toBe("on");
  });
  it("finds the airport the phone is at", () => {
    const list = [
      { icao: "LFPO", lat: 48.7233, lon: 2.3794, size: 3 },
      { icao: "LFPN", lat: 48.7519, lon: 2.1061, size: 2 },
      { icao: "FR-0001", lat: 48.724, lon: 2.38, size: 1 },
    ];
    // Orly terminal, about 2 km from the reference point
    expect(nearestAirport(list, 48.731, 2.364)?.icao).toBe("LFPO");
    // in the middle of nowhere
    expect(nearestAirport(list, 45, 5)).toBeUndefined();
  });
});
