import { describe, expect, it } from "vitest";
import { airspacesCrossed, cruiseSample, inRing, nearestLevel, pressureAt, windComponents, type Airspace } from "./flightContext";
import type { TrackPoint } from "./types";

const square = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];

describe("flight context", () => {
  it("finds a point in a polygon", () => {
    expect(inRing(2.5, 48.9, square(2, 48.5, 3, 49.2))).toBe(true);
    expect(inRing(3.5, 48.9, square(2, 48.5, 3, 49.2))).toBe(false);
  });

  it("lists the airspaces crossed in order, within their vertical limits", () => {
    // a climb going east: 0 ft at lon 2.0 to 20 000 ft at lon 4.0, one point a minute
    const pts: TrackPoint[] = Array.from({ length: 41 }, (_, i) => [1000 + i * 60, 49, 2 + i * 0.05, i * 500, 300]);
    const ctr: Airspace = { id: "ctr", name: "CTR", type: "CTR", icaoClass: "D", lowerFt: 0, upperFt: 1500, rings: [square(1.9, 48.8, 2.2, 49.2)] };
    const tma: Airspace = { id: "tma", name: "TMA", type: "TMA", icaoClass: "A", lowerFt: 1500, upperFt: 19500, rings: [square(1.5, 48.5, 4.5, 49.5)] };
    const high: Airspace = { id: "r", name: "R 1", type: "R", lowerFt: 30000, upperFt: 40000, rings: [square(1.5, 48.5, 4.5, 49.5)] };
    const out = airspacesCrossed(pts, [high, tma, ctr]);
    expect(out.map((a) => a.id)).toEqual(["ctr", "tma"]);
    expect(out[0]!.from).toBe(1000);
  });

  it("samples the middle of the cruise and its track", () => {
    const pts: TrackPoint[] = [
      [0, 49, 2, 0, 0], [600, 49, 2.5, 20000, 400], [1200, 49, 3, 37000, 450], [1800, 49, 3.5, 37000, 450],
      [2400, 49, 4, 37000, 450], [3000, 49, 4.5, 20000, 400], [3600, 49, 5, 0, 0],
    ];
    const c = cruiseSample(pts)!;
    expect(c.t).toBe(1800);
    expect(c.altFt).toBe(37000);
    expect(c.trackDeg).toBeGreaterThan(85);
    expect(c.trackDeg).toBeLessThan(95);
  });

  it("converts altitude to the nearest pressure level", () => {
    expect(nearestLevel(pressureAt(37000))).toBe(200);
    expect(nearestLevel(pressureAt(10000))).toBe(700);
    expect(nearestLevel(pressureAt(0))).toBe(1000);
  });

  it("splits the wind into head and cross components", () => {
    expect(windComponents(270, 30, 270)).toEqual({ head: 30, cross: 0 });
    expect(windComponents(90, 30, 270).head).toBe(-30);
    expect(windComponents(360, 20, 270).cross).toBe(20);
  });
});
