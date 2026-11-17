import { describe, expect, it } from "vitest";
import { computeCurrency, currencyAlerts, type Flight } from "../src";

let n = 0;
const fl = (date: string, type: string, tod = 1, ldd = 1, ton = 0, ldn = 0, appr = 0): Flight =>
  ({
    id: `f${n++}`, pilotId: "p", date, depIcao: "LFPB", arrIcao: "LFMN", aircraftTypeIcao: type, isFstd: false,
    takeoffsDay: tod, landingsDay: ldd, takeoffsNight: ton, landingsNight: ldn, totalMin: 60,
    approaches: appr ? [{ type: "ILS CAT I", count: appr }] : [],
    createdAt: "", updatedAt: "",
  }) as unknown as Flight;

const types = [
  { id: "1", icao: "C172", classOrTypeRating: "SEP(L)" },
  { id: "2", icao: "PA28", classOrTypeRating: "SEP(L)" },
  { id: "3", icao: "C68A", classOrTypeRating: "C680A" },
] as never;

describe("computeCurrency", () => {
  it("groups types by class rating and finds the lapse date from the 3rd most recent landing", () => {
    const items = computeCurrency([fl("2026-10-01", "C172"), fl("2026-10-10", "PA28"), fl("2026-11-01", "C172")], "2026-11-17", { framework: "EASA", types });
    const pax = items.find((i) => i.key === "passengers:SEP(L)")!;
    expect(pax.valid).toBe(true);
    expect(pax.types).toEqual(["C172", "PA28"]);
    expect(pax.validUntil).toBe("2026-12-29"); // 2026-10-01 + 89 days
    expect(pax.daysLeft).toBe(42);
  });

  it("says what is missing and raises an alert for a type still flown", () => {
    const items = computeCurrency([fl("2026-11-01", "C68A", 1, 1, 0, 0)], "2026-11-17", { framework: "EASA", types });
    const pax = items.find((i) => i.key === "passengers:C680A")!;
    expect(pax.valid).toBe(false);
    expect(pax.missingLandings).toBe(2);
    const night = items.find((i) => i.key === "night:C680A")!;
    expect(night.missingLandings).toBe(1);
    expect(currencyAlerts(items, "2026-11-17").map((i) => i.key)).toContain("passengers:C680A");
  });

  it("skips the EASA night check with an IR, and checks FAA IFR approaches over 6 calendar months", () => {
    const flights = [fl("2026-06-03", "C68A", 1, 1, 0, 0, 2), fl("2026-09-10", "C68A", 1, 1, 0, 0, 4), fl("2026-11-02", "C68A", 1, 1, 1, 1)];
    expect(computeCurrency(flights, "2026-11-17", { framework: "EASA", types, holdsIr: true }).some((i) => i.kind === "night")).toBe(false);
    const ifr = computeCurrency(flights, "2026-11-17", { framework: "FAA", types }).find((i) => i.kind === "ifr")!;
    expect(ifr.valid).toBe(true);
    expect(ifr.validUntil).toBe("2026-12-31"); // 6th approach flown in June: valid to the end of December
  });
});
