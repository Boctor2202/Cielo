import { describe, expect, it } from "vitest";
import { buildProfile, countryFrom, regionOf, authorityOf, detectAircraft, detectPosition, extractRequirements, extractSalary, isPilotJob, matchJob, toJob, toText, type Job, type PilotProfile } from "../src";

// Synthetic ads written for the tests (no real posting text is stored anywhere).
const ADS = {
  globalFO: { title: "First Officer Bombardier Global Express", text: "• EASA ATPL licence\n• Type Rating: Bombardier Global Express\n• Minimum 2,000 total flight hours, including 1,000 on jet aircraft\n• English ICAO level 5" },
  a320Cpt: { title: "Captain A320 – Paris base", text: "Requirements: valid EASA ATPL, 4000 hours total of which 1500 hrs PIC on jet. A320 type rating required. Salary: €9,500 – €11,000 per month gross." },
  cadet: { title: "Cadet Pilot Programme 2026", text: "Frozen ATPL or CPL/IR with MCC. 200h minimum. Type rating sponsored by the company." },
  de: { title: "Captain (m/w/d) Cessna Citation Longitude", text: "Ihr Profil: gültige EASA ATPL, mindestens 3.000 Flugstunden, davon 500 Stunden PIC. Gehalt: 7.500 EUR brutto pro Monat." },
};

describe("extraction", () => {
  it("recognises pilot jobs and positions", () => {
    expect(isPilotJob("First Officer Bombardier Global Express")).toBe(true);
    expect(isPilotJob("Cabin Crew Member")).toBe(false);
    expect(isPilotJob("Pilot Recruitment Coordinator")).toBe(false);
    expect(detectPosition("Captain A320")).toBe("CPT");
    expect(detectPosition("Boeing 787 First Officer")).toBe("FO");
    expect(detectPosition("Cadet Pilot Programme")).toBe("CADET");
    expect(detectPosition("Kapitän (m/w/d) Phenom 300")).toBe("CPT");
  });
  it("maps aircraft names to ICAO designators", () => {
    expect(detectAircraft("Bombardier Global Express")).toContain("GLEX");
    expect(detectAircraft("Cessna Citation Latitude")).toEqual(["C68A"]);
    expect(detectAircraft("Captain A320 family")).toContain("A320");
    expect(detectAircraft("Boeing 787 First Officer")).toContain("B789");
    expect(detectAircraft("Pilatus PC-24")).toEqual(["PC24"]);
  });
  it("reads required experience", () => {
    expect(extractRequirements(ADS.globalFO.title, ADS.globalFO.text)).toMatchObject({ licence: "ATPL", authority: "EASA", totalHours: 2000, jetHours: 1000, typeRatingRequired: true, englishLevel: 5 });
    expect(extractRequirements(ADS.a320Cpt.title, ADS.a320Cpt.text)).toMatchObject({ licence: "ATPL", totalHours: 4000, picHours: 1500, typeRatingRequired: true });
    expect(extractRequirements(ADS.cadet.title, ADS.cadet.text)).toMatchObject({ licence: "FATPL", totalHours: 200, typeRatingProvided: true });
    expect(extractRequirements(ADS.cadet.title, ADS.cadet.text).typeRatingRequired).toBeUndefined();
    expect(extractRequirements(ADS.de.title, ADS.de.text)).toMatchObject({ licence: "ATPL", totalHours: 3000, picHours: 500 });
  });
  it("reads salaries in several formats", () => {
    expect(extractSalary(ADS.a320Cpt.text)).toMatchObject({ min: 9500, max: 11000, currency: "EUR", period: "month", annualEur: 123000 });
    expect(extractSalary(ADS.de.text)).toMatchObject({ min: 7500, currency: "EUR", period: "month" });
    expect(extractSalary("Competitive salary of £85k - £95k p.a.")).toMatchObject({ min: 85000, max: 95000, currency: "GBP", period: "year" });
    expect(extractSalary("Minimum 2,000 total flight hours")).toBeUndefined();
    expect(extractSalary("Founded in 2008, 1,500 employees")).toBeUndefined();
  });
  it("cleans HTML", () => {
    expect(toText("<ul><li>ATPL&nbsp;licence</li><li>2,000&amp;nbsp;h</li></ul>")).toBe("• ATPL licence\n• 2,000 h");
  });
});

describe("matching", () => {
  const src = { company: "Test", ats: "recruitee" as const, token: "t", segment: "business" as const, country: "FR" };
  const job = (ad: { title: string; text: string }): Job => toJob({ id: ad.title, company: "Test", title: ad.title, url: "https://example.com", text: ad.text }, src);

  // A Citation Latitude / Global captain-to-be: 3,200 h, 900 PIC, rated on the Latitude
  const flights = [
    { totalMin: 2400 * 60, picMin: 700 * 60, picusMin: 0, multiPilotMin: 2400 * 60, singlePilotMeMin: 0, aircraftTypeIcao: "C68A", isFstd: false },
    { totalMin: 400 * 60, picMin: 200 * 60, picusMin: 0, multiPilotMin: 0, singlePilotMeMin: 400 * 60, aircraftTypeIcao: "BE20", isFstd: false },
  ];
  const opening = [{ totalMin: 400 * 60, picMin: 0, multiPilotMin: 0, singlePilotMeMin: 0, aircraftTypeIcao: "DR40" }];
  const engines: Record<string, string> = { C68A: "jet", BE20: "turboprop", DR40: "piston" };
  const me: PilotProfile = buildProfile(flights, opening, [{ code: "ATPL(A)", kind: "licence", authority: "DGAC France" }, { code: "LPE English 6", kind: "language" }, { code: "TR C680A", kind: "rating" }], (i) => engines[i], () => ["C68A"]);

  it("builds the profile from the logbook", () => {
    expect(me).toMatchObject({ totalMin: 3200 * 60, picMin: 900 * 60, jetMin: 2400 * 60, turbineMin: 2800 * 60, licence: "ATPL", englishLevel: 6 });
    expect(me.ratedTypes).toContain("C68A");
  });
  it("scores a job the pilot fully meets except the type rating", () => {
    const m = matchJob(job(ADS.globalFO), me);
    expect(m.gaps.map((g) => g.code)).toEqual(["typeRating"]);
    expect(m.score).toBeLessThanOrEqual(55); // required TR not held caps the score
    expect(m.met).toEqual(expect.arrayContaining(["licence", "totalHours", "jetHours", "english"]));
  });
  it("ranks a type-rated job above one requiring another rating", () => {
    const lat = job({ title: "First Officer Cessna Citation Latitude", text: "ATPL, 1500 hours total, type rated on Latitude required." });
    expect(matchJob(lat, me).score).toBeGreaterThanOrEqual(90);
    expect(matchJob(lat, me).onType).toBe(true);
    expect(matchJob(lat, me).score).toBeGreaterThan(matchJob(job(ADS.a320Cpt), me).score);
  });
  it("a cadet programme with a sponsored rating is a strong match for an experienced pilot", () => {
    expect(matchJob(job(ADS.cadet), me).score).toBeGreaterThanOrEqual(80);
  });
});

describe("regions", () => {
  it("finds the country and region from feed fields", () => {
    expect(countryFrom(undefined, "Miami, FL, USA")).toBe("US");
    expect(countryFrom("United Kingdom", "Gatwick")).toBe("GB");
    expect(countryFrom("mt", "Saint Julian's")).toBe("MT");
    expect(countryFrom(undefined, "Brussel, Brussels Hoofdstedelijk Gewest, België")).toBe("BE");
    expect(regionOf("MT")).toBe("EU");
    expect(regionOf("GB")).toBe("UK");
    expect(regionOf("AE")).toBe("ME");
    expect(authorityOf("CH")).toBe("EASA");
    expect(authorityOf("US")).toBe("FAA");
  });

  const src = (country: string) => ({ company: "Test", ats: "recruitee" as const, token: "t", segment: "airline" as const, country });
  const ad = { title: "First Officer A320", text: "ATPL, 1500 hours total. Type rating provided." };
  const engines: Record<string, string> = { A320: "jet" };
  const eu = buildProfile([{ totalMin: 3000 * 60, picMin: 0, picusMin: 0, multiPilotMin: 3000 * 60, singlePilotMeMin: 0, aircraftTypeIcao: "A320", isFstd: false }], [], [{ code: "ATPL(A)", kind: "licence", authority: "DGAC France" }], (i) => engines[i], () => []);

  it("an EASA pilot defaults to EU work rights", () => {
    expect(eu.authorities).toEqual(["EASA"]);
    expect(eu.workRegions).toEqual(["EU"]);
  });
  it("caps US jobs for a European pilot without US work rights or FAA licence", () => {
    const fr = matchJob(toJob({ id: "a", company: "T", title: ad.title, url: "u", text: ad.text }, src("FR")), eu);
    const us = matchJob(toJob({ id: "b", company: "T", title: ad.title, url: "u", text: ad.text }, src("US")), eu);
    expect(fr.canWork && fr.licenceValid).toBe(true);
    expect(us.canWork).toBe(false);
    expect(us.licenceValid).toBe(false);
    expect(us.score).toBeLessThanOrEqual(35);
    expect(fr.score).toBeGreaterThan(us.score);
    expect(us.gaps.map((g) => g.code)).toEqual(expect.arrayContaining(["workRights", "licenceAuthority"]));
  });
  it("visa sponsorship lifts the work-rights block, and declared work rights count", () => {
    const sponsored = toJob({ id: "c", company: "T", title: ad.title, url: "u", text: ad.text + " Visa sponsorship is available." }, src("AE"));
    expect(sponsored.requirements.visaSponsored).toBe(true);
    expect(matchJob(sponsored, eu).canWork).toBe(true);
    const withUs = { ...eu, workRegions: ["EU", "US"] as const };
    expect(matchJob(toJob({ id: "d", company: "T", title: ad.title, url: "u", text: ad.text }, src("US")), { ...withUs, workRegions: [...withUs.workRegions] }).canWork).toBe(true);
  });
});

describe("adzuna", () => {
  it("guesses the segment of an offer", async () => {
    const { segmentOf } = await import("../src/adzuna");
    expect(segmentOf("Citation XLS Captain, Part 135 charter")).toBe("business");
    expect(segmentOf("HEMS helicopter pilot")).toBe("helicopter");
    expect(segmentOf("A320 First Officer")).toBe("airline");
    expect(segmentOf("B747 Captain, cargo")).toBe("cargo");
  });
});

describe("instructor posts", () => {
  it("are not a match without an instructor rating", async () => {
    const { matchJob } = await import("../src/match");
    const job = { id: "x", source: "adzuna", company: "Airbus", segment: "other", title: "Pilot Instructor / Examiner A350", position: "FI", aircraft: ["A359"], region: "EU", authority: "EASA", url: "", requirements: {}, fetchedAt: "" } as never;
    const me = { totalMin: 600000, picMin: 300000, multiPilotMin: 500000, multiEngineMin: 500000, turbineMin: 500000, jetMin: 500000, typeMin: {}, ratedTypes: [], authorities: ["EASA"], workRegions: ["EU"] } as never;
    expect(matchJob(job, me).score).toBeLessThanOrEqual(20);
    expect(matchJob(job, { ...(me as object), instructor: true, examiner: true } as never).score).toBeGreaterThan(50);
  });
});
