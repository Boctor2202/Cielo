import { describe, expect, it } from "vitest";
import { pilotFirstName } from "../src/profile";

describe("pilotFirstName", () => {
  it("falls back from the names to the account, then to the e-mail", () => {
    expect(pilotFirstName({ fullName: "Camille Martin" })).toBe("Camille");
    expect(pilotFirstName({ fullName: "", email: "x@y.com" }, "Jean Dupont")).toBe("Jean");
    expect(pilotFirstName({ fullName: "", email: "cyrille.boctor@example.com" })).toBe("Cyrille");
    expect(pilotFirstName({ fullName: "", email: "ops123@example.com" })).toBeUndefined();
  });
});
