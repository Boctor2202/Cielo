import { describe, expect, it } from "vitest";
import { pilotFirstName } from "../src/profile";

describe("pilotFirstName", () => {
  it("comes from the profile only", () => {
    expect(pilotFirstName({ fullName: "Camille Martin" })).toBe("Camille");
    expect(pilotFirstName({ displayName: "Cam", fullName: "Camille Martin" })).toBe("Cam");
    expect(pilotFirstName({ fullName: "" })).toBeUndefined();
  });
});

import { dayPart } from "../src/profile";
describe("dayPart", () => {
  it("follows the local hour", () => {
    expect(dayPart(new Date(2026, 10, 18, 7, 0))).toBe("morning");
    expect(dayPart(new Date(2026, 10, 18, 14, 0))).toBe("afternoon");
    expect(dayPart(new Date(2026, 10, 18, 20, 0))).toBe("evening");
    expect(dayPart(new Date(2026, 10, 18, 2, 0))).toBe("evening");
  });
});

import { rankStripes } from "../src/profile";
describe("rankStripes", () => {
  it("reads the rank", () => {
    expect(rankStripes("Captain")).toBe(4);
    expect(rankStripes("Commandant de bord")).toBe(4);
    expect(rankStripes("First Officer")).toBe(3);
    expect(rankStripes("Senior First Officer")).toBe(3);
    expect(rankStripes("Officier pilote de ligne")).toBe(3);
    expect(rankStripes("Student Pilot")).toBe(2);
    expect(rankStripes("Élève pilote")).toBe(2);
    expect(rankStripes("Private Pilot")).toBeUndefined();
  });
});
