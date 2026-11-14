/**
 * CSV / text import of past flights (same parser and column detection as the web app: @cielo/core).
 * Picks a file, maps the columns, derives every time with deriveFlightTimes and stores the flights at once.
 */
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import {
  deriveFlightTimes,
  detectMapping,
  newId,
  parseCsv,
  rowsToFlights,
  type AircraftType,
  type Flight,
  type Pilot,
} from "@cielo/core";
import { lookupAirport } from "./airports";
import type { SqliteStore } from "./db/sqliteStore";

export interface ImportResult {
  imported: number;
  skipped: number;
  duplicates: number;
}

export async function pickAndImportCsv(store: SqliteStore, pilot: Pilot, types: AircraftType[], existing: Flight[]): Promise<ImportResult | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "text/comma-separated-values", "text/plain", "application/vnd.ms-excel", "*/*"], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.[0]) return null;
  const text = await new File(res.assets[0].uri).text();
  const table = parseCsv(text.replace(/^﻿/, ""));
  if (table.length < 2) throw new Error("empty");
  const [header, ...rows] = table;
  const mapping = detectMapping(header!);
  const parsed = rowsToFlights(rows.filter((r) => r.some((c) => c.trim())), mapping, { defaultFunction: pilot.defaultFunction });

  const now = new Date().toISOString();
  const key = (f: Pick<Flight, "date" | "depIcao" | "arrIcao" | "outUtc" | "totalMin">) => `${f.date}|${f.depIcao}|${f.arrIcao}|${f.outUtc ?? ""}|${f.totalMin}`;
  const seen = new Set(existing.map(key));
  const out: Flight[] = [];
  let skipped = 0;
  let duplicates = 0;
  for (const r of parsed) {
    if (!r.input || r.errors.length) {
      skipped++;
      continue;
    }
    const input = r.input;
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
      d.copilotMin = input.function === "SIC" ? ex.total : 0;
      d.dualMin = input.function === "DUAL" ? ex.total : 0;
    }
    if (ex.night !== undefined) d.nightMin = Math.min(ex.night, d.totalMin);
    if (ex.ifr !== undefined) d.ifrMin = Math.min(ex.ifr, d.totalMin);
    if (ex.pic !== undefined) d.picMin = ex.pic;
    if (ex.copilot !== undefined) d.copilotMin = ex.copilot;
    const f: Flight = {
      id: newId(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      pilotId: pilot.id,
      date: input.date,
      flightNumber: input.flightNumber || undefined,
      source: "import",
      rosterEventId: null,
      depIcao: input.depIcao.toUpperCase(),
      arrIcao: input.arrIcao.toUpperCase(),
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
    if (seen.has(key(f))) {
      duplicates++;
      continue;
    }
    seen.add(key(f));
    out.push(f);
  }
  if (out.length) await store.bulkPut("flights", out);
  return { imported: out.length, skipped, duplicates };
}
