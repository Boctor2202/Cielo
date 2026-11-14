"use client";

import {
  canonicalFlightContent, deriveFlightTimes, newId, stamp, SYNC_TABLES, type Aircraft, type AircraftType, type Flight,
  type FlightFormInput, type Layover, type License, type Locale, type OpeningBalance, type Pilot, type RosterEvent,
  type Signature, type TableMap, type TableName,
} from "@cielo/core";
import { AIRCRAFT_TYPES, type AirportIndex } from "@cielo/reference-data";
import { db, localStore } from "./db";

const now = () => new Date().toISOString();

export const REFERENCE_TYPES: AircraftType[] = AIRCRAFT_TYPES.map((t) => ({ ...t, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }));

/* ---------- Pilot ---------- */

export async function ensurePilot(locale: Locale = "fr"): Promise<Pilot> {
  const id = await localStore.getMeta("pilotId");
  if (id) {
    const p = await db().t("pilots").get(id);
    if (p) return p;
  }
  const pilot: Pilot = stamp({
    id: id ?? newId(),
    email: "",
    fullName: "",
    locale,
    regulatoryFramework: "EASA",
    defaultFunction: "PIC",
    defaultIfr: "ask",
    defaultPilotFlying: "always",
    timeDisplay: "hhmm",
    subscriptionTier: "free",
    subscriptionSource: null,
  } as Pilot);
  await db().t("pilots").put(pilot);
  await localStore.setMeta("pilotId", pilot.id);
  return pilot;
}

export async function updatePilot(patch: Partial<Pilot>) {
  const p = await ensurePilot();
  await db().t("pilots").put({ ...p, ...patch, id: p.id, updatedAt: now() });
}

/** Rebind local data to the authenticated user id (first sign-in after local use). */
export async function adoptPilotId(newPilotId: string, email?: string) {
  const old = await localStore.getMeta("pilotId");
  if (old === newPilotId) return;
  await db().transaction("rw", db().tables, async () => {
    for (const t of SYNC_TABLES) {
      const rows = (await db().t(t).toArray()) as unknown as Record<string, unknown>[];
      for (const r of rows) {
        if (t === "pilots") {
          if (r.id === old) {
            await db().t("pilots").delete(old!);
            await db().t("pilots").put({ ...(r as unknown as Pilot), id: newPilotId, email: email ?? (r.email as string), updatedAt: now() });
          }
        } else if (r.pilotId === old || r.pilotId === undefined) {
          await db().table(t).put({ ...r, pilotId: newPilotId, updatedAt: now() });
        }
      }
    }
    await db().meta.put({ key: "pilotId", value: newPilotId });
  });
}

/* ---------- Aircraft & types ---------- */

export async function allTypes(): Promise<AircraftType[]> {
  const custom = (await db().t("aircraft_types").toArray()).filter((t) => !t.deletedAt);
  return [...custom, ...REFERENCE_TYPES];
}

export function findType(types: AircraftType[], idOrIcao?: string | null): AircraftType | undefined {
  if (!idOrIcao) return undefined;
  const k = idOrIcao.toUpperCase();
  return types.find((t) => t.id === idOrIcao) ?? types.find((t) => t.icao.toUpperCase() === k);
}

export async function saveAircraft(a: Partial<Aircraft> & { registration: string; aircraftTypeId: string }): Promise<Aircraft> {
  const pilot = await ensurePilot();
  const existing = a.id ? await db().t("aircraft").get(a.id) : undefined;
  const rec = stamp({
    defaultOperation: "single_pilot",
    ...existing,
    ...a,
    pilotId: pilot.id,
    registration: a.registration.trim().toUpperCase(),
  } as Aircraft);
  await db().t("aircraft").put(rec);
  return rec;
}

export async function saveCustomType(t: Omit<AircraftType, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<AircraftType> {
  const pilot = await ensurePilot();
  const rec = stamp({ ...t, icao: t.icao.toUpperCase(), ownerPilotId: pilot.id } as AircraftType);
  await db().t("aircraft_types").put(rec);
  return rec;
}

async function resolveAircraft(input: FlightFormInput, types: AircraftType[]) {
  let aircraft: Aircraft | undefined;
  if (input.aircraftId) aircraft = await db().t("aircraft").get(input.aircraftId);
  if (!aircraft && input.registration) {
    const reg = input.registration.trim().toUpperCase();
    aircraft = (await db().t("aircraft").toArray()).find((a) => !a.deletedAt && a.registration === reg);
    if (!aircraft && !input.isFstd) {
      const type = findType(types, input.aircraftTypeIcao);
      aircraft = await saveAircraft({
        registration: reg,
        aircraftTypeId: type?.id ?? `ref-${input.aircraftTypeIcao ?? "UNKN"}`,
        defaultOperation: input.operation ?? (type?.multiPilot ? "multi_pilot" : "single_pilot"),
      });
    }
  }
  const type = findType(types, aircraft?.aircraftTypeId) ?? findType(types, input.aircraftTypeIcao);
  return { aircraft, type };
}

/* ---------- Flights ---------- */

export interface ExplicitTimes {
  total?: number;
  night?: number;
  ifr?: number;
  pic?: number;
  copilot?: number;
  dual?: number;
  instructor?: number;
  multiPilot?: number;
}

export async function buildFlight(
  input: FlightFormInput,
  airports: AirportIndex,
  opts: { id?: string; explicit?: ExplicitTimes; source?: Flight["source"]; rosterEventId?: string | null } = {},
): Promise<Flight> {
  const pilot = await ensurePilot();
  const types = await allTypes();
  const { aircraft, type } = await resolveAircraft(input, types);
  const d = deriveFlightTimes(input, { airports: (c) => airports.get(c), aircraftType: type, aircraft });
  const existing = opts.id ? await db().t("flights").get(opts.id) : undefined;
  const ex = opts.explicit ?? {};

  // Files with totals but no clock times: trust the file.
  if (ex.total !== undefined && d.totalMin === 0 && !input.isFstd) {
    const total = ex.total;
    d.totalMin = total;
    d.airMin = total;
    const mp =
      ex.multiPilot !== undefined
        ? ex.multiPilot > 0
        : (input.operation ?? aircraft?.defaultOperation ?? (type?.multiPilot ? "multi_pilot" : "single_pilot")) === "multi_pilot";
    d.multiPilotMin = mp ? total : 0;
    d.singlePilotSeMin = !mp && (type?.engineCount ?? 1) <= 1 ? total : 0;
    d.singlePilotMeMin = !mp && (type?.engineCount ?? 1) > 1 ? total : 0;
    const f = input.function;
    d.picMin = f === "PIC" ? total : 0;
    d.picusMin = f === "PICUS" ? total : 0;
    d.copilotMin = f === "SIC" ? total : 0;
    d.dualMin = f === "DUAL" ? total : 0;
    d.instructorMin = f === "FI" ? total : 0;
    d.examinerMin = f === "FE" ? total : 0;
    if (input.ifr && ex.ifr === undefined) d.ifrMin = total;
  }
  if (ex.ifr !== undefined) d.ifrMin = Math.min(ex.ifr, d.totalMin);
  if (ex.night !== undefined) {
    d.nightMin = Math.min(ex.night, d.totalMin);
    d.nightCalc = "manual";
  }
  if (ex.pic !== undefined) d.picMin = ex.pic;
  if (ex.copilot !== undefined) d.copilotMin = ex.copilot;
  if (ex.dual !== undefined) d.dualMin = ex.dual;
  if (ex.instructor !== undefined) d.instructorMin = ex.instructor;

  const flight: Flight = {
    ...(existing ?? {}),
    id: opts.id ?? newId(),
    createdAt: existing?.createdAt ?? now(),
    updatedAt: now(),
    deletedAt: null,
    pilotId: pilot.id,
    date: input.date,
    flightNumber: input.flightNumber?.trim() || undefined,
    source: opts.source ?? existing?.source ?? "manual",
    rosterEventId: opts.rosterEventId ?? existing?.rosterEventId ?? null,
    depIcao: input.depIcao.trim().toUpperCase(),
    arrIcao: input.arrIcao.trim().toUpperCase(),
    outUtc: d.outUtc,
    offUtc: d.offUtc,
    onUtc: d.onUtc,
    inUtc: d.inUtc,
    aircraftId: aircraft?.id ?? null,
    registration: aircraft?.registration ?? input.registration?.toUpperCase(),
    aircraftTypeIcao: type?.icao ?? input.aircraftTypeIcao,
    aircraftModel: type ? `${type.manufacturer} ${type.model}${aircraft?.variant ? ` ${aircraft.variant}` : ""}` : input.aircraftModel,
    totalMin: d.totalMin,
    airMin: d.airMin,
    singlePilotSeMin: d.singlePilotSeMin,
    singlePilotMeMin: d.singlePilotMeMin,
    multiPilotMin: d.multiPilotMin,
    function: input.function,
    picName: input.function === "PIC" ? undefined : input.picName?.trim() || undefined,
    picMin: d.picMin,
    picusMin: d.picusMin,
    copilotMin: d.copilotMin,
    dualMin: d.dualMin,
    instructorMin: d.instructorMin,
    examinerMin: d.examinerMin,
    nightMin: d.nightMin,
    ifrMin: d.ifrMin,
    actualImcMin: Math.min(input.actualImcMin ?? 0, d.totalMin),
    xcMin: Math.min(input.xcMin ?? 0, d.totalMin),
    nightCalc: d.nightCalc,
    takeoffsDay: d.takeoffsDay,
    takeoffsNight: d.takeoffsNight,
    landingsDay: d.landingsDay,
    landingsNight: d.landingsNight,
    pilotFlying: input.pilotFlying,
    approaches: input.approaches ?? [],
    isFstd: input.isFstd,
    fstdType: input.isFstd ? input.fstdType : undefined,
    fstdQualification: input.isFstd ? input.fstdQualification : undefined,
    fstdMin: input.isFstd ? (input.fstdMin ?? 0) : 0,
    crew: input.crew ?? [],
    remarks: input.remarks?.trim() || undefined,
    signatureId: existing?.signatureId ?? null,
    locked: existing?.locked ?? false,
  };

  // Any content change on a signed flight voids the signature.
  if (existing?.signatureId) {
    const sig = await db().t("signatures").get(existing.signatureId);
    if (!sig || sig.contentHash !== (await sha256(canonicalFlightContent(flight)))) {
      flight.signatureId = null;
      flight.locked = false;
    }
  }
  return flight;
}

export async function saveFlight(input: FlightFormInput, airports: AirportIndex, opts: Parameters<typeof buildFlight>[2] = {}) {
  const f = await buildFlight(input, airports, opts);
  await db().t("flights").put(f);
  if (f.rosterEventId) {
    const ev = await db().t("roster_events").get(f.rosterEventId);
    if (ev) await db().t("roster_events").put({ ...ev, flightId: f.id, updatedAt: now() });
  }
  return f;
}

export async function softDelete<T extends TableName>(table: T, id: string) {
  const rec = await db().t(table).get(id);
  if (rec) await db().t(table).put({ ...rec, deletedAt: now(), updatedAt: now() } as TableMap[T]);
}

export async function restore<T extends TableName>(table: T, id: string) {
  const rec = await db().t(table).get(id);
  if (rec) await db().t(table).put({ ...rec, deletedAt: null, updatedAt: now() } as TableMap[T]);
}

/** Converts a stored flight back into form values. */
export function flightToInput(f: Flight): FlightFormInput {
  const clock = (iso?: string | null) => (iso ? iso.slice(11, 16) : undefined);
  return {
    date: f.date,
    flightNumber: f.flightNumber,
    depIcao: f.depIcao,
    arrIcao: f.arrIcao,
    out: clock(f.outUtc),
    off: clock(f.offUtc),
    on: clock(f.onUtc),
    in: clock(f.inUtc),
    aircraftId: f.aircraftId,
    registration: f.registration,
    aircraftTypeIcao: f.aircraftTypeIcao,
    aircraftModel: f.aircraftModel,
    operation: f.multiPilotMin > 0 ? "multi_pilot" : f.totalMin > 0 ? "single_pilot" : undefined,
    function: f.function,
    picName: f.picName,
    ifr: f.ifrMin > 0,
    nightOverrideMin: f.nightCalc === "manual" ? f.nightMin : undefined,
    ifrOverrideMin: f.ifrMin > 0 && f.ifrMin !== f.totalMin ? f.ifrMin : undefined,
    actualImcMin: f.actualImcMin,
    xcMin: f.xcMin,
    takeoffsDay: f.takeoffsDay,
    takeoffsNight: f.takeoffsNight,
    landingsDay: f.landingsDay,
    landingsNight: f.landingsNight,
    autoLandings: false,
    pilotFlying: f.pilotFlying,
    approaches: f.approaches,
    isFstd: f.isFstd,
    fstdType: f.fstdType,
    fstdQualification: f.fstdQualification,
    fstdMin: f.fstdMin,
    crew: f.crew,
    remarks: f.remarks,
  };
}

/* ---------- Signatures ---------- */

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signFlight(flightId: string, s: Pick<Signature, "signerName" | "signerRole" | "signerLicenceNumber" | "imageDataUrl">) {
  const f = await db().t("flights").get(flightId);
  if (!f) return;
  const pilot = await ensurePilot();
  const sig: Signature = stamp({ ...s, pilotId: pilot.id, flightId, signedAt: now(), contentHash: await sha256(canonicalFlightContent(f)) } as Signature);
  await db().t("signatures").put(sig);
  await db().t("flights").put({ ...f, signatureId: sig.id, locked: true, updatedAt: now() });
}

export async function verifySignature(f: Flight): Promise<{ sig?: Signature; valid: boolean }> {
  if (!f.signatureId) return { valid: false };
  const sig = await db().t("signatures").get(f.signatureId);
  if (!sig) return { valid: false };
  return { sig, valid: sig.contentHash === (await sha256(canonicalFlightContent(f))) };
}

export async function removeSignature(f: Flight) {
  if (f.signatureId) await softDelete("signatures", f.signatureId);
  await db().t("flights").put({ ...f, signatureId: null, locked: false, updatedAt: now() });
}

/* ---------- Generic helpers ---------- */

export async function put<T extends TableName>(table: T, rec: Omit<TableMap[T], "id" | "createdAt" | "updatedAt" | "pilotId"> & { id?: string }) {
  const pilot = await ensurePilot();
  const existing = rec.id ? await db().t(table).get(rec.id) : undefined;
  const row = stamp({ ...(existing ?? {}), ...rec, pilotId: pilot.id } as unknown as TableMap[T]);
  await db().t(table).put(row);
  return row;
}

export const saveLicense = (l: Omit<License, "id" | "createdAt" | "updatedAt" | "pilotId"> & { id?: string }) => put("licenses", l);
export const saveOpening = (o: Omit<OpeningBalance, "id" | "createdAt" | "updatedAt" | "pilotId"> & { id?: string }) => put("opening_balances", o);
export const saveRosterEvent = (e: Omit<RosterEvent, "id" | "createdAt" | "updatedAt" | "pilotId"> & { id?: string }) => put("roster_events", e);
export const saveLayover = (l: Omit<Layover, "id" | "createdAt" | "updatedAt" | "pilotId"> & { id?: string }) => put("layovers", l);

/* ---------- GDPR ---------- */

export async function exportAll(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { app: "Sillage", version: 1, exportedAt: now() };
  for (const t of SYNC_TABLES) out[t] = await db().t(t).toArray();
  return out;
}

export async function importAll(data: Record<string, unknown>) {
  // backups made before the rename say "Cielo"
  if (data.app !== "Sillage" && data.app !== "Cielo") throw new Error("Not a Sillage backup");
  await db().transaction("rw", db().tables, async () => {
    for (const t of SYNC_TABLES) {
      const rows = data[t];
      if (Array.isArray(rows)) await db().table(t).bulkPut(rows);
    }
    const pilots = data.pilots as Pilot[] | undefined;
    if (pilots?.[0]) await db().meta.put({ key: "pilotId", value: pilots[0].id });
  });
}

export async function deleteAllLocal() {
  await localStore.clear();
}
