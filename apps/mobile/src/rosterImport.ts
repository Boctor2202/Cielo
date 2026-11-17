/**
 * Roster import from a file (iCal .ics or CSV), with the same parsers and rules as the web roster page
 * (@cielo/core): one Roster record for the file, then its events. iCal events already known (same UID)
 * are updated in place, keeping their id and the logged flight; CSV rows already in the roster are skipped.
 */
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import {
  combineUtc,
  detectMapping,
  icalToRosterEvent,
  parseCsv,
  parseFlexibleDate,
  parseIcal,
  stamp,
  type Pilot,
  type Roster,
  type RosterEvent,
} from "@cielo/core";
import { airports, toIcao } from "./airports";
import type { SqliteStore } from "./db/sqliteStore";

export interface RosterImportResult {
  imported: number;
  updated: number;
  duplicates: number;
  skipped: number;
}

/** what makes two roster events the same duty */
const sameKey = (e: Pick<RosterEvent, "kind" | "startUtc" | "endUtc" | "depIcao" | "arrIcao" | "flightNumber">) =>
  [e.kind, e.startUtc, e.endUtc, e.depIcao ?? "", e.arrIcao ?? "", e.flightNumber ?? ""].join("|");

/** fields compared to tell an unchanged iCal event from an updated one */
const content = (e: Partial<RosterEvent>) =>
  JSON.stringify([e.kind, e.title, e.startUtc, e.endUtc, e.depIcao, e.arrIcao, e.flightNumber]);

export async function pickAndImportRoster(store: SqliteStore, pilot: Pilot, existing: RosterEvent[]): Promise<RosterImportResult | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ["text/calendar", "text/x-vcalendar", "text/csv", "text/comma-separated-values", "text/plain", "application/vnd.ms-excel", "*/*"],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  const text = (await new File(asset.uri).text()).replace(/^﻿/, "");
  const ical = /\.ics$/i.test(asset.name ?? "") || text.includes("BEGIN:VCALENDAR");

  const now = new Date().toISOString();
  const roster: Roster = stamp({ pilotId: pilot.id, source: ical ? "ical" : "csv", fileName: asset.name || undefined, importedAt: now } as Roster, now);
  const alive = existing.filter((e) => !e.deletedAt);
  const seen = new Set(alive.map(sameKey));
  const out: RosterEvent[] = [];
  const result: RosterImportResult = { imported: 0, updated: 0, duplicates: 0, skipped: 0 };

  if (ical) {
    const byUid = new Map(alive.filter((e) => e.externalUid).map((e) => [e.externalUid!, e]));
    for (const ev of parseIcal(text)) {
      if (!ev.startUtc || !ev.endUtc) {
        result.skipped++;
        continue;
      }
      const r = icalToRosterEvent(ev, pilot.id, (iata) => airports().iataToIcao(iata) ?? undefined);
      const prev = r.externalUid ? byUid.get(r.externalUid) : undefined;
      if (prev) {
        // same event as an earlier import: unchanged → duplicate, changed → updated in place
        if (content(prev) === content(r)) {
          result.duplicates++;
          continue;
        }
        out.push(stamp({ ...prev, ...r, id: prev.id, rosterId: roster.id, flightId: prev.flightId ?? null } as RosterEvent, now));
        result.updated++;
        continue;
      }
      if (seen.has(sameKey(r))) {
        result.duplicates++;
        continue;
      }
      seen.add(sameKey(r));
      out.push(stamp({ ...r, rosterId: roster.id, flightId: null } as RosterEvent, now));
      result.imported++;
    }
  } else {
    const table = parseCsv(text);
    const map = detectMapping(table[0] ?? []);
    for (const row of table.slice(1)) {
      if (row.every((x) => !x.trim())) continue;
      const g = (k: keyof typeof map) => (map[k] >= 0 ? (row[map[k]] ?? "").trim() : "");
      const date = parseFlexibleDate(g("date"));
      const start = date ? combineUtc(date, g("out") || "00:00") : null;
      const end = date && start ? combineUtc(date, g("in") || "23:59", start) : null;
      if (!start || !end) {
        result.skipped++;
        continue;
      }
      const dep = g("dep") ? toIcao(g("dep")) : "";
      const arr = g("arr") ? toIcao(g("arr")) : "";
      const e = stamp(
        {
          pilotId: pilot.id,
          rosterId: roster.id,
          kind: dep && arr ? "FLIGHT" : "OTHER",
          title: [g("flightNumber"), dep && arr ? `${dep}-${arr}` : g("remarks")].filter(Boolean).join(" ") || undefined,
          startUtc: start,
          endUtc: end,
          flightNumber: g("flightNumber") || undefined,
          depIcao: dep || undefined,
          arrIcao: arr || undefined,
          aircraftReg: g("registration") || undefined,
          aircraftTypeIcao: g("type") || undefined,
          flightId: null,
        } as RosterEvent,
        now,
      );
      if (seen.has(sameKey(e))) {
        result.duplicates++;
        continue;
      }
      seen.add(sameKey(e));
      out.push(e);
      result.imported++;
    }
  }

  if (!out.length) return result;
  const days = out.map((e) => e.startUtc.slice(0, 10)).sort();
  await store.bulkPut("rosters", [{ ...roster, periodStart: days[0], periodEnd: days[days.length - 1] }]);
  await store.bulkPut("roster_events", out);
  return result;
}
