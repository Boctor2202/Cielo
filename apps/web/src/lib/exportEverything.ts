"use client";

import { frameworkOf, openingTotals, type Flight, type OpeningBalance, type Pilot } from "@cielo/core";
import { buildLogbookPdf, flightsToCsv, layoutForAuthority } from "@cielo/export";
import { downloadBlob } from "./download";
import { exportAll } from "./repo";
import { track } from "./metrics";

/**
 * « Export my whole logbook »: the PDF in the pilot's authority format (all time, paper totals carried forward),
 * the CSV of every flight and the full JSON of the account's data. Works with or without a subscription.
 */
export async function exportEverything(flights: Flight[], balances: OpeningBalance[], pilot: Pilot | undefined) {
  const stamp = new Date().toISOString().slice(0, 10);
  const name = `geardown-logbook-${stamp}`;
  const live = flights.filter((f) => !f.deletedAt);
  const layout = pilot ? layoutForAuthority(pilot.authority, frameworkOf(pilot)) : "EASA";
  const pdf = await buildLogbookPdf(live, {
    layout,
    pilotName: pilot?.fullName || "—",
    licenceNumber: pilot?.licenceNumber,
    periodLabel: "All time",
    opening: openingTotals(balances.filter((b) => !b.deletedAt)),
    locale: pilot?.locale ?? "fr",
  });
  downloadBlob(pdf as BlobPart, `${name}-${layout}.pdf`, "application/pdf");
  downloadBlob(flightsToCsv(live, { decimal: false }), `${name}.csv`, "text/csv;charset=utf-8");
  downloadBlob(JSON.stringify(await exportAll(), null, 2), `geardown-export-${stamp}.json`, "application/json");
  track("export");
}
