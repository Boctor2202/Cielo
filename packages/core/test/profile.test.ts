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
