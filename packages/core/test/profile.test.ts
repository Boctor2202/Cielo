import { describe, expect, it } from "vitest";
import { pilotFirstName } from "../src/profile";

describe("pilotFirstName", () => {
  it("comes from the profile only", () => {
    expect(pilotFirstName({ fullName: "Camille Martin" })).toBe("Camille");
    expect(pilotFirstName({ displayName: "Cam", fullName: "Camille Martin" })).toBe("Cam");
    expect(pilotFirstName({ fullName: "" })).toBeUndefined();
  });
});
