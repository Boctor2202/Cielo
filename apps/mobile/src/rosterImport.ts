/**
 * Roster import from a file (iCal .ics or CSV), with the same parsers and rules as the web roster page
 * (@cielo/core): one Roster record for the file, then its events. iCal events already known (same UID)
 * are updated in place, keeping their id and the logged flight; CSV rows already in the roster are skipped.
 * A PDF roster (Leon, AIMS, Netline… export only that) is read on the server (/api/roster-pdf) and comes back
 * as structured duties, converted here to UTC with the airports' time zones when the document is in local time.
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
  tzOffsetMs,
  type Pilot,
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
}

/** what makes two roster events the same duty */
const sameKey = (e: Pick<RosterEvent, "kind" | "startUtc" | "endUtc" | "depIcao" | "arrIcao" | "flightNumber">) =>
  [e.kind, e.startUtc, e.endUtc, e.depIcao ?? "", e.arrIcao ?? "", e.flightNumber ?? ""].join("|");

/** fields compared to tell an unchanged iCal event from an updated one */
const content = (e: Partial<RosterEvent>) =>
  JSON.stringify([e.kind, e.title, e.startUtc, e.endUtc, e.depIcao, e.arrIcao, e.flightNumber]);

export class RosterPdfError extends Error {}

interface PdfEvent {
  kind: RosterEvent["kind"];
  date: string;
  report: string | null;
  start: string | null;
  end: string | null;
  endDayOffset: number;
  flightNumber: string | null;
  dep: string | null;
  arr: string | null;
  aircraftReg: string | null;
  aircraftType: string | null;
  title: string | null;
}

const addDaysIso = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** A wall-clock time on a day, in a zone (or UTC), as an ISO instant. */
function instant(date: string, time: string, tz: string | null): string {
  const [h, m] = time.split(":").map(Number) as [number, number];
  const [y, mo, d] = date.split("-").map(Number) as [number, number, number];
  const wall = Date.UTC(y, mo - 1, d, h, m);
  return new Date(tz ? wall - tzOffsetMs(tz, wall) : wall).toISOString();
}

/** PDF duties (as printed) → roster events in UTC. */
function pdfToEvents(list: PdfEvent[], basis: "UTC" | "local", pilot: Pilot, rosterId: string, now: string): RosterEvent[] {
  const code = (c: string | null) => {
    const x = (c ?? "").trim().toUpperCase();
    if (!x) return "";
    if (x.length === 3) return airports().iataToIcao(x) ?? x;
    return toIcao(x) || x;
  };
  const home = pilot.homeBaseIcao ? lookupAirport(pilot.homeBaseIcao)?.timezone ?? null : null;
  const out: RosterEvent[] = [];
  for (const e of list) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) continue;
    const dep = code(e.dep);
    const arr = code(e.arr);
    const tzOf = (icao: string) => (basis === "UTC" ? null : (icao ? lookupAirport(icao)?.timezone : null) ?? home);
    const startTz = tzOf(dep);
    const endTz = tzOf(arr || dep);
    const allDay = !e.start && !e.end;
    const startUtc = instant(e.date, e.start ?? "00:00", allDay ? home : startTz);
    let endUtc = instant(addDaysIso(e.date, e.endDayOffset || 0), e.end ?? "23:59", allDay ? home : endTz);
    // an end printed before the start without a day offset: it is the next day
    if (endUtc <= startUtc) endUtc = new Date(Date.parse(endUtc) + 86_400_000).toISOString();
    let reportUtc: string | null = null;
    if (e.report) {
      reportUtc = instant(e.date, e.report, startTz);
      if (reportUtc > startUtc) reportUtc = new Date(Date.parse(reportUtc) - 86_400_000).toISOString();
    }
    out.push(
      stamp(
        {
          pilotId: pilot.id,
          rosterId,
          kind: e.kind,
          title: e.title || [e.flightNumber, dep && arr ? `${dep}-${arr}` : ""].filter(Boolean).join(" ") || undefined,
          reportUtc,
          startUtc,
          endUtc,
          flightNumber: e.flightNumber || undefined,
          depIcao: dep || undefined,
          arrIcao: arr || undefined,
          aircraftReg: e.aircraftReg?.toUpperCase() || undefined,
          aircraftTypeIcao: e.aircraftType?.toUpperCase() || undefined,
          flightId: null,
        } as RosterEvent,
        now,
      ),
    );
  }
  return out;
}

/** Sends a PDF roster to the server reader; returns its duties. */
async function readPdfRoster(uri: string, token: string | undefined): Promise<{ timeBasis: "UTC" | "local"; events: PdfEvent[] }> {
  if (!token) throw new RosterPdfError("signin");
  const pdf = await new File(uri).base64();
  if (pdf.length > 4_000_000) throw new RosterPdfError("too_big");
  const r = await fetch(`${API_URL}/api/roster-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ pdf, today: new Date().toISOString().slice(0, 10) }),
  });
  const d = (await r.json().catch(() => ({}))) as { timeBasis?: "UTC" | "local"; events?: PdfEvent[]; error?: string };
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
    const seen = new Set(existing.filter((e) => !e.deletedAt).map(sameKey));
    const result: RosterImportResult = { imported: 0, updated: 0, duplicates: 0, skipped: 0 };
    const out: RosterEvent[] = [];
    for (const e of pdfToEvents(read.events, read.timeBasis, pilot, roster.id, now)) {
      if (seen.has(sameKey(e))) {
        result.duplicates++;
        continue;
      }
      seen.add(sameKey(e));
      out.push(e);
      result.imported++;
    }
    result.skipped = read.events.length - result.imported - result.duplicates;
    if (!out.length) return result;
    const days = out.map((e) => e.startUtc.slice(0, 10)).sort();
    await store.bulkPut("rosters", [{ ...roster, periodStart: days[0], periodEnd: days[days.length - 1] }]);
    await store.bulkPut("roster_events", out);
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
