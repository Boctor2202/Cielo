import { describe, expect, it } from "vitest";
import { canonicalFlightContent, extraFieldsFor, extraFlightFields, type Flight } from "../src";

const base = { date: "2026-11-10", depIcao: "LFPB", arrIcao: "LFMN", totalMin: 90, function: "PIC" } as unknown as Flight;

describe("extra logbook entries", () => {
  it("leave the signed content of older flights unchanged", () => {
    const before = canonicalFlightContent(base);
    expect(canonicalFlightContent({ ...base, via: [], purpose: "" })).toBe(before);
    expect(canonicalFlightContent({ ...base, holdings: 2 })).not.toBe(before);
  });
  it("are cleaned from the form", () => {
    expect(extraFlightFields({ simInstrumentMin: 200, soloMin: 30, via: [" lfly ", "x"], safetyPilotName: "  J. Doe " }, 90)).toEqual({
      simInstrumentMin: 90, holdings: undefined, groundTrainingMin: undefined, soloMin: 30, safetyPilotName: "J. Doe", purpose: undefined, via: ["LFLY"],
    });
  });
  it("follow the authority", () => {
    expect(extraFieldsFor("FAA")).toContain("holdings");
    expect(extraFieldsFor("EASA", "EASA")).toEqual([]);
    expect(extraFieldsFor("CASA", "NZCAA")).toContain("purpose");
  });
});
