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

import { ageOn, flagEmoji, pilotCredentials, suggestedCurrentTypes } from "../src";

describe("pilot details", () => {
  it("age, flag", () => {
    expect(ageOn("1990-11-20", "2026-11-19")).toBe(35);
    expect(ageOn("1990-11-19", "2026-11-19")).toBe(36);
    expect(flagEmoji("fr")).toBe("🇫🇷");
  });
  it("credentials and current types", () => {
    const docs = [
      { kind: "licence", code: "CPL(A)", validUntil: null },
      { kind: "licence", code: "ATPL(A)", validUntil: null, number: "X1" },
      { kind: "medical", code: "CLASS1", validUntil: "2026-01-01" },
      { kind: "medical", code: "CLASS1", validUntil: "2027-05-01" },
      { kind: "type_rating", code: "TR C68A", validUntil: "2027-03-01" },
      { kind: "type_rating", code: "TR A320", validUntil: "2020-03-01" },
    ];
    const c = pilotCredentials(docs, "2026-11-19");
    expect(c.licence?.code).toBe("ATPL(A)");
    expect(c.medical?.validUntil).toBe("2027-05-01");
    expect(suggestedCurrentTypes(docs, [{ date: "2026-11-15", aircraftTypeIcao: "c68a" }, { date: "2026-01-01", aircraftTypeIcao: "PC12" }], "2026-11-19")).toEqual(["C68A"]);
  });
});
