import { describe, expect, it } from "vitest";
import { autoSignDue, signedLabel, type Flight } from "../src";

const f = (id: string, date: string, extra: Partial<Flight> = {}) => ({ id, date, ...extra }) as Flight;

describe("signing", () => {
  it("labels a signature, or says the flight changed", () => {
    const s = { signerName: "Julie Martin", signerRole: "captain" as const, signedAt: "2026-11-18T10:00:00.000Z", imageDataUrl: "", valid: true };
    expect(signedLabel(s)).toBe("Signed Julie Martin (CPT) 18/11/26");
    expect(signedLabel({ ...s, valid: false })).toContain("invalid");
  });
  it("signs own flights from the chosen day, the day after, once", () => {
    const flights = [f("a", "2026-11-01"), f("b", "2026-11-10"), f("c", "2026-11-21"), f("d", "2026-11-12", { signatureId: "s" }), f("e", "2026-11-13", { deletedAt: "x" })];
    const pilot = { autoSignFrom: "2026-11-05", signatureDataUrl: "data:image/png;base64,x" };
    expect(autoSignDue(flights, pilot, "2026-11-21").map((x) => x.id)).toEqual(["b"]);
    expect(autoSignDue(flights, { ...pilot, autoSignFrom: null }, "2026-11-21")).toEqual([]);
    expect(autoSignDue(flights, { ...pilot, signatureDataUrl: undefined }, "2026-11-21")).toEqual([]);
  });
});
