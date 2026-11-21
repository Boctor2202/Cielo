import { describe, expect, it } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import type { Flight } from "@cielo/core";
import { buildLogbookPdf, flightsToCsv } from "../src";

const base = (i: number): Flight => ({
  id: `f${i}`, createdAt: "", updatedAt: "", pilotId: "p", date: `2026-10-${String((i % 28) + 1).padStart(2, "0")}`,
  source: "manual", depIcao: "LFPG", arrIcao: "LFMN", outUtc: `2026-10-${String((i % 28) + 1).padStart(2, "0")}T0${i % 9}:00:00.000Z`,
  inUtc: `2026-10-${String((i % 28) + 1).padStart(2, "0")}T1${i % 9}:35:00.000Z`, registration: "F-HBXA", aircraftTypeIcao: "A320", aircraftModel: "Airbus A320-214",
  totalMin: 95, airMin: 80, singlePilotSeMin: 0, singlePilotMeMin: 0, multiPilotMin: 95, function: i % 3 ? "SIC" : "PICUS", picName: "Dupont Élodie",
  picMin: 0, picusMin: i % 3 ? 0 : 95, copilotMin: i % 3 ? 95 : 0, dualMin: 0, instructorMin: 0, examinerMin: 0, nightMin: 20, ifrMin: 95,
  actualImcMin: 0, xcMin: 0, nightCalc: "auto", takeoffsDay: 1, takeoffsNight: 0, landingsDay: 1, landingsNight: 0, pilotFlying: true,
  approaches: [{ type: "ILS", count: 1 }], isFstd: i === 5, fstdType: i === 5 ? "A320 FFS" : undefined, fstdMin: i === 5 ? 240 : 0, crew: [], remarks: i === 2 ? "Line check — très bien ✈" : undefined, locked: false,
  ...(i % 4 === 0 ? { simInstrumentMin: 30, holdings: 1, soloMin: 0, groundTrainingMin: 60, safetyPilotName: "J. Smith", via: ["LFLY"] } : {}),
});

describe("pdf export", () => {
  it("renders every layout with page totals", async () => {
    const flights = Array.from({ length: 40 }, (_, i) => base(i));
    mkdirSync("test/out", { recursive: true });
    for (const layout of ["EASA", "UK", "FAA", "CASA", "TCCA", "SACAA", "HKCAD"] as const) {
      const bytes = await buildLogbookPdf(flights, { layout, pilotName: "Camille Martin", licenceNumber: "FRA.FCL.PA.12345", periodLabel: "2026" });
      const doc = await PDFDocument.load(bytes);
      expect(doc.getPageCount()).toBe(1 + Math.ceil(40 / 20));
      writeFileSync(`test/out/${layout}.pdf`, bytes);
    }
  });
  it("shows signatures and the holder's certification", async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 150" width="320" height="150"><rect width="100%" height="100%" fill="#ffffff"/><path d="M20,100 C40,30 60,30 55,90 S80,120 100,60 C110,40 130,40 125,80 C120,110 150,100 165,60 L180,40 C175,80 185,110 210,95 C240,80 260,60 300,55" stroke="#0a1626" stroke-width="2.2" fill="none"/></svg>`;
    const image = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
    const flights = Array.from({ length: 12 }, (_, i) => ({ ...base(i), signatureId: i % 2 ? `s${i}` : undefined }));
    const signatures = Object.fromEntries(
      flights.filter((f) => f.signatureId).map((f, k) => [f.id, { signerName: "Élodie Dupont", signerRole: "captain" as const, signerLicenceNumber: "FRA.FCL.PA.99999", signedAt: "2026-10-30T18:42:00.000Z", imageDataUrl: image, valid: k !== 2 }]),
    );
    const bytes = await buildLogbookPdf(flights, { layout: "EASA", pilotName: "Camille Martin", licenceNumber: "FRA.FCL.PA.12345", signatures, holderSignature: { image, date: "21/11/2026" } });
    const doc = await PDFDocument.load(bytes);
    // cover, one page of entries, one page of signatures
    expect(doc.getPageCount()).toBe(3);
    writeFileSync("test/out/EASA-signed.pdf", bytes);
    const csv = flightsToCsv(flights, { signatures });
    expect(csv).toContain("Élodie Dupont,CPT,FRA.FCL.PA.99999,2026-10-30 18:42,Y");
    expect(csv).toContain("N (entry changed after signing)");
  });
  it("exports csv", () => {
    const csv = flightsToCsv([base(1)]);
    expect(csv.split("\r\n")[1]).toContain("LFPG,LFMN");
  });
});
