import { describe, expect, it } from "vitest";
import { AC_61_65K, blanksLeft, canonicalEndorsement, deviceRow, endorsementSignatureLine, endorsementTemplate, endorsementValidUntil, fillEndorsement, hours8710, report8710, type AircraftType, type Flight } from "../src";

describe("AC 61-65K templates", () => {
  it("has the 96 sample endorsements, each with its regulation and text", () => {
    expect(AC_61_65K).toHaveLength(96);
    expect(AC_61_65K.map((t) => t.id)).toEqual(Array.from({ length: 96 }, (_, i) => `A.${i + 1}`));
    for (const t of AC_61_65K) {
      expect(t.text.length).toBeGreaterThan(40);
      expect(t.ref).toMatch(/CFR|SFAR|FAA-S/);
      expect(t.text).not.toMatch(/AC 61-65K|Appendix A|11\/14\/25/);
    }
    expect(endorsementTemplate("A.6")!.title).toBe("Solo flight (first 90-calendar-day period)");
    expect(endorsementTemplate("A.73")!.ref).toBe("14 CFR § 61.31(f)");
  });
  it("fills the pilot and the aircraft, and lists the blanks left", () => {
    const t = fillEndorsement(endorsementTemplate("A.6")!.text, { studentName: "Thomas Mercier", aircraft: "Cessna 172S" });
    expect(t).toContain("I certify that Thomas Mercier has received");
    expect(t).toContain("solo flights in Cessna 172S.");
    expect(blanksLeft(t)).toEqual([]);
    expect(blanksLeft(fillEndorsement(endorsementTemplate("A.73")!.text, { studentName: "T. Mercier" }))).toEqual(["[grade of pilot certificate]", "[certificate number]", "[M/M]"]);
  });
  it("knows how long solo endorsements and the flight review last", () => {
    expect(endorsementValidUntil("A.6", "2026-09-06")).toBe("2026-12-05");
    expect(endorsementValidUntil("A.69", "2026-11-03")).toBe("2028-11-30");
    expect(endorsementValidUntil("A.73", "2026-11-03")).toBeNull();
  });
  it("writes the signature line of the AC", () => {
    expect(endorsementSignatureLine({ issuedOn: "2026-11-27", instructorName: "J. J. Jones", instructorCertificate: "987654321CFI", instructorCertKind: "RE", instructorCertDate: "2026-12-31" })).toBe("/s/ 11-27-2026 J. J. Jones 987654321CFI RE 12-31-2026");
    expect(endorsementSignatureLine({ issuedOn: "2026-11-27", instructorName: "J. J. Jones", instructorCertificate: "987654321", instructorCertKind: null, instructorCertDate: null })).toBe("/s/ 11-27-2026 J. J. Jones 987654321");
  });
  it("seals what was signed", () => {
    const e = { templateId: "A.6", text: "x", studentName: "A", issuedOn: "2026-01-01", instructorName: "B", instructorCertificate: "1CFI", instructorCertKind: "RE" as const, instructorCertDate: "2026-12-31" };
    expect(canonicalEndorsement(e)).not.toBe(canonicalEndorsement({ ...e, text: "y" }));
  });
});

const T = (p: Partial<AircraftType>) => ({ id: p.icao, icao: "C172", category: "airplane", engineType: "piston", engineCount: 1, ...p }) as AircraftType;
const F = (p: Partial<Flight>): Flight =>
  ({ id: Math.random().toString(), date: "2026-01-01", totalMin: 0, picMin: 0, picusMin: 0, copilotMin: 0, dualMin: 0, nightMin: 0, actualImcMin: 0, xcMin: 0, takeoffsNight: 0, landingsNight: 0, isFstd: false, fstdMin: 0, ...p }) as Flight;

describe("FAA Form 8710-1 record of pilot time", () => {
  const types = [T({ icao: "C172" }), T({ icao: "A320", engineCount: 2, engineType: "jet" }), T({ icao: "R44", category: "helicopter" })];
  const r = report8710(
    [
      // a dual cross-country at night
      F({ aircraftTypeIcao: "C172", totalMin: 90, dualMin: 90, xcMin: 60, nightMin: 30, landingsNight: 1, takeoffsNight: 1 }),
      // a solo cross-country
      F({ aircraftTypeIcao: "C172", totalMin: 120, picMin: 120, soloMin: 120, xcMin: 120 }),
      // an airline sector as SIC, with simulated and actual instrument time
      F({ aircraftTypeIcao: "A320", totalMin: 150, copilotMin: 150, xcMin: 150, nightMin: 60, actualImcMin: 20, simInstrumentMin: 0, landingsNight: 1 }),
      F({ aircraftTypeIcao: "R44", totalMin: 60, picMin: 60 }),
      F({ isFstd: true, fstdType: "FFS Level D", fstdMin: 240, dualMin: 240, simInstrumentMin: 60 }),
      F({ aircraftTypeIcao: "ZZZZ", totalMin: 45 }),
    ],
    types,
  );
  it("fills the airplane row by function", () => {
    const a = r.rows.airplanes;
    expect(a.total).toBe(360);
    expect(a.instructionReceived).toBe(90);
    expect(a.solo).toBe(120);
    expect(a.pic).toBe(120);
    expect(a.sic).toBe(150);
    expect([a.xcInstruction, a.xcSolo, a.xcPic, a.xcSic]).toEqual([60, 120, 120, 150]);
    expect(a.instrument).toBe(20);
    expect([a.nightInstruction, a.nightToLdg, a.nightPic, a.nightSic, a.nightToLdgPic, a.nightToLdgSic]).toEqual([30, 2, 0, 60, 0, 1]);
    expect(a.flights).toBe(3);
  });
  it("splits the airplane classes and the other rows", () => {
    expect(r.classes).toEqual([{ cls: "SEL", total: 210, pic: 120, sic: 0 }, { cls: "MEL", total: 150, pic: 0, sic: 150 }]);
    expect(r.rows.rotorcraft.total).toBe(60);
    expect(r.rows.ffs).toMatchObject({ total: 240, instructionReceived: 240, instrument: 60, flights: 1 });
    expect(r.unknown).toBe(1);
  });
  it("tells simulator devices apart and writes decimal hours", () => {
    expect(deviceRow("FTD level 6")).toBe("ftd");
    expect(deviceRow("FNPT II")).toBe("atd");
    expect(hours8710(99)).toBe("1.7");
    expect(hours8710(0)).toBe("");
  });
});
