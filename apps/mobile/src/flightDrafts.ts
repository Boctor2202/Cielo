import Storage from "expo-sqlite/kv-store";
import {
  defaultIfrFor,
  deriveFlightTimes,
  formatClock,
  type Aircraft,
  type AircraftType,
  type Flight,
  type FlightFormInput,
  type Pilot,
  type RosterEvent,
} from "@cielo/core";
import { lookupAirport } from "./airports";

/**
 * Flights to confirm: every FLIGHT duty of the roster that has ended and is not in the logbook yet becomes a
 * draft, already filled from the roster (date, route, scheduled block times, flight number, aircraft) and the
 * pilot's defaults. The pilot confirms it in one tap, or opens it to adjust the times first.
 */

/** How far back drafts are offered. */
const WINDOW_DAYS = 45;
const DISMISSED_KEY = "drafts.dismissed";

export function loadDismissed(): Set<string> {
  try {
    const raw = Storage.getItemSync(DISMISSED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/** Hides a draft on this phone (the roster event itself is left untouched). */
export function dismissDraft(id: string): void {
  const s = loadDismissed();
  s.add(id);
  // keep the list short: ids older than the window no longer matter
  try {
    Storage.setItemSync(DISMISSED_KEY, JSON.stringify([...s].slice(-500)));
  } catch {
    // not persisted: the draft comes back next launch
  }
}

const routeKey = (date: string, dep?: string, arr?: string) => `${date}|${(dep ?? "").toUpperCase()}|${(arr ?? "").toUpperCase()}`;

/** Roster flights that ended, are not logged (linked or same date and route) and were not dismissed. */
export function pendingDrafts(events: RosterEvent[], flights: Flight[], dismissed: Set<string>, now = new Date()): RosterEvent[] {
  const nowIso = now.toISOString();
  const from = new Date(now.getTime() - WINDOW_DAYS * 86_400_000).toISOString();
  const logged = new Set(flights.filter((f) => !f.deletedAt && !f.isFstd).map((f) => routeKey(f.date, f.depIcao, f.arrIcao)));
  const linked = new Set(flights.filter((f) => !f.deletedAt && f.rosterEventId).map((f) => f.rosterEventId!));
  return events
    .filter(
      (e) =>
        !e.deletedAt &&
        e.kind === "FLIGHT" &&
        !e.flightId &&
        !linked.has(e.id) &&
        !dismissed.has(e.id) &&
        !!e.depIcao &&
        !!e.arrIcao &&
        e.depIcao !== e.arrIcao &&
        // a duty of 20 hours or more is a rotation or a day in the calendar, never one flight
        Date.parse(e.endUtc) - Date.parse(e.startUtc) < 20 * 3600_000 &&
        e.endUtc <= nowIso &&
        e.startUtc >= from &&
        !logged.has(routeKey(e.startUtc.slice(0, 10), e.depIcao, e.arrIcao)),
    )
    .sort((a, b) => a.startUtc.localeCompare(b.startUtc));
}

export interface DraftContext {
  pilot: Pilot;
  aircraft: Aircraft[];
  aircraftTypes: AircraftType[];
  /** pilot flying on the previous leg, for the "alternate" rule */
  lastPilotFlying?: boolean;
}

/** The aircraft and type a roster event points to (registration first, then the type code). */
export function draftAircraft(e: RosterEvent, ctx: Pick<DraftContext, "aircraft" | "aircraftTypes">) {
  const reg = e.aircraftReg?.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const ac = reg ? ctx.aircraft.find((a) => !a.deletedAt && a.registration.toUpperCase().replace(/[^A-Z0-9]/g, "") === reg) : undefined;
  const type = ac
    ? ctx.aircraftTypes.find((x) => x.id === ac.aircraftTypeId)
    : e.aircraftTypeIcao
      ? ctx.aircraftTypes.find((x) => x.icao.toUpperCase() === e.aircraftTypeIcao!.toUpperCase())
      : undefined;
  return { ac, type };
}

/** The logbook entry a draft becomes when confirmed as is: scheduled block times, pilot's defaults. */
export function draftToFlight(e: RosterEvent, ctx: DraftContext): Partial<Flight> {
  const { pilot } = ctx;
  const { ac, type } = draftAircraft(e, ctx);
  const pilotFlying =
    pilot.defaultPilotFlying === "always" ? true : pilot.defaultPilotFlying === "never" ? false : !(ctx.lastPilotFlying ?? false);
  const input: FlightFormInput = {
    date: e.startUtc.slice(0, 10),
    flightNumber: e.flightNumber || undefined,
    depIcao: e.depIcao!.toUpperCase(),
    arrIcao: e.arrIcao!.toUpperCase(),
    out: formatClock(e.startUtc),
    in: formatClock(e.endUtc),
    aircraftId: ac?.id ?? null,
    registration: ac?.registration ?? e.aircraftReg ?? undefined,
    aircraftTypeIcao: type?.icao ?? e.aircraftTypeIcao ?? undefined,
    aircraftModel: type ? `${type.manufacturer} ${type.model}` : undefined,
    operation: ac?.defaultOperation ?? (type?.multiPilot ? "multi_pilot" : undefined),
    function: pilot.defaultFunction,
    ifr: defaultIfrFor(pilot.defaultIfr, type),
    takeoffsDay: 0,
    takeoffsNight: 0,
    landingsDay: 0,
    landingsNight: 0,
    autoLandings: true,
    pilotFlying,
    approaches: [],
    isFstd: false,
  };
  const { warnings: _w, ...times } = deriveFlightTimes(input, { airports: lookupAirport, aircraftType: type, aircraft: ac });
  return {
    pilotId: pilot.id,
    date: input.date,
    flightNumber: input.flightNumber,
    source: "roster",
    rosterEventId: e.id,
    depIcao: input.depIcao,
    arrIcao: input.arrIcao,
    aircraftId: input.aircraftId ?? null,
    registration: input.registration,
    aircraftTypeIcao: input.aircraftTypeIcao,
    aircraftModel: input.aircraftModel,
    ...times,
    function: input.function,
    picName: input.function === "PIC" ? "SELF" : undefined,
    actualImcMin: 0,
    xcMin: 0,
    pilotFlying,
    approaches: [],
    isFstd: false,
    fstdMin: 0,
    crew: [],
    remarks: undefined,
    signatureId: null,
    locked: false,
  };
}
