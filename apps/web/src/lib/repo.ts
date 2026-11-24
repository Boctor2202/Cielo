"use client";

import { misreadOperators, retypeLogbook, typeFromText,
  markPilotFields,
  operatorIndex,
  canonicalFlightContent, ownSignature, type SignedInfo, deriveFlightTimes, extraFlightFields, flightRevision, newId, stamp, SYNC_TABLES, type Aircraft, type AircraftType, type Flight,
  type FlightFormInput, type Layover, type License, type Locale, type OpeningBalance, type Pilot, type RosterEvent,
  type Signature, type TableMap, type TableName, type FlightRevision,
} from "@cielo/core";
import { AIRCRAFT_TYPES, type AirportIndex } from "@cielo/reference-data";
import { db, localStore } from "./db";
import { ReadOnlyError, writeAllowed } from "./write-guard";

/** No subscription (and no demo left): the logbook is read-only. */
const guard = () => {
  if (!writeAllowed()) throw new ReadOnlyError();
};

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
  // only these fields are pushed: another device's copy of the profile is never sent back whole
  await markPilotFields(localStore, Object.keys(patch));
}

/** Rebind local data to the authenticated user id (first sign-in after local use). */
/** Returns true when this browser's own records were just brought into the account. */
export async function adoptPilotId(newPilotId: string, email?: string): Promise<boolean> {
  const old = await localStore.getMeta("pilotId");
  if (old === newPilotId) return false;
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
  // what was filled in before signing in is pushed, never its empty fields over the account's profile
  const adopted = await db().t("pilots").get(newPilotId);
  if (adopted) {
    const skip = new Set(["id", "createdAt", "updatedAt", "deletedAt", "subscriptionTier", "subscriptionSource", "subscriptionExpiresAt"]);
    await markPilotFields(localStore, Object.entries(adopted).filter(([k, v]) => !skip.has(k) && v !== undefined && v !== null && v !== "").map(([k]) => k));
  }
  return true;
}

/**
 * After a sign-in merged this browser's flights into an account that already had them (the same file imported
 * on both sides), the copies are removed: every field the same (date, airports, times, duration, aircraft, landings, function, remarks). The oldest record wins;
 * flights without block times are left alone, since two of them can legitimately look alike.
 */
export async function dedupeFlights(): Promise<number> {
  const all = (await db().t("flights").toArray()).filter((f) => !f.deletedAt && (f.outUtc || f.offUtc));
  const seen = new Map<string, Flight>();
  const extra: Flight[] = [];
  for (const f of all.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    // every field a copy shares: two different flights of the same day can have the same times and duration
    // (circuits, rounded or missing times in an old logbook)
    const k = [f.date, f.depIcao, f.arrIcao, f.outUtc, f.offUtc, f.onUtc, f.inUtc, f.isFstd ? f.fstdMin : f.totalMin, f.isFstd ? 1 : 0, f.registration, f.landingsDay, f.landingsNight, f.function, f.remarks].join("|");
    if (seen.has(k)) extra.push(f);
    else seen.set(k, f);
  }
  const t = now();
  for (const f of extra) await putFlight({ ...f, deletedAt: t, updatedAt: t });
  return extra.length;
}

/**
 * Aircraft copies: a logbook imported again in another browser, then joined to the account, brings its own
 * aircraft records. Keeps the oldest record per registration (dashes and case ignored), points the flights
 * at it and soft-deletes the others.
 */
export async function dedupeAircraft(): Promise<number> {
  const norm = (r: string) => r.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const all = (await db().t("aircraft").toArray()).filter((a) => !a.deletedAt).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const keep = new Map<string, Aircraft>();
  const moved = new Map<string, string>();
  for (const a of all) {
    const k = norm(a.registration);
    const first = keep.get(k);
    if (first) moved.set(a.id, first.id);
    else keep.set(k, a);
  }
  if (!moved.size) return 0;
  const t = now();
  for (const f of await db().t("flights").toArray()) {
    const to = f.aircraftId ? moved.get(f.aircraftId) : undefined;
    if (to) await putFlight({ ...f, aircraftId: to, updatedAt: t });
  }
  for (const a of all) if (moved.has(a.id)) await db().t("aircraft").put({ ...a, deletedAt: t, updatedAt: t });
  return moved.size;
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
  guard();
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
  guard();
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
      const type = typeOf(types, input.aircraftTypeIcao);
      aircraft = await saveAircraft({
        registration: reg,
        aircraftTypeId: type?.id ?? `ref-${input.aircraftTypeIcao ?? "UNKN"}`,
        defaultOperation: input.operation ?? (type?.multiPilot ? "multi_pilot" : "single_pilot"),
      });
    }
  }
  const type = findType(types, aircraft?.aircraftTypeId) ?? typeOf(types, input.aircraftTypeIcao);
  return { aircraft, type };
}

/** A type by designator, or by the name a logbook file wrote ("172, P172, R172, Skyhawk", "EMB 500"). */
function typeOf(types: AircraftType[], text?: string | null): AircraftType | undefined {
  return findType(types, text) ?? findType(types, typeFromText(text, types));
}

/**
 * At each launch: flights and aircraft imported with a type name instead of its designator get the designator
 * (statistics by type, CV). Signed flights are left as signed.
 */
export async function repairTypes(): Promise<number> {
  const types = await allTypes();
  const r = retypeLogbook(await db().t("flights").toArray(), await db().t("aircraft").toArray(), types);
  const t = now();
  for (const x of r.flights) {
    const f = await db().t("flights").get(x.id);
    if (f) await putFlight({ ...f, aircraftTypeIcao: x.icao, aircraftModel: x.model, updatedAt: t });
  }
  for (const x of r.aircraft) {
    const a = await db().t("aircraft").get(x.id);
    if (a) await db().t("aircraft").put({ ...a, aircraftTypeId: x.typeId, updatedAt: t });
  }
  return r.flights.length + r.aircraft.length;
}

/* ---------- Flights ---------- */

export interface ExplicitTimes {
  total?: number;
  night?: number;
  ifr?: number;
  pic?: number;
  picus?: number;
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
  // logbooks often use IATA codes (ARN): store the ICAO code (ESSA) when the airport is known
  const icao = (c: string) => {
    const code = c.trim().toUpperCase();
    return (code.length === 3 && airports.iataToIcao(code)) || code;
  };
  input = { ...input, depIcao: icao(input.depIcao), arrIcao: icao(input.arrIcao) };
  const pilot = await ensurePilot();
  const types = await allTypes();
  const { aircraft, type } = await resolveAircraft(input, types);
  const d = deriveFlightTimes(input, { airports: (c) => airports.get(c), aircraftType: type, aircraft });
  const existing = opts.id ? await db().t("flights").get(opts.id) : undefined;
  const ex = opts.explicit ?? {};

  // Files with totals but no clock times, or whose times disagree with the total written: trust the total (the
  // logbook's own figure; a misread or mistyped hour must not add or remove flight time).
  if (ex.total !== undefined && !input.isFstd && (d.totalMin === 0 || Math.abs(d.totalMin - ex.total) > 5)) {
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
  d.nightMin = Math.min(d.nightMin, d.totalMin);
  if (ex.ifr !== undefined) d.ifrMin = Math.min(ex.ifr, d.totalMin);
  if (ex.night !== undefined) {
    d.nightMin = Math.min(ex.night, d.totalMin);
    d.nightCalc = "manual";
  }
  if (ex.pic !== undefined) d.picMin = Math.min(ex.pic, d.totalMin);
  if (ex.picus !== undefined) d.picusMin = Math.min(ex.picus, d.totalMin);
  if (ex.copilot !== undefined) d.copilotMin = Math.min(ex.copilot, d.totalMin);
  if (ex.dual !== undefined) d.dualMin = Math.min(ex.dual, d.totalMin);
  if (ex.instructor !== undefined) d.instructorMin = Math.min(ex.instructor, d.totalMin);

  const flight: Flight = {
    ...(existing ?? {}),
    id: opts.id ?? newId(),
    createdAt: existing?.createdAt ?? now(),
    updatedAt: now(),
    deletedAt: null,
    pilotId: pilot.id,
    date: input.date,
    flightNumber: input.flightNumber?.trim() || undefined,
    operator: input.operator?.trim() || aircraft?.operator?.trim() || undefined,
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
    ...extraFlightFields(input, d.totalMin),
    loggedShare: input.loggedShare && input.loggedShare < 1 ? input.loggedShare : undefined,
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

/** Imported flights: one "created by import" entry each in the audit trail. */
export async function logImported(flights: Flight[]) {
  await db().t("flight_revisions").bulkPut(flights.map((f) => stamp({ ...flightRevision(undefined, f, "import")! } as FlightRevision)));
}

/** Records a change of a flight in its audit trail (nothing when the content did not change). */
async function logRevision(prev: Flight | undefined, next: Flight) {
  const r = flightRevision(prev, next, "web");
  if (r) await db().t("flight_revisions").put(stamp(r as FlightRevision));
}

/** Writes a flight and records the change. */
async function putFlight(next: Flight) {
  const prev = await db().t("flights").get(next.id);
  await db().t("flights").put(next);
  await logRevision(prev, next);
}

/** Gives flights their operator (or clears it). The operator is not part of a signed entry: signatures stay valid. */
export async function setOperator(ids: string[], operator: string | undefined) {
  guard();
  const op = operator?.trim() || undefined;
  for (const id of ids) {
    const f = await db().t("flights").get(id);
    if (f && !f.deletedAt && (f.operator ?? undefined) !== op) await putFlight({ ...f, operator: op, updatedAt: now() });
  }
}

export async function saveFlight(input: FlightFormInput, airports: AirportIndex, opts: Parameters<typeof buildFlight>[2] = {}) {
  guard();
  const f = await buildFlight(input, airports, opts);
  await putFlight(f);
  if (f.rosterEventId) {
    const ev = await db().t("roster_events").get(f.rosterEventId);
    if (ev) await db().t("roster_events").put({ ...ev, flightId: f.id, updatedAt: now() });
  }
  return f;
}

export async function softDelete<T extends TableName>(table: T, id: string) {
  guard();
  const rec = await db().t(table).get(id);
  if (!rec) return;
  const next = { ...rec, deletedAt: now(), updatedAt: now() } as TableMap[T];
  await db().t(table).put(next);
  if (table === "flights") await logRevision(rec as Flight, next as Flight);
}

export async function restore<T extends TableName>(table: T, id: string) {
  guard();
  const rec = await db().t(table).get(id);
  if (!rec) return;
  const next = { ...rec, deletedAt: null, updatedAt: now() } as TableMap[T];
  await db().t(table).put(next);
  if (table === "flights") await logRevision(rec as Flight, next as Flight);
}

/** Converts a stored flight back into form values. */
export function flightToInput(f: Flight): FlightFormInput {
  const clock = (iso?: string | null) => (iso ? iso.slice(11, 16) : undefined);
  return {
    date: f.date,
    flightNumber: f.flightNumber,
    operator: f.operator,
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
    simInstrumentMin: f.simInstrumentMin,
    holdings: f.holdings,
    hudTakeoffs: f.hudTakeoffs,
    hudLandings: f.hudLandings,
    groundTrainingMin: f.groundTrainingMin,
    soloMin: f.soloMin,
    safetyPilotName: f.safetyPilotName,
    purpose: f.purpose,
    via: f.via,
    loggedShare: f.loggedShare,
  };
}

/* ---------- Signatures ---------- */

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signFlight(flightId: string, s: Pick<Signature, "signerName" | "signerRole" | "signerLicenceNumber" | "imageDataUrl">) {
  guard();
  const f = await db().t("flights").get(flightId);
  if (!f) return;
  const pilot = await ensurePilot();
  const sig: Signature = stamp({ ...s, pilotId: pilot.id, flightId, signedAt: now(), contentHash: await sha256(canonicalFlightContent(f)) } as Signature);
  await db().t("signatures").put(sig);
  await putFlight({ ...f, signatureId: sig.id, locked: true, updatedAt: now() });
}

/** Signs flights with the pilot's saved signature (one signature each, flight locked). Returns how many. */
export async function signWithSaved(ids: string[]): Promise<number> {
  guard();
  const pilot = await ensurePilot();
  if (!pilot.signatureDataUrl) return 0;
  const at = now();
  let n = 0;
  for (const id of ids) {
    const f = await db().t("flights").get(id);
    if (!f || f.deletedAt || f.signatureId) continue;
    const sig = stamp({ ...ownSignature(pilot, f, await sha256(canonicalFlightContent(f)), at) } as Signature);
    await db().t("signatures").put(sig);
    await putFlight({ ...f, signatureId: sig.id, locked: true, updatedAt: at });
    n++;
  }
  return n;
}

/** The flights' signatures for an export: who signed, and whether each flight is unchanged since. */
export async function signaturesFor(flights: Flight[]): Promise<Record<string, SignedInfo>> {
  const out: Record<string, SignedInfo> = {};
  for (const f of flights) {
    if (!f.signatureId || f.deletedAt) continue;
    const s = await db().t("signatures").get(f.signatureId);
    if (!s || s.deletedAt) continue;
    out[f.id] = { signerName: s.signerName, signerRole: s.signerRole, signerLicenceNumber: s.signerLicenceNumber, signedAt: s.signedAt, imageDataUrl: s.imageDataUrl, valid: s.contentHash === (await sha256(canonicalFlightContent(f))) };
  }
  return out;
}

export async function verifySignature(f: Flight): Promise<{ sig?: Signature; valid: boolean }> {
  if (!f.signatureId) return { valid: false };
  const sig = await db().t("signatures").get(f.signatureId);
  if (!sig) return { valid: false };
  return { sig, valid: sig.contentHash === (await sha256(canonicalFlightContent(f))) };
}

export async function removeSignature(f: Flight) {
  guard();
  if (f.signatureId) await softDelete("signatures", f.signatureId);
  await putFlight({ ...f, signatureId: null, locked: false, updatedAt: now() });
}

/* ---------- Generic helpers ---------- */

export async function put<T extends TableName>(table: T, rec: Omit<TableMap[T], "id" | "createdAt" | "updatedAt" | "pilotId"> & { id?: string }) {
  guard();
  const pilot = await ensurePilot();
  const existing = rec.id ? await db().t(table).get(rec.id) : undefined;
  const row = stamp({ ...(existing ?? {}), ...rec, pilotId: pilot.id } as unknown as TableMap[T]);
  await db().t(table).put(row);
  if (table === "flights") await logRevision(existing as Flight | undefined, row as Flight);
  return row;
}

export const saveLicense = (l: Omit<License, "id" | "createdAt" | "updatedAt" | "pilotId"> & { id?: string }) => put("licenses", l);
export const saveOpening = (o: Omit<OpeningBalance, "id" | "createdAt" | "updatedAt" | "pilotId"> & { id?: string }) => put("opening_balances", o);
export const saveRosterEvent = (e: Omit<RosterEvent, "id" | "createdAt" | "updatedAt" | "pilotId"> & { id?: string }) => put("roster_events", e);
export const saveLayover = (l: Omit<Layover, "id" | "createdAt" | "updatedAt" | "pilotId"> & { id?: string }) => put("layovers", l);

/* ---------- GDPR ---------- */

export async function exportAll(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { app: "Geardown", version: 1, exportedAt: now() };
  for (const t of SYNC_TABLES) out[t] = await db().t(t).toArray();
  return out;
}

export async function importAll(data: Record<string, unknown>) {
  guard();
  // backups made before the renames say "Strato", "Sillage" or "Cielo"
  if (!["Geardown", "Strato", "Sillage", "Cielo"].includes(String(data.app))) throw new Error("Not a Geardown backup");
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

/** Identity of a flight for duplicate detection: route and off-block minute, or route, date and duration. */
export const flightKey = (f: Pick<Flight, "date" | "depIcao" | "arrIcao" | "outUtc" | "offUtc" | "totalMin">) =>
  `${f.depIcao}|${f.arrIcao}|${(f.outUtc ?? f.offUtc)?.slice(0, 16) ?? `${f.date}|${f.totalMin}`}`;

const OPERATORS_BACKFILL = "backfill:operators:v1";
const OPERATORS_REPAIR = "repair:operators:v2";

/** Once per device: removes the operators an earlier version read from a registration typed as the flight number. */
async function repairOperators(directory: Parameters<typeof operatorIndex>[2]): Promise<void> {
  if (await localStore.getMeta(OPERATORS_REPAIR)) return;
  const flights = (await db().t("flights").toArray()).filter((f) => !f.deletedAt);
  if (!flights.length) return;
  const ids = misreadOperators(flights, directory ?? undefined);
  if (ids.length) await setOperator(ids, undefined);
  await localStore.setMeta(OPERATORS_REPAIR, new Date().toISOString());
}

/**
 * Once per device: flights entered or imported before operators were recorded get the operator the logbook
 * recognises for them (call sign, aircraft, what it learned). Flights already given one are left alone; signatures
 * stay valid (the operator is not part of a signed entry).
 */
export async function backfillOperators(directory: Parameters<typeof operatorIndex>[2]): Promise<number> {
  await repairOperators(directory);
  if (await localStore.getMeta(OPERATORS_BACKFILL)) return 0;
  const flights = (await db().t("flights").toArray()).filter((f) => !f.deletedAt);
  // nothing here yet (a new device before its first sync): try again next time
  if (!flights.length) return 0;
  const ops = operatorIndex(flights, await db().t("aircraft").toArray(), directory);
  const byOp = new Map<string, string[]>();
  for (const f of flights) {
    if (f.operator || f.isFstd) continue;
    const op = ops.of(f);
    if (op) byOp.set(op, [...(byOp.get(op) ?? []), f.id]);
  }
  let n = 0;
  for (const [op, ids] of byOp) {
    await setOperator(ids, op);
    n += ids.length;
  }
  await localStore.setMeta(OPERATORS_BACKFILL, new Date().toISOString());
  return n;
}
