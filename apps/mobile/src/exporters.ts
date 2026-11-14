import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { SYNC_TABLES, isoDate, openingTotals, type LocalStore, type OpeningBalance, type Flight, type Pilot } from "@cielo/core";
import { buildLogbookPdf, flightsToCsv, type LayoutId } from "@cielo/export";

async function shareFile(name: string, content: string | Uint8Array, mimeType: string, UTI: string): Promise<void> {
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
export async function exportLogbookPdf(flights: Flight[], balances: OpeningBalance[], pilot: Pilot): Promise<void> {
  const layout: LayoutId = pilot.regulatoryFramework;
  const bytes = await buildLogbookPdf(flights, {
    layout,
    pilotName: pilot.fullName || pilot.email || "Pilot",
    licenceNumber: pilot.licenceNumber,
    opening: openingTotals(balances),
    locale: pilot.locale,
    appName: "Strato",
    generatedAt: new Date(),
  });
  await shareFile(`cielo-logbook-${layout}-${slug(pilot.fullName)}-${isoDate(Date.now())}.pdf`, bytes, "application/pdf", "com.adobe.pdf");
}

export async function exportLogbookCsv(flights: Flight[], pilot: Pilot): Promise<void> {
  const csv = flightsToCsv(flights, { decimal: pilot.timeDisplay === "decimal" });
  await shareFile(`cielo-logbook-${isoDate(Date.now())}.csv`, "﻿" + csv, "text/csv", "public.comma-separated-values-text");
}

/** GDPR art. 15/20: every table of the local store, as JSON. */
export async function exportAllDataJson(store: LocalStore): Promise<void> {
  const tables: Record<string, unknown[]> = {};
  for (const t of SYNC_TABLES) tables[t] = await store.all(t);
  // Reference aircraft types are public data, not personal data.
  tables.aircraft_types = (tables.aircraft_types as { ownerPilotId?: string | null }[]).filter((r) => r.ownerPilotId);
  const payload = { app: "Strato", format: "cielo-export", version: 1, exportedAt: new Date().toISOString(), tables };
  await shareFile(`cielo-data-${isoDate(Date.now())}.json`, JSON.stringify(payload, null, 2), "application/json", "public.json");
}
