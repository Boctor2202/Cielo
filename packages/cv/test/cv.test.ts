import { describe, expect, it } from "vitest";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import type { Flight, OpeningBalance } from "@cielo/core";
import { atsReport, buildCvDocument, buildCvPdf, cvToText, expandLicence, flightExperience, toJsonResume, type CvData, type TypeInfo } from "../src";

const TYPES: Record<string, TypeInfo> = {
  C68A: { icao: "C68A", manufacturer: "Cessna", model: "Citation Latitude", category: "airplane", engineType: "jet", multiPilot: true },
  BE20: { icao: "BE20", manufacturer: "Beechcraft", model: "King Air 200", category: "airplane", engineType: "turboprop", multiPilot: false },
  DR40: { icao: "DR40", manufacturer: "Robin", model: "DR400", category: "airplane", engineType: "piston", multiPilot: false },
};
const base = (p: Partial<Flight>): Flight => ({
  id: Math.random().toString(36), createdAt: "", updatedAt: "", pilotId: "p", date: "2026-10-01", source: "manual", depIcao: "LFPB", arrIcao: "LFMN",
  totalMin: 0, airMin: 0, singlePilotSeMin: 0, singlePilotMeMin: 0, multiPilotMin: 0, function: "SIC", picMin: 0, picusMin: 0, copilotMin: 0, dualMin: 0,
  instructorMin: 0, examinerMin: 0, nightMin: 0, ifrMin: 0, actualImcMin: 0, xcMin: 0, nightCalc: "auto", takeoffsDay: 1, takeoffsNight: 0, landingsDay: 1,
  landingsNight: 0, pilotFlying: true, approaches: [], isFstd: false, fstdMin: 0, crew: [], locked: false, ...p,
});
const flights: Flight[] = [
  base({ date: "2026-10-01", aircraftTypeIcao: "C68A", totalMin: 1800 * 60, multiPilotMin: 1800 * 60, copilotMin: 1500 * 60, picusMin: 300 * 60, nightMin: 300 * 60, ifrMin: 1700 * 60, landingsDay: 900 }),
  base({ date: "2024-06-01", aircraftTypeIcao: "BE20", totalMin: 500 * 60, singlePilotMeMin: 500 * 60, picMin: 500 * 60, function: "PIC", landingsDay: 400 }),
  base({ date: "2026-10-02", isFstd: true, fstdMin: 4 * 60, fstdType: "C68A FFS" }),
];
const opening: OpeningBalance[] = [{ id: "o", createdAt: "", updatedAt: "", pilotId: "p", asOfDate: "2019-01-01", aircraftTypeIcao: "DR40", totalMin: 250 * 60, singlePilotSeMin: 250 * 60, singlePilotMeMin: 0, multiPilotMin: 0, picMin: 200 * 60, copilotMin: 0, dualMin: 50 * 60, instructorMin: 0, nightMin: 10 * 60, ifrMin: 0, landingsDay: 300, landingsNight: 5, fstdMin: 0 }];

const hours = flightExperience(flights, opening, (i) => TYPES[i], "2026-11-14");
const cv: CvData = {
  locale: "en",
  hours,
  licences: [
    { kind: "licence", code: "ATPL(A)", authority: "DGAC France", number: "FRA.FCL.PA.012345" },
    { kind: "rating", code: "TR C680A", validUntil: "2027-04-30" },
    { kind: "rating", code: "IR(A) ME", validUntil: "2027-04-30" },
    { kind: "medical", code: "Class 1", validUntil: "2027-06-30" },
    { kind: "language", code: "LPE English 6" },
    { kind: "other", code: "Passport" },
  ],
  profile: {
    fullName: "Camille Martin",
    email: "camille@example.com",
    phone: "+33 6 00 00 00 00",
    location: "Paris, France",
    summary: "Type-rated Citation Latitude first officer with 2,550 hours, 1,800 multi-pilot jet hours and an ATPL. Operates demanding European business aviation missions to high standards of safety and customer service.",
    target: { title: "First Officer", company: "Aston Jet", aircraft: ["GLEX"], keywords: ["ATPL", "Global Express", "multi-crew"] },
    experience: [{ role: "First Officer", employer: "Example Business Jets", start: "2023-03", aircraft: ["C68A"], bullets: ["1,800 h on Citation Latitude in a two-pilot crew.", "Line operations across Europe, North Africa and the Middle East."] }],
    education: [{ title: "ATPL integrated course", school: "Example Flight Academy", start: "2019-09", end: "2021-06" }],
    languages: [{ name: "French", level: "Native" }],
    skills: ["CRM", "EFB", "Upset recovery (UPRT)"],
  },
};

describe("flight experience", () => {
  it("breaks hours down by category", () => {
    expect(hours).toMatchObject({ totalMin: 2550 * 60, picMin: 700 * 60, picusMin: 300 * 60, copilotMin: 1500 * 60, multiPilotMin: 1800 * 60, jetMin: 1800 * 60, turbopropMin: 500 * 60, turbineMin: 2300 * 60, pistonMin: 250 * 60, multiEngineMin: 2300 * 60, fstdMin: 240, landings: 1605 });
    expect(hours.byType.map((t) => t.icao)).toEqual(["C68A", "BE20", "DR40"]);
    expect(hours.last90dMin).toBe(1800 * 60);
  });
});

describe("cv document", () => {
  const doc = buildCvDocument(cv);
  const text = cvToText(doc);
  it("uses standard section headings in a fixed order", () => {
    expect(doc.sections.map((s) => s.id)).toEqual(["contact", "summary", "hours", "types", "licences", "experience", "education", "languages", "skills"]);
    expect(text).toContain("FLIGHT EXPERIENCE");
    expect(text).toContain("Total flight time: 2,550 h");
    expect(text).toContain("Multi-pilot: 1,800 h");
  });
  it("spells out licences and names types with their ICAO code", () => {
    expect(expandLicence("ATPL(A)")).toBe("Airline Transport Pilot Licence (ATPL) (Aeroplane)");
    expect(text).toContain("Cessna Citation Latitude (C68A)");
    expect(text).toContain("Airline Transport Pilot Licence (ATPL)");
    expect(text).not.toContain("Passport");
    expect(text).toContain("English: ICAO level 6");
  });
  it("flags the target type and keywords missing from the CV", () => {
    const r = atsReport(cv, doc, text, "2026-11-14");
    expect(r.keywords.missing).toEqual(expect.arrayContaining(["Global Express", "GLEX"]));
    expect(r.checks.find((c) => c.code === "targetType")?.status).toBe("warn");
    expect(r.checks.find((c) => c.code === "medicalValid")?.status).toBe("ok");
    expect(r.score).toBeGreaterThan(80);
  });
  it("produces a text PDF with metadata and the JSON resume attached", async () => {
    const bytes = await buildCvPdf(doc, { jsonResume: toJsonResume(cv), lang: "en" });
    mkdirSync("test/out", { recursive: true });
    writeFileSync("test/out/cv-en.pdf", bytes);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getTitle()).toBe("Camille Martin - CV");
    expect(pdf.getKeywords()).toContain("C68A");
    expect(toJsonResume(cv).flightExperience).toMatchObject({ total: 2550, multiPilot: 1800, jet: 1800 });
    const fr = buildCvDocument({ ...cv, locale: "fr" });
    writeFileSync("test/out/cv-fr.pdf", await buildCvPdf(fr, { lang: "fr" }));
    expect(cvToText(fr)).toContain("EXPÉRIENCE DE VOL");
  });

  it("renders the six ICAO languages, Chinese and Arabic with their script font", async () => {
    const dir = "../../apps/web/public/fonts/cv";
    const f = (n: string) => new Uint8Array(readFileSync(`${dir}/${n}`));
    const inter = { regular: f("Inter-400.ttf"), semibold: f("Inter-600.ttf"), bold: f("Inter-700.ttf") };
    const script = (k: string) => ({ regular: f(`${k}-400.ttf`), semibold: f(`${k}-600.ttf`), bold: f(`${k}-700.ttf`) });
    for (const lang of ["es", "ru", "zh", "ar"] as const) {
      const doc = buildCvDocument({ ...cv, locale: lang });
      const fonts = { ...inter, script: lang === "zh" ? script("NotoSansSC") : lang === "ar" ? script("NotoSansArabic") : undefined };
      const bytes = await buildCvPdf(doc, { lang, fonts });
      writeFileSync(`test/out/cv-${lang}.pdf`, bytes);
      expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(0);
    }
  });
});

describe("type order", () => {
  it("puts the type flown in the last 12 months before older types with more hours", async () => {
    const { orderTypes } = await import("../src/document");
    const base = { category: "aeroplane", engineType: "jet", multiPilot: true, picMin: 0, copilotMin: 0 };
    const out = orderTypes(
      [
        { ...base, icao: "AT76", name: "ATR 72-600", totalMin: 19600, lastFlown: "2024-10-27" },
        { ...base, icao: "C68A", name: "Cessna Citation Latitude", totalMin: 14300, lastFlown: "2026-11-15" },
      ],
      undefined,
      "2026-11-18",
    );
    expect(out[0]!.icao).toBe("C68A");
  });
});

describe("offer keywords", () => {
  it("writes only the keywords the logbook and licences back up", async () => {
    const { targetKeywordsMet } = await import("../src/document");
    const data = {
      locale: "en",
      licences: [{ kind: "licence", code: "CPL(A)", authority: "DGAC France" }],
      hours: { jetMin: 600, turbineMin: 900, multiPilotMin: 900, picMin: 0, byType: [{ icao: "C68A", name: "Cessna Citation Latitude" }] },
      profile: { target: { keywords: ["ATPL", "EASA", "Jet", "PIC", "Citation Latitude"], aircraft: ["C68A", "GLEX"] } },
    } as never;
    expect(targetKeywordsMet(data)).toEqual(["EASA", "Jet", "Citation Latitude", "C68A"]);
  });
});


describe("one page", () => {
  it("fits a loaded CV on one page and keeps the full detail in the text version", async () => {
    const many: Record<string, TypeInfo> = {
      ...TYPES,
      A320: { icao: "A320", manufacturer: "Airbus", model: "A320", category: "airplane", engineType: "jet", multiPilot: true },
      E55P: { icao: "E55P", manufacturer: "Embraer", model: "Phenom 300", category: "airplane", engineType: "jet", multiPilot: false },
      PC12: { icao: "PC12", manufacturer: "Pilatus", model: "PC-12", category: "airplane", engineType: "turboprop", multiPilot: false },
      C172: { icao: "C172", manufacturer: "Cessna", model: "172 Skyhawk", category: "airplane", engineType: "piston", multiPilot: false },
    };
    const fl = [
      ...flights,
      base({ date: "2022-05-01", aircraftTypeIcao: "A320", totalMin: 3000 * 60, multiPilotMin: 3000 * 60, copilotMin: 3000 * 60, nightMin: 900 * 60, ifrMin: 3000 * 60, landingsDay: 1200 }),
      base({ date: "2020-05-01", aircraftTypeIcao: "E55P", totalMin: 600 * 60, singlePilotMeMin: 600 * 60, picMin: 600 * 60, function: "PIC", ifrMin: 500 * 60 }),
      base({ date: "2019-05-01", aircraftTypeIcao: "PC12", totalMin: 400 * 60, singlePilotSeMin: 400 * 60, picMin: 400 * 60, function: "PIC", instructorMin: 100 * 60 }),
      base({ date: "2018-05-01", aircraftTypeIcao: "C172", totalMin: 200 * 60, singlePilotSeMin: 200 * 60, dualMin: 100 * 60, picMin: 100 * 60, function: "PIC" }),
    ];
    const bullets = ["Line operations across Europe, North Africa and the Middle East in a two-pilot crew.", "Company safety reports and crew resource management trainer for new hires.", "Steep approach and short runway qualified (London City, Lugano, Samedan).", "Planned and flew long-range missions with tight slot and handling constraints."];
    const heavy: CvData = {
      ...cv,
      hours: flightExperience(fl, opening, (i) => many[i], "2026-11-14"),
      licences: [...cv.licences, { kind: "rating", code: "TR A320", validUntil: "2026-01-31" }, { kind: "rating", code: "MCC" }, { kind: "rating", code: "FI(A)", validUntil: "2027-09-30" }, { kind: "rating", code: "SEP(land)", validUntil: "2027-05-31" }, { kind: "rating", code: "MEP(land)", validUntil: "2027-05-31" }],
      profile: {
        ...cv.profile,
        nationality: "French",
        linkedin: "linkedin.com/in/example",
        summary: `${cv.profile.summary} ${cv.profile.summary}`,
        experience: [
          { role: "First Officer", employer: "Example Business Jets", start: "2023-03", aircraft: ["C68A"], bullets },
          { role: "First Officer", employer: "Example Airline", start: "2020-06", end: "2023-02", aircraft: ["A320"], bullets },
          { role: "Captain", employer: "Example Air Charter", start: "2019-01", end: "2020-05", aircraft: ["E55P", "PC12"], bullets },
          { role: "Flight Instructor", employer: "Example Aero Club", start: "2017-01", end: "2018-12", aircraft: ["C172"], bullets },
          { role: "Ramp agent", employer: "Example Handling", start: "2015-01", end: "2016-12", bullets },
        ],
        education: [
          { title: "ATPL integrated course", school: "Example Flight Academy", start: "2016-09", end: "2018-06", details: "Graduated first of class, MCC and JOC included." },
          { title: "Master in aeronautical engineering", school: "Example University", start: "2012-09", end: "2016-06", details: "Thesis on approach procedures." },
          { title: "Baccalauréat S", school: "Example High School", end: "2012-06" },
        ],
        languages: [{ name: "French", level: "Native" }, { name: "Spanish", level: "B2" }, { name: "German", level: "A2" }],
        skills: ["CRM", "EFB", "Upset recovery (UPRT)", "Safety management (SMS)", "Long-range navigation", "Steep approach", "Customer service", "Leadership"],
      },
    };
    const d = buildCvDocument(heavy);
    const bytes = await buildCvPdf(d, { lang: "en" });
    writeFileSync("test/out/cv-heavy.pdf", bytes);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    // the text version (and the JSON Resume) keep everything
    expect(cvToText(d)).toContain("Ramp agent");
    expect(cvToText(d)).toContain("Landings");
  });
});
