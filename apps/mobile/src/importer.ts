/**
 * CSV / text import of past flights (same parser and column detection as the web app: @cielo/core).
 * Picks a file, maps the columns, derives every time with deriveFlightTimes and stores the flights at once.
 */
import { announceGains } from "./gains";
import { airlines } from "./airlines";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import {
  deriveFlightTimes,
  operatorIndex,
  analyseTable,
  newId,
  parseCsv,
  rowsToFlights,
  type AircraftType,
  type Flight,
  type Pilot,
  flightRevision,
  stamp,
  type FlightRevision,
  type ImportedRow,
  type SyncedRecord,
} from "@cielo/core";
import { lookupAirport, toIcao } from "./airports";
import type { SqliteStore } from "./db/sqliteStore";

export interface ImportResult {
  imported: number;
  skipped: number;
  duplicates: number;
  /** ids of the flights saved, to undo this import as a whole */
  ids: string[];
}

/** The flights an import would save (not stored yet), for « Check your totals ». */
export interface PreparedImport {
  pairs: { rowIndex: number; flight: Flight }[];
  duplicates: number[];
  skipped: number;
}

export async function pickAndImportCsv(store: SqliteStore, pilot: Pilot, types: AircraftType[], existing: Flight[]): Promise<ImportResult | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "text/comma-separated-values", "text/plain", "application/vnd.ms-excel", "*/*"], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.[0]) return null;
  const text = await new File(res.assets[0].uri).text();
  const table = parseCsv(text.replace(/^﻿/, ""));
  if (table.length < 2) throw new Error("empty");
  // header row, two-row headers, columns (names + values) and date order detected automatically
  const a = analyseTable(table);
  const parsed = rowsToFlights(a.rows, a.mapping, { dateOrder: a.dateOrder, defaultFunction: pilot.defaultFunction });
  return saveImportedRows(store, pilot, types, existing, parsed, "import");
}

/** Stores reviewed import rows as flights (times derived, the file's totals kept, duplicates skipped). */
export async function saveImportedRows(store: SqliteStore, pilot: Pilot, types: AircraftType[], existing: Flight[], parsed: ImportedRow[], source: Flight["source"]): Promise<ImportResult> {
  return savePrepared(store, await prepareImportedRows(store, pilot, types, existing, parsed, source));
}

/** Saves what prepareImportedRows built (after the pilot checked the totals). */
export async function savePrepared(store: SqliteStore, p: PreparedImport): Promise<ImportResult> {
  const out = p.pairs.map((x) => x.flight);
  if (out.length) {
    await store.bulkPut("flights", out);
    // one "created by import" entry each in the audit trail
    await store.bulkPut("flight_revisions", out.map((f) => stamp({ ...flightRevision(undefined, f, "import")! } as Partial<SyncedRecord>) as unknown as FlightRevision));
    announceGains(out.map((f) => f.id));
  }
  return { imported: out.length, skipped: p.skipped, duplicates: p.duplicates.length, ids: out.map((f) => f.id) };
}

/** Builds the flights of reviewed rows as they would be saved, without storing them. */
export async function prepareImportedRows(store: SqliteStore, pilot: Pilot, types: AircraftType[], existing: Flight[], parsed: ImportedRow[], source: Flight["source"]): Promise<PreparedImport> {
  const now = new Date().toISOString();
  const key = (f: Pick<Flight, "date" | "depIcao" | "arrIcao" | "outUtc" | "totalMin">) => `${f.date}|${f.depIcao}|${f.arrIcao}|${f.outUtc ?? ""}|${f.totalMin}`;
  const seen = new Set(existing.map(key));
  // the operator of each imported flight, as the logbook recognises it (call sign, aircraft, what it learned)
  const ops = operatorIndex(existing, await store.all("aircraft"), airlines());
  const pairs: PreparedImport["pairs"] = [];
  const dups: number[] = [];
  let skipped = 0;
  for (const r of parsed) {
    if (!r.input || r.errors.length) {
      skipped++;
      continue;
    }
    const input = { ...r.input, depIcao: toIcao(r.input.depIcao), arrIcao: toIcao(r.input.arrIcao) };
    const type = input.aircraftTypeIcao ? types.find((t) => t.icao.toUpperCase() === input.aircraftTypeIcao!.toUpperCase()) : undefined;
    const d = deriveFlightTimes(input, { airports: lookupAirport, aircraftType: type });
    const ex = r.explicit;
    if (ex.total !== undefined && d.totalMin === 0 && !input.isFstd) {
      d.totalMin = d.airMin = ex.total;
      const mp = ex.multiPilot !== undefined ? ex.multiPilot > 0 : !!type?.multiPilot;
      d.multiPilotMin = mp ? ex.total : 0;
      d.singlePilotSeMin = !mp && (type?.engineCount ?? 1) <= 1 ? ex.total : 0;
      d.singlePilotMeMin = !mp && (type?.engineCount ?? 1) > 1 ? ex.total : 0;
      d.picMin = input.function === "PIC" ? ex.total : 0;
      d.picusMin = input.function === "PICUS" ? ex.total : 0;
      d.copilotMin = input.function === "SIC" ? ex.total : 0;
      d.dualMin = input.function === "DUAL" ? ex.total : 0;
      d.instructorMin = input.function === "FI" ? ex.total : 0;
      d.examinerMin = input.function === "FE" ? ex.total : 0;
      if (input.ifr && ex.ifr === undefined) d.ifrMin = ex.total;
    }
    if (ex.night !== undefined) d.nightMin = Math.min(ex.night, d.totalMin);
    if (ex.ifr !== undefined) d.ifrMin = Math.min(ex.ifr, d.totalMin);
    if (ex.pic !== undefined) d.picMin = Math.min(ex.pic, d.totalMin);
    if (ex.copilot !== undefined) d.copilotMin = Math.min(ex.copilot, d.totalMin);
    if (ex.dual !== undefined) d.dualMin = Math.min(ex.dual, d.totalMin);
    if (ex.instructor !== undefined) d.instructorMin = Math.min(ex.instructor, d.totalMin);
    if (ex.picus !== undefined) d.picusMin = Math.min(ex.picus, d.totalMin);
    const f: Flight = {
      id: newId(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      pilotId: pilot.id,
      date: input.date,
      flightNumber: input.flightNumber || undefined,
      source,
      rosterEventId: null,
      depIcao: input.depIcao,
      arrIcao: input.arrIcao,
      outUtc: d.outUtc,
      offUtc: d.offUtc,
      onUtc: d.onUtc,
      inUtc: d.inUtc,
      aircraftId: null,
      registration: input.registration?.toUpperCase(),
      aircraftTypeIcao: type?.icao ?? input.aircraftTypeIcao,
      aircraftModel: type ? `${type.manufacturer} ${type.model}` : input.aircraftModel,
      totalMin: d.totalMin,
      airMin: d.airMin,
      singlePilotSeMin: d.singlePilotSeMin,
      singlePilotMeMin: d.singlePilotMeMin,
      multiPilotMin: d.multiPilotMin,
      function: input.function,
      picName: input.picName || undefined,
      picMin: d.picMin,
      picusMin: d.picusMin,
      copilotMin: d.copilotMin,
      dualMin: d.dualMin,
      instructorMin: d.instructorMin,
      examinerMin: d.examinerMin,
      nightMin: d.nightMin,
      ifrMin: d.ifrMin,
      actualImcMin: 0,
      xcMin: 0,
      nightCalc: ex.night !== undefined ? "manual" : d.nightCalc,
      takeoffsDay: d.takeoffsDay,
      takeoffsNight: d.takeoffsNight,
      landingsDay: d.landingsDay,
      landingsNight: d.landingsNight,
      pilotFlying: input.pilotFlying,
      approaches: [],
      isFstd: input.isFstd,
      fstdType: input.isFstd ? input.fstdType : undefined,
      fstdMin: input.isFstd ? (input.fstdMin ?? 0) : 0,
      crew: [],
      remarks: input.remarks || undefined,
      signatureId: null,
      locked: false,
    };
    if (!f.operator && !f.isFstd) f.operator = ops.of(f);
    if (seen.has(key(f))) {
      dups.push(r.rowIndex);
      continue;
    }
    seen.add(key(f));
    pairs.push({ rowIndex: r.rowIndex, flight: f });
  }
  return { pairs, duplicates: dups, skipped };
}
