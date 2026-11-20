import { describe, expect, it } from "vitest";
import {
  accessFor, analyseTable, DEFAULT_FTL_SETTINGS, analyseFtl, checkMapping, auditLogbook, pickLeg, simplifyTrack, buildDutyPeriods, combineUtc, computeNight, computeRecency, deriveFlightTimes,
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
      flight({ id: "3", outUtc: "2026-11-02T06:00:00Z", inUtc: "2026-11-02T08:00:00Z", totalMin: 120 }),
    ];
    const duties = buildDutyPeriods(flights);
    expect(duties).toHaveLength(2);
    const r = analyseFtl(duties, "2026-11-10T00:00:00Z");
    const codes = r.violations.map((v) => v.code);
    expect(codes).toContain("fdpExceeded");
    // 11:30 of rest after a 14:30 duty
    expect(r.violations.find((v) => v.code === "restTooShort")?.limitMin).toBe(14 * 60 + 30);
  });
  it("keeps a long wait on the ground in the duty; split duty only when the scheme has it and it is confirmed", () => {
    const flights = [
      flight({ id: "1", outUtc: "2026-11-01T07:00:00Z", inUtc: "2026-11-01T09:00:00Z", totalMin: 120 }),
      flight({ id: "1b", outUtc: "2026-11-01T07:00:00Z", inUtc: "2026-11-01T09:00:00Z", totalMin: 120 }), // logged twice
      flight({ id: "2", depIcao: "LFMN", arrIcao: "LFPG", outUtc: "2026-11-01T15:00:00Z", inUtc: "2026-11-01T17:00:00Z", totalMin: 120 }),
    ];
    const duties = buildDutyPeriods(flights);
    expect(duties).toHaveLength(1);
    expect(duties[0]!.sectors).toBe(2);
    const r = analyseFtl(duties, "2026-11-10T00:00:00Z", { ...DEFAULT_FTL_SETTINGS, homeTimezone: "UTC" });
    // FDP 06:00→17:00 = 11:00: within 13:00 without any split duty; the break is only a possible split duty
    expect(r.duties[0]!.splitExtensionMin).toBe(0);
    expect(r.duties[0]!.splitStatus).toBe("possible");
    expect(r.duties[0]!.basis).toBe("notDeterminable"); // no home base
    expect(r.violations).toEqual([]);
    // the scheme provides split duty, but this break is not confirmed: still nothing applied
    const s2 = { ...DEFAULT_FTL_SETTINGS, homeTimezone: "UTC", homeBaseIcao: "LFPG", splitDuty: true };
    expect(analyseFtl(duties, "2026-11-10T00:00:00Z", s2).duties[0]!.splitExtensionMin).toBe(0);
    // confirmed by the pilot: max 13:00 + (6:00 − 0:30) / 2; logbook times → estimated
    const c = analyseFtl(duties, "2026-11-10T00:00:00Z", { ...s2, confirmedSplits: [duties[0]!.id] }).duties[0]!;
    expect(c.splitExtensionMin).toBe(165);
    expect(c.splitStatus).toBe("confirmed");
    expect(c.basis).toBe("estimated");
  });
  it("warns rather than errs on an overrun within the 1 h extension", () => {
    const flights = [flight({ id: "1", outUtc: "2026-11-01T07:00:00Z", inUtc: "2026-11-01T19:30:00Z", totalMin: 750 })];
    const r = analyseFtl(buildDutyPeriods(flights), "2026-11-10T00:00:00Z", { ...DEFAULT_FTL_SETTINGS, homeTimezone: "UTC" });
    expect(r.violations.find((v) => v.code === "fdpExceeded")?.severity).toBe("warning");
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

describe("flight tracks", () => {
  const t0 = Date.parse("2026-11-14T08:00:00Z") / 1000;
  const leg = (start: number, n: number, lat0: number): import("../src").TrackPoint[] =>
    Array.from({ length: n }, (_, i) => [start + i * 60, lat0 + i * 0.01, 2 + i * 0.01, i < n / 2 ? i * 1000 : (n - i) * 1000, 400] as import("../src").TrackPoint);
  it("picks the leg matching the block times and trims it", () => {
    const legs = [leg(t0, 60, 48), leg(t0 + 3 * 3600, 90, 43)];
    const got = pickLeg(legs, "2026-11-14T11:05:00Z", "2026-11-14T12:20:00Z");
    expect(got?.[0]?.[1]).toBe(43);
    expect(pickLeg(legs, "2026-11-14T20:00:00Z", "2026-11-14T21:00:00Z")).toBeNull();
  });
  it("simplifies a straight line to its ends but keeps altitude changes", () => {
    const pts = leg(t0, 200, 48).map((p) => [p[0], p[1], p[2], 35000, 450] as import("../src").TrackPoint);
    expect(simplifyTrack(pts).length).toBe(2);
    expect(simplifyTrack(leg(t0, 40, 48)).length).toBeGreaterThan(10);
  });
});

describe("access", () => {
  const now = new Date("2026-11-14T12:00:00Z");
  const p = (createdAt: string, tier: "free" | "basic" | "premium", exp?: string) => ({ createdAt, subscriptionTier: tier, subscriptionExpiresAt: exp ?? null });
  it("gives a 7-day local demo, then read-only", () => {
    const a = accessFor(p("2026-11-10T00:00:00Z", "free"), { signedIn: false, now });
    expect(a.demo && a.canWrite && a.has("radar")).toBe(true);
    const b = accessFor(p("2026-11-01T00:00:00Z", "free"), { signedIn: false, now });
    expect(b.canWrite || b.has("roster")).toBe(false);
  });
  it("signed-in pilots need a subscription; Basic has no Max features", () => {
    expect(accessFor(p("2026-11-13T00:00:00Z", "free"), { signedIn: true, now }).canWrite).toBe(false);
    const basic = accessFor(p("2026-01-01T00:00:00Z", "basic", "2026-12-01T00:00:00Z"), { signedIn: true, now });
    expect(basic.canWrite && !basic.has("ftl")).toBe(true);
    expect(accessFor(p("2026-01-01T00:00:00Z", "premium", "2026-11-01T00:00:00Z"), { signedIn: true, now }).canWrite).toBe(false);
  });
});

describe("import: automatic column detection", () => {
  const map = (csv: string) => {
    const a = analyseTable(parseCsv(csv));
    const named = Object.fromEntries(Object.entries(a.mapping).filter(([, i]) => i >= 0).map(([f, i]) => [f, a.header[i]]));
    return { a, named, flights: rowsToFlights(a.rows, a.mapping, { dateOrder: a.dateOrder }) };
  };
  it("EASA paper layout with a title line and a two-row header", () => {
    const { named, flights, a } = map(
      [
        "Carnet de vol - export",
        "Date,Departure,,Arrival,,Aircraft,,Total time of flight,Name PIC,Landings,,Operational condition time,,Pilot function time,",
        ",Place,Time,Place,Time,Type,Registration,,,Day,Night,Night,IFR,PIC,Co-pilot",
        "26/05/2024,LFPG,08:05,EGLL,09:20,A320,F-HBXA,1:15,Dupont,1,0,0:00,1:15,0:00,1:15",
        "27/05/2024,EGLL,10:00,LFPG,11:10,A320,F-HBXA,1:10,Dupont,0,0,0:00,1:10,0:00,1:10",
      ].join("\n"),
    );
    expect(a.headerRow).toBe(1);
    expect(named).toMatchObject({ date: "Date", dep: "Departure Place", out: "Departure Time", arr: "Arrival Place", in: "Arrival Time", registration: "Aircraft Registration", total: "Total time of flight", landingsDay: "Landings Day", landingsNight: "Landings Night", ifr: "Operational condition time IFR", copilot: "Pilot function time Co-pilot" });
    expect(flights[0]!.input?.depIcao).toBe("LFPG");
  });
  it("ForeFlight-style camelCase export", () => {
    const { named } = map("Date,AircraftID,From,To,TimeOut,TimeOff,TimeOn,TimeIn,TotalTime,PIC,SIC,Night,DayLandingsFullStop,PilotComments\n2025-03-02,N123AB,KSFO,KLAX,14:00,14:12,15:20,15:30,1.5,1.5,0,0,1,ok");
    expect(named).toMatchObject({ registration: "AircraftID", dep: "From", arr: "To", out: "TimeOut", off: "TimeOff", on: "TimeOn", in: "TimeIn", total: "TotalTime", pic: "PIC", landingsDay: "DayLandingsFullStop", remarks: "PilotComments" });
  });
  it("unknown headers: recognised from the values", () => {
    const { named, a } = map("Jour,A,B,C,D,E,F,G\n12/31/2024,LFPO,LFML,07:10,08:25,1:15,F-GKXA,A320\n01/02/2025,LFML,LFPO,09:00,10:20,1:20,F-GKXA,A320");
    expect(a.dateOrder).toBe("mdy");
    expect(named).toMatchObject({ date: "Jour", dep: "A", arr: "B", out: "C", in: "D", total: "E", registration: "F", type: "G" });
  });
  it("does not take 'Total flight time' for the flight number", () => {
    const { named } = map("Flight date,Flight,From,To,Total flight time\n2025-01-01,AF1234,LFPG,LFMN,1:30");
    expect(named).toMatchObject({ flightNumber: "Flight", total: "Total flight time" });
  });
});

describe("import: cross-checks on the data", () => {
  it("maps an all-caps export with LDGS_/DURATION_/TIME_BLOCK_ columns and flags a wrong total", () => {
    const header = "DATE,FLIGHT_NUMBER,DEPARTURE_AIRPORT,ARRIVAL_AIRPORT,TIME_BLOCK_START,TIME_TAKEOFF,TIME_LANDING,TIME_BLOCK_END,AIRCRAFT_REGISTRATION,AIRCRAFT_TYPE,NAME_PIC,DURATION_TOTAL,DURATION_NIGHT,TAKEOFFS_DAY,TAKEOFFS_NIGHT,LDGS_DAY,LDGS_NIGHT,DURATION_PIC,DURATION_SIC";
    const rows = [
      "2026-10-01,AF1,LFPG,LFML,06:10,06:25,07:35,07:45,F-HBXA,A320,X,1:35,0:00,1,0,1,0,0:00,1:35",
      "2026-10-01,AF2,LFML,LFPG,08:40,08:52,10:05,10:15,F-HBXA,A320,X,1:35,0:20,0,1,0,1,0:00,1:35",
      "2026-10-02,AF3,LFPG,EGLL,09:00,09:10,10:05,10:20,F-HBXA,A320,X,1:20,0:00,1,0,1,0,0:00,1:20",
    ];
    const a = analyseTable(parseCsv([header, ...rows].join("\n")));
    const named = Object.fromEntries(Object.entries(a.mapping).filter(([, i]) => i >= 0).map(([f, i]) => [f, a.header[i]]));
    expect(named).toMatchObject({ out: "TIME_BLOCK_START", in: "TIME_BLOCK_END", total: "DURATION_TOTAL", night: "DURATION_NIGHT", landingsDay: "LDGS_DAY", landingsNight: "LDGS_NIGHT", takeoffsNight: "TAKEOFFS_NIGHT" });
    expect(a.checks).toEqual([]);
    // a "total" that is not the block time is reported
    const bad = { ...a.mapping, total: a.header.indexOf("TIME_TAKEOFF") };
    expect(checkMapping(a.rows, bad).map((c) => c.issue)).toContain("totalVsBlock");
  });
});

describe("weather", () => {
  it("decodes an AWC METAR and splits a TAF", async () => {
    const { parseAwcMetar, tafLines, windText, visibilityText } = await import("../src/weather");
    const m = parseAwcMetar({ icaoId: "LFPB", rawOb: "METAR LFPB 161030Z 24012G22KT 9999 BKN008 OVC020 12/10 Q1012 NOSIG", obsTime: 1794825000, wdir: 240, wspd: 12, wgst: 22, visib: "6+", temp: 12, dewp: 10, altim: 1012, clouds: [{ cover: "BKN", base: 800 }, { cover: "OVC", base: 2000 }] })!;
    expect(m.category).toBe("IFR");
    expect(windText(m)).toBe("240° 12 kt G22");
    expect(visibilityText(m.visibSm)).toBe("≥ 10 km");
    expect(tafLines("TAF LFPB 161100Z 1612/1712 24012KT 9999 BKN015 TEMPO 1614/1618 4000 SHRA BECMG 1700/1702 VRB03KT PROB30 TEMPO 1703/1707 BR")).toHaveLength(4);
  });
});

describe("favoured runway", () => {
  it("picks the end facing the wind, calm below 4 kt", async () => {
    const { favouredRunway } = await import("../src/weather");
    const lfpb = [["03", 26, 7858], ["21", 206, 7858], ["07", 69, 9843], ["25", 249, 9843], ["09", 86, 6060], ["27", 266, 6060]].map(([ident, headingTrue, lengthFt]) => ({ ident: String(ident), headingTrue: Number(headingTrue), lengthFt: Number(lengthFt) }));
    expect(favouredRunway({ wdir: 230, wspd: 9 }, lfpb)).toMatchObject({ ident: "25", headwindKt: 9 });
    expect(favouredRunway({ wdir: 40, wspd: 12 }, lfpb)).toMatchObject({ ident: "03" });
    expect(favouredRunway({ wdir: "VRB", wspd: 2 }, lfpb)).toEqual({ calm: true });
  });
});

describe("runway use from traffic", () => {
  it("sees a landing on 26L and a departure from 27L", async () => {
    const { classifyRunwayUse, RunwayUseTracker, runwayUseLabel } = await import("../src/runwayUse");
    const ends = [
      { ident: "08R", headingTrue: 85, lengthFt: 8858, lat: 48.9929, lon: 2.56566 },
      { ident: "26L", headingTrue: 265, lengthFt: 8858, lat: 48.9949, lon: 2.60243 },
      { ident: "09R", headingTrue: 86, lengthFt: 13780, lat: 49.0206, lon: 2.51306 },
      { ident: "27L", headingTrue: 266, lengthFt: 13780, lat: 49.0237, lon: 2.57029 },
    ];
    // 6 NM east of the 26L threshold, on the centreline, 2 000 ft above the field, descending westbound
    const arr = { hex: "a", lat: 48.9949 + (6 / 60) * Math.sin((5 * Math.PI) / 180) * 0, lon: 2.60243 + 6 / (60 * Math.cos((49 * Math.PI) / 180)), alt: 2400, trk: 265, vr: -700, gs: 150 };
    expect(classifyRunwayUse(arr, 392, ends)).toEqual({ ident: "26L", kind: "arr" });
    // 3 NM west of the 27L runway end (past 09R threshold), climbing westbound
    const dep = { hex: "b", lat: 49.0206, lon: 2.51306 - 3 / (60 * Math.cos((49 * Math.PI) / 180)), alt: 2600, trk: 266, vr: 2000, gs: 180 };
    expect(classifyRunwayUse(dep, 392, ends)).toEqual({ ident: "27L", kind: "dep" });
    // eastbound at 2 400 ft over the same point: aligned with 08R but neither approaching nor climbing out
    expect(classifyRunwayUse({ ...arr, trk: 85, vr: 0 }, 392, ends)).toBeNull();
    const tr = new RunwayUseTracker();
    tr.observe("LFPG", "a", { ident: "26L", kind: "arr" });
    tr.observe("LFPG", "b", { ident: "27L", kind: "dep" });
    expect(runwayUseLabel(tr.summary("LFPG"))).toBe("↓26L ↑27L");
  });
});

describe("language proficiency", () => {
  it("computes validity and reads the code", async () => {
    const { lpeValidUntil, lpeCode, parseLpe } = await import("../src/licenses");
    expect(lpeValidUntil(4, "2026-01-27")).toBe("2030-01-27");
    expect(lpeValidUntil(5, "2026-01-27")).toBe("2032-01-27");
    expect(lpeValidUntil(6, "2026-01-27")).toBeNull();
    expect(lpeCode("English", 6)).toBe("LPE English 6");
    expect(parseLpe("LPE English 6")).toEqual({ language: "English", level: 6 });
    expect(parseLpe("LPE French")).toEqual({ language: "French", level: undefined });
  });
});

describe("medical validity", () => {
  it("follows MED.A.045", async () => {
    const { medicalValidUntil, medicalValidityMonths } = await import("../src/licenses");
    expect(medicalValidityMonths("Class 1", "u40")).toBe(12);
    expect(medicalValidityMonths("Class 1", "40to49", true)).toBe(6);
    expect(medicalValidityMonths("Class 1", "60plus")).toBe(6);
    expect(medicalValidityMonths("Class 2", "40to49")).toBe(24);
    expect(medicalValidityMonths("LAPL medical", "50to59")).toBe(24);
    expect(medicalValidUntil("Class 1", "2026-03-11", "u40")).toBe("2027-03-10");
  });
});

describe("Subpart Q", () => {
  it("13 h less sectors and WOCL", async () => {
    const { subpartQMaxFdp } = await import("../src/ftl");
    expect(subpartQMaxFdp(8 * 60, 600, 2)).toBe(13 * 60);
    expect(subpartQMaxFdp(8 * 60, 600, 5)).toBe(13 * 60 - 90);
    expect(subpartQMaxFdp(8 * 60, 600, 8)).toBe(11 * 60);
    expect(subpartQMaxFdp(4 * 60, 300, 2)).toBe(13 * 60 - 120); // starts at 04:00: 2 h of WOCL left, all of it
    expect(subpartQMaxFdp(20 * 60, 600, 2)).toBe(13 * 60 - 120); // 20:00–06:00 spans the WOCL: 4 h × 50 %
  });
});

describe("phone numbers", () => {
  it("always carry the international dialling code", async () => {
    const { formatPhoneIntl } = await import("../src/phone");
    expect(formatPhoneIntl("06 12 34 56 78", "FR")).toBe("+33 6 12 34 56 78");
    expect(formatPhoneIntl("0033612345678")).toBe("+33 6 12 34 56 78");
    expect(formatPhoneIntl("+34 612 345 678", "FR")).toBe("+34 612 34 56 78");
    expect(formatPhoneIntl("call me")).toBe("call me");
  });
});
