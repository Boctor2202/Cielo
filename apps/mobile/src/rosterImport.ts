/**
 * Roster import from a file (iCal .ics or CSV), with the same parsers and rules as the web roster page
 * (@cielo/core): one Roster record for the file, then its events. iCal events already known (same UID)
 * are updated in place, keeping their id and the logged flight; CSV rows already in the roster are skipped.
 * A PDF roster (Leon, AIMS, Netline… export only that) is read on the server (/api/roster-pdf) and comes back
 * as structured duties, converted here to UTC with the airports' time zones when the document is in local time;
 * a new print of a roster replaces the days it covers (mergeRosterImport: logged flights stay linked, options marked).
 */
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import {
  combineUtc,
  detectMapping,
  icalToRosterEvent,
  mergeRosterImport,
  parseCsv,
  printedDutiesToEvents,
  parseFlexibleDate,
  parseIcal,
  stamp,
  type Pilot,
  type PrintedDuty,
  type Roster,
  type RosterEvent,
} from "@cielo/core";
import { airports, lookupAirport, toIcao } from "./airports";
import { API_URL } from "./api";
import type { SqliteStore } from "./db/sqliteStore";

export interface RosterImportResult {
  imported: number;
  updated: number;
  duplicates: number;
  skipped: number;
  /** PDF re-import: duties gone from the new print, and duties linked to flights already logged */
  removed?: number;
  linked?: number;
}

/** what makes two roster events the same duty */
const sameKey = (e: Pick<RosterEvent, "kind" | "startUtc" | "endUtc" | "depIcao" | "arrIcao" | "flightNumber">) =>
  [e.kind, e.startUtc, e.endUtc, e.depIcao ?? "", e.arrIcao ?? "", e.flightNumber ?? ""].join("|");

/** fields compared to tell an unchanged iCal event from an updated one */
const content = (e: Partial<RosterEvent>) =>
  JSON.stringify([e.kind, e.title, e.startUtc, e.endUtc, e.depIcao, e.arrIcao, e.flightNumber]);

export class RosterPdfError extends Error {}


/** Sends a PDF roster to the server reader; returns its duties. */
async function readPdfRoster(uri: string, token: string | undefined): Promise<{ timeBasis: "UTC" | "local"; events: PrintedDuty[] }> {
  if (!token) throw new RosterPdfError("signin");
  const pdf = await new File(uri).base64();
  if (pdf.length > 4_000_000) throw new RosterPdfError("too_big");
  const r = await fetch(`${API_URL}/api/roster-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ pdf, today: new Date().toISOString().slice(0, 10) }),
  });
  const d = (await r.json().catch(() => ({}))) as { timeBasis?: "UTC" | "local"; events?: PrintedDuty[]; error?: string };
  if (!r.ok || !d.events) throw new RosterPdfError(d.error ?? "upstream");
  return { timeBasis: d.timeBasis ?? "local", events: d.events };
}

export async function pickAndImportRoster(store: SqliteStore, pilot: Pilot, existing: RosterEvent[], token?: string): Promise<RosterImportResult | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ["text/calendar", "text/x-vcalendar", "text/csv", "text/comma-separated-values", "text/plain", "application/vnd.ms-excel", "application/pdf", "*/*"],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];

  if (/\.pdf$/i.test(asset.name ?? "") || asset.mimeType === "application/pdf") {
    const read = await readPdfRoster(asset.uri, token);
    const now = new Date().toISOString();
    const roster: Roster = stamp({ pilotId: pilot.id, source: "manual", fileName: asset.name || undefined, importedAt: now } as Roster, now);
    const home = pilot.homeBaseIcao ? lookupAirport(pilot.homeBaseIcao)?.timezone : undefined;
    const incoming = printedDutiesToEvents(read.events as PrintedDuty[], read.timeBasis, {
      pilotId: pilot.id,
      rosterId: roster.id,
      toIcao: (c) => (c.length === 3 ? airports().iataToIcao(c) ?? c : toIcao(c) || c),
      timezoneOf: (icao) => lookupAirport(icao)?.timezone,
      homeTimezone: home,
    });
    // the new print replaces the days it covers: same duties updated in place (logged flights stay linked)
    const m = mergeRosterImport(existing, incoming, await store.all("flights"), now);
    const result: RosterImportResult = { imported: m.added, updated: m.updated, duplicates: m.unchanged, skipped: read.events.length - incoming.length, removed: m.removed, linked: m.linked };
    if (!m.put.length) return result;
    const days = incoming.map((e) => e.startUtc.slice(0, 10)).sort();
    await store.bulkPut("rosters", [{ ...roster, periodStart: days[0], periodEnd: days[days.length - 1] }]);
    await store.bulkPut("roster_events", m.put);
    return result;
  }

  const text = (await new File(asset.uri).text()).replace(/^\ufeff/, "");
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
