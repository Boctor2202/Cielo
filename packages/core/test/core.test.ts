import { describe, expect, it } from "vitest";
import {
  analyseFtl, auditLogbook, buildDutyPeriods, combineUtc, computeNight, computeRecency, deriveFlightTimes,
  detectMapping, formatDuration, icalToRosterEvent, licenseStatus, maxDailyFdp, parseCsv, parseDuration,
  parseFlexibleDate, parseIcal, rowsToFlights, sumFlights, sunElevation, type Airport, type Flight,
} from "../src";

const LFPG: Airport = { id: "LFPG", icao: "LFPG", name: "Paris CDG", country: "FR", lat: 49.0097, lon: 2.5479 };
const LFMN: Airport = { id: "LFMN", icao: "LFMN", name: "Nice", country: "FR", lat: 43.6584, lon: 7.2159 };
const KJFK: Airport = { id: "KJFK", icao: "KJFK", name: "New York JFK", country: "US", lat: 40.6398, lon: -73.7789 };
const airports = (icao: string) => ({ LFPG, LFMN, KJFK } as Record<string, Airport>)[icao];

function flight(p: Partial<Flight>): Flight {
  return {
    id: p.id ?? Math.random().toString(36).slice(2), createdAt: "", updatedAt: "", pilotId: "p", date: "2026-06-01",
    source: "manual", depIcao: "LFPG", arrIcao: "LFMN", totalMin: 90, airMin: 75, singlePilotSeMin: 0,
    singlePilotMeMin: 0, multiPilotMin: 90, function: "PIC", picMin: 90, picusMin: 0, copilotMin: 0, dualMin: 0,
    instructorMin: 0, examinerMin: 0, nightMin: 0, ifrMin: 90, actualImcMin: 0, xcMin: 0, nightCalc: "auto",
    takeoffsDay: 1, takeoffsNight: 0, landingsDay: 1, landingsNight: 0, pilotFlying: true, approaches: [],
    isFstd: false, fstdMin: 0, crew: [], locked: false, ...p,
  };
}

describe("time", () => {
  it("formats and parses durations", () => {
    expect(formatDuration(125)).toBe("2:05");
    expect(formatDuration(90, "decimal")).toBe("1.5");
    expect(parseDuration("2:05")).toBe(125);
    expect(parseDuration("1,5")).toBe(90);
    expect(parseDuration("0205")).toBe(125);
  });
  it("rolls over midnight", () => {
    const out = combineUtc("2026-01-10", "23:30");
    expect(combineUtc("2026-01-10", "01:10", out)).toBe("2026-01-11T01:10:00.000Z");
  });
  it("parses dates", () => {
    expect(parseFlexibleDate("10/11/26")).toBe("2026-11-10");
    expect(parseFlexibleDate("2026-11-10")).toBe("2026-11-10");
    expect(parseFlexibleDate("11/10/2026", "mdy")).toBe("2026-11-10");
  });
});

describe("solar", () => {
  it("matches known civil twilight in Paris", () => {
    // 21 June: sunset ≈ 19:58 UTC, end of civil twilight ≈ 20:43 UTC
    expect(sunElevation(LFPG.lat, LFPG.lon, Date.parse("2026-06-21T20:20:00Z"))).toBeGreaterThan(-6);
    expect(sunElevation(LFPG.lat, LFPG.lon, Date.parse("2026-06-21T21:05:00Z"))).toBeLessThan(-6);
    // 21 December: end of civil twilight ≈ 16:35 UTC
    expect(sunElevation(LFPG.lat, LFPG.lon, Date.parse("2026-12-21T16:20:00Z"))).toBeGreaterThan(-6);
    expect(sunElevation(LFPG.lat, LFPG.lon, Date.parse("2026-12-21T16:50:00Z"))).toBeLessThan(-6);
  });
  it("puts the sun near the zenith at the equator at equinox noon", () => {
    expect(sunElevation(0, 0, Date.parse("2026-03-20T12:07:00Z"))).toBeGreaterThan(88);
  });
});

describe("night", () => {
  it("is zero for a midday flight and full for a midnight flight", () => {
    const day = computeNight({ dep: LFPG, arr: LFMN, outUtc: "2026-06-21T10:00:00Z", inUtc: "2026-06-21T11:30:00Z" });
    expect(day?.nightMin).toBe(0);
    const night = computeNight({ dep: LFPG, arr: LFMN, outUtc: "2026-06-21T23:00:00Z", inUtc: "2026-06-22T00:30:00Z" });
    expect(night?.nightMin).toBe(90);
    expect(night?.landingAtNight).toBe(true);
  });
  it("splits a dusk flight", () => {
    const r = computeNight({ dep: LFPG, arr: LFMN, outUtc: "2026-12-21T16:00:00Z", offUtc: "2026-12-21T16:15:00Z", onUtc: "2026-12-21T17:30:00Z", inUtc: "2026-12-21T17:40:00Z" })!;
    expect(r.nightMin).toBeGreaterThan(40);
    expect(r.nightMin).toBeLessThan(100);
    expect(r.takeoffAtNight).toBe(false);
    expect(r.landingAtNight).toBe(true);
  });
});

describe("deriveFlightTimes", () => {
  it("derives multi-pilot PIC IFR times with auto landings", () => {
    const d = deriveFlightTimes(
      { date: "2026-06-21", depIcao: "LFPG", arrIcao: "LFMN", out: "10:00", off: "10:15", on: "11:20", in: "11:30", function: "PIC", ifr: true, pilotFlying: true, autoLandings: true, isFstd: false },
      { airports, aircraftType: { id: "t", createdAt: "", updatedAt: "", icao: "A320", manufacturer: "Airbus", model: "A320", category: "airplane", engineType: "jet", engineCount: 2, multiPilot: true } },
    );
    expect(d.totalMin).toBe(90);
    expect(d.airMin).toBe(65);
    expect(d.multiPilotMin).toBe(90);
    expect(d.picMin).toBe(90);
    expect(d.ifrMin).toBe(90);
    expect(d.nightMin).toBe(0);
    expect(d.landingsDay).toBe(1);
  });
  it("handles single-engine piston and midnight", () => {
    const d = deriveFlightTimes(
      { date: "2026-06-21", depIcao: "LFPG", arrIcao: "LFMN", out: "23:30", in: "01:00", function: "DUAL", ifr: false, pilotFlying: true, autoLandings: true, isFstd: false },
      { airports },
    );
    expect(d.totalMin).toBe(90);
    expect(d.singlePilotSeMin).toBe(90);
    expect(d.dualMin).toBe(90);
    expect(d.landingsNight).toBe(1);
  });
});

describe("totals & recency", () => {
  const flights = [
    flight({ date: "2026-10-01", landingsDay: 1, takeoffsDay: 1 }),
    flight({ date: "2026-10-20", landingsDay: 1, takeoffsDay: 1 }),
    flight({ date: "2026-11-05", landingsDay: 0, landingsNight: 1, takeoffsDay: 0, takeoffsNight: 1, nightMin: 60 }),
  ];
  it("sums", () => {
    const t = sumFlights(flights);
    expect(t.totalMin).toBe(270);
    expect(t.nightMin).toBe(60);
    expect(t.flights).toBe(3);
  });
  it("computes FCL.060 recency and expiry", () => {
    const r = computeRecency(flights, "2026-11-10");
    expect(r.passengers.valid).toBe(true);
    expect(r.passengers.validUntil).toBe("2026-12-29");
    expect(r.night.valid).toBe(true);
    expect(computeRecency(flights, "2027-01-15").passengers.valid).toBe(false);
  });
});

describe("audit", () => {
  it("detects overlap, ordering and duplicates", () => {
    const a = flight({ id: "a", outUtc: "2026-06-01T10:00:00Z", inUtc: "2026-06-01T11:30:00Z" });
    const b = flight({ id: "b", depIcao: "LFMN", arrIcao: "LFPG", outUtc: "2026-06-01T11:00:00Z", inUtc: "2026-06-01T10:30:00Z", nightMin: 200 });
    const c = flight({ id: "c", outUtc: "2026-06-01T10:00:00Z", inUtc: "2026-06-01T11:30:00Z" });
    const codes = auditLogbook([a, b, c], { today: "2026-11-10", airports }).map((i) => `${i.flightId}:${i.code}`);
    expect(codes).toContain("b:timesOrder");
    expect(codes).toContain("b:overlap");
    expect(codes).toContain("b:nightExceedsTotal");
    expect(codes).toContain("c:duplicate");
  });
});

describe("ftl", () => {
  it("applies the ORO.FTL.205 table", () => {
    expect(maxDailyFdp(8 * 60, 2)).toBe(13 * 60);
    expect(maxDailyFdp(8 * 60, 4)).toBe(12 * 60);
    expect(maxDailyFdp(18 * 60, 6)).toBe(9 * 60);
    expect(maxDailyFdp(5 * 60 + 20, 1)).toBe(12 * 60 + 15);
    expect(maxDailyFdp(14 * 60 + 10, 10)).toBe(9 * 60);
  });
  it("flags FDP and rest violations", () => {
    const flights = [
      flight({ id: "1", outUtc: "2026-11-01T05:00:00Z", inUtc: "2026-11-01T09:00:00Z", totalMin: 240 }),
      flight({ id: "2", depIcao: "LFMN", arrIcao: "LFPG", outUtc: "2026-11-01T10:00:00Z", inUtc: "2026-11-01T18:00:00Z", totalMin: 480 }),
      flight({ id: "3", outUtc: "2026-11-02T03:00:00Z", inUtc: "2026-11-02T05:00:00Z", totalMin: 120 }),
    ];
    const duties = buildDutyPeriods(flights);
    expect(duties).toHaveLength(2);
    const r = analyseFtl(duties, "2026-11-10T00:00:00Z");
    const codes = r.violations.map((v) => v.code);
    expect(codes).toContain("fdpExceeded");
    expect(codes).toContain("restTooShort");
  });
});

describe("licenses", () => {
  it("computes state", () => {
    expect(licenseStatus({ validUntil: "2026-11-20", alertDays: [90, 30, 7] }, "2026-11-10")).toMatchObject({ state: "expiring", daysLeft: 10, threshold: 30 });
    expect(licenseStatus({ validUntil: "2026-11-01", alertDays: [] }, "2026-11-10").state).toBe("expired");
    expect(licenseStatus({ validUntil: "2028-01-01", alertDays: [] }, "2026-11-10").state).toBe("valid");
  });
});

describe("import", () => {
  it("maps a CSV with French headers", () => {
    const csv = "Date;Départ;Arrivée;Off block;On block;Immatriculation;Type;Fonction;Nuit\n10/11/2026;LFPG;LFMN;08:00;09:35;F-HBXA;A320;OPL;0:20\n";
    const rows = parseCsv(csv);
    const map = detectMapping(rows[0]!);
    expect(map.dep).toBe(1);
    expect(map.arr).toBe(2);
    expect(map.out).toBe(3);
    expect(map.in).toBe(4);
    const [r] = rowsToFlights(rows.slice(1), map);
    expect(r!.errors).toEqual([]);
    expect(r!.input).toMatchObject({ date: "2026-11-10", depIcao: "LFPG", function: "SIC", nightOverrideMin: 20, registration: "F-HBXA" });
  });
  it("reads a duration in the simulator column as the session time", () => {
    const csv = "Date;Simulateur;Off block;On block\n22/12/2020;1:15;09:00;10:15\n";
    const rows = parseCsv(csv);
    const [r] = rowsToFlights(rows.slice(1), detectMapping(rows[0]!));
    expect(r!.input).toMatchObject({ isFstd: true, fstdMin: 75 });
    expect(r!.input!.fstdType).toBeUndefined();
  });
  it("parses iCal roster events", () => {
    const ics = [
      "BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:1", "DTSTART:20261112T061500Z", "DTEND:20261112T074500Z",
      "SUMMARY:AF7700 LFPG-LFMN", "END:VEVENT", "BEGIN:VEVENT", "UID:2", "DTSTART;TZID=Europe/Paris:20261113T080000",
      "DTEND;TZID=Europe/Paris:20261113T160000", "SUMMARY:SBY Home", "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const ev = parseIcal(ics);
    expect(ev).toHaveLength(2);
    expect(ev[1]!.startUtc).toBe("2026-11-13T07:00:00.000Z");
    const r = icalToRosterEvent(ev[0]!, "p", () => undefined);
    expect(r).toMatchObject({ kind: "FLIGHT", depIcao: "LFPG", arrIcao: "LFMN", flightNumber: "AF7700" });
    expect(icalToRosterEvent(ev[1]!, "p", () => undefined).kind).toBe("STANDBY");
  });
});
