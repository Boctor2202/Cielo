import { describe, expect, it } from "vitest";
import { AIRCRAFT_TYPES } from "../../reference-data/src";
import { retypeLogbook, typeFromText } from "../src";

describe("aircraft type written as a name", () => {
  const cases: [string, string | undefined][] = [
    ["172, P172, R172, Skyhawk, Hawk XP, Cutlass (T-41, Mescalero)", "C172"],
    ["DA-42 TwinStar", "DA42"],
    ["PA-46-600TP, Piper  M600", "P46T"],
    ["PA-46-500TP Malibu Meridian", "P46T"],
    ["TBM-700N, TBM-930, TBM-910, TBM-940", "TBM9"],
    ["TBM-700N, TBM-850", "TBM8"],
    ["TBM TB-700", "TBM7"],
    ["EMB 500", "E50P"],
    ["EMB-500 Phenom 100", "E50P"],
    ["SR-22", "SR22"],
    ["DR400", "DR40"],
    ["TB20, Socata  Trinidad", "TB20"],
    ["DA-62, Diamond  DA62", "DA62"],
    ["960", "TBM9"],
    ["910", "TBM9"],
    ["M700", "P46T"],
    ["C-340A, Cessna", "C340"],
    ["737-700, BBJ, C-40", "B737"],
    ["737-800, BBJ2", "B738"],
    ["TB30, Socata  Epsilon", "TB30"],
    ["C-182 B, Cessna  Skylane", "C182"],
    ["C172", "C172"],
    ["AL250, Alsim", undefined],
    ["Cessna", undefined],
  ];
  it.each(cases)("%s", (text, icao) => expect(typeFromText(text, AIRCRAFT_TYPES)).toBe(icao));
});

describe("a logbook imported with type names", () => {
  it("gets the designators, signed flights and known types left alone", () => {
    const flights = [
      { id: "a", aircraftTypeIcao: "DA-42 TWINSTAR" },
      { id: "b", aircraftTypeIcao: "DA-42 TWINSTAR", signatureId: "s" },
      { id: "c", aircraftTypeIcao: "C172" },
      { id: "d", aircraftTypeIcao: "AL250, ALSIM" },
      { id: "e", aircraftTypeIcao: "TBM-700N, TBM-930, TBM-910, TBM-940" },
      { id: "f", aircraftTypeIcao: "900" },
    ];
    const aircraft = [{ id: "x", aircraftTypeId: "ref-TB20, SOCATA  TRINIDAD" }, { id: "y", aircraftTypeId: "ref-C172" }, { id: "z", aircraftTypeId: "custom-id" }];
    const r = retypeLogbook(flights, aircraft, AIRCRAFT_TYPES);
    expect(r.flights.map((x) => [x.id, x.icao])).toEqual([["a", "DA42"], ["e", "TBM9"], ["f", "TBM9"]]);
    expect(r.flights[0]!.model).toBe("Diamond DA42 Twin Star");
    // "900" alone fits several types: none without the pilot's other flights
    expect(typeFromText("900", AIRCRAFT_TYPES)).toBeUndefined();
    expect(r.aircraft).toEqual([{ id: "x", typeId: "ref-TB20" }]);
  });
});
