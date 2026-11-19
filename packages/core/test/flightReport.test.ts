import { describe, expect, it } from "vitest";
import { isPilot, parseFlightReport, withDash } from "../src";

const RYANAIR = `Flights for 12-Nov-26 - Not Verified
2026/11/12

FlightNumber : FR7475
Registration : EIIKC
City Pair : BVA - OPO
STD : 05:00
STA : 07:10
Block : 7205
Trip+Taxi : 4142
Dep : 8850
Arr : 4510
Burn Off : 4340
Actual Pax : 176
Airborne : 05:07
Landed : 06:56
Total flight : 01:49
Off Block : 04:51
On Block : 07:01
Total Block : 02:10

Pilot Flying :
Take Off : REMANT
Landing : REMANT

Captain Remarks : No Data Available
Verified By : STORMN , CP , 2026/11/12 07:06`;

describe("parseFlightReport", () => {
  it("reads a Ryanair post-flight e-mail", () => {
    const r = parseFlightReport(RYANAIR)!;
    expect(r).toMatchObject({ date: "2026-11-12", flightNumber: "FR7475", registration: "EI-IKC", from: "BVA", to: "OPO", out: "04:51", off: "05:07", on: "06:56", in: "07:01", takeoffBy: "REMANT", landingBy: "REMANT", pax: 176 });
  });
  it("ignores text that is not a report", () => {
    expect(parseFlightReport("Hello\nSee you tomorrow")).toBeUndefined();
  });
  it("matches the pilot by name", () => {
    expect(isPilot("REMANT", "Antoine Remant")).toBe(true);
    expect(isPilot("STORMN", "Antoine Remant")).toBe(false);
  });
});

describe("withDash", () => {
  it("puts the nationality prefix back", () => {
    expect(withDash("EIIKC")).toBe("EI-IKC");
    expect(withDash("FHZUN")).toBe("F-HZUN");
    expect(withDash("GEZTA")).toBe("G-EZTA");
    expect(withDash("N123AB")).toBe("N123AB");
    expect(withDash("9H-J4K")).toBe("9H-J4K");
  });
});
