import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { SYNC_TABLES, frameworkOf, isoDate, openingTotals, type LocalStore, type OpeningBalance, type Flight, type Pilot, type SignedInfo } from "@cielo/core";
import { TABULAR_HEADERS, buildLogbookPdf, layoutForAuthority, buildXlsx, flightsToCsv, flightsToRows, type LayoutId } from "@cielo/export";

export async function shareFile(name: string, content: string | Uint8Array, mimeType: string, UTI: string): Promise<void> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, UTI, dialogTitle: name });
  } else {
    throw new Error(`Sharing unavailable — file saved to ${file.uri}`);
  }
}

const slug = (s: string) => s.normalize("NFD").replace(/[^\w-]+/g, "_").replace(/_+/g, "_").slice(0, 40) || "pilot";

/** Paper-logbook layout PDF (EASA / FAA / CASA) produced by @cielo/export. */
/** What an export carries of the signatures: the flights' ones, and the holder's certification of the logbook. */
export interface ExportSigning {
  signatures?: Record<string, SignedInfo>;
  /** sign the logbook with the saved signature (each page's certification) */
  holderSigns?: boolean;
}

const today = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

export async function exportLogbookPdf(flights: Flight[], balances: OpeningBalance[], pilot: Pilot, signing: ExportSigning = {}): Promise<void> {
  // the layout of the pilot's authority (UK CAA, Transport Canada, SACAA, Hong Kong CAD have their own)
  const layout: LayoutId = layoutForAuthority(pilot.authority, frameworkOf(pilot));
  const bytes = await buildLogbookPdf(flights, {
    layout,
    pilotName: pilot.fullName || pilot.email || "Pilot",
    licenceNumber: pilot.licenceNumber,
    opening: openingTotals(balances),
    locale: pilot.locale,
    appName: "Geardown",
    generatedAt: new Date(),
    holderDetails: layout === "HKCAD" && pilot.employer ? [["Employer", pilot.employer]] : undefined,
    signatures: signing.signatures,
    holderSignature: signing.holderSigns && pilot.signatureDataUrl ? { image: pilot.signatureDataUrl, date: today() } : undefined,
  });
  await shareFile(`geardown-logbook-${layout}-${slug(pilot.fullName)}-${isoDate(Date.now())}.pdf`, bytes, "application/pdf", "com.adobe.pdf");
}

/** The whole logbook as an Excel workbook (same columns as the CSV and the website export). */
export async function exportLogbookXlsx(flights: Flight[], pilot: Pilot, signing: ExportSigning = {}): Promise<void> {
  const rows = flightsToRows(flights, { decimal: pilot.timeDisplay === "decimal", signatures: signing.signatures });
  const bytes = buildXlsx([{ name: "Logbook", header: true, rows: [[...TABULAR_HEADERS], ...rows] }]);
  await shareFile(`geardown-logbook-${isoDate(Date.now())}.xlsx`, bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "org.openxmlformats.spreadsheetml.sheet");
}

export async function exportLogbookCsv(flights: Flight[], pilot: Pilot, signing: ExportSigning = {}): Promise<void> {
  const csv = flightsToCsv(flights, { decimal: pilot.timeDisplay === "decimal", signatures: signing.signatures });
  await shareFile(`geardown-logbook-${isoDate(Date.now())}.csv`, "﻿" + csv, "text/csv", "public.comma-separated-values-text");
}

/** GDPR art. 15/20: every table of the local store, as JSON. */
export async function exportAllDataJson(store: LocalStore): Promise<void> {
  const tables: Record<string, unknown[]> = {};
  for (const t of SYNC_TABLES) tables[t] = await store.all(t);
  // Reference aircraft types are public data, not personal data.
  tables.aircraft_types = (tables.aircraft_types as { ownerPilotId?: string | null }[]).filter((r) => r.ownerPilotId);
  const payload = { app: "Geardown", format: "geardown-export", version: 1, exportedAt: new Date().toISOString(), tables };
  await shareFile(`geardown-data-${isoDate(Date.now())}.json`, JSON.stringify(payload, null, 2), "application/json", "public.json");
}
