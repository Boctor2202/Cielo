import type { Layover, RosterEvent } from "./types";

/** A layover read from the roster: the duty that lands away from base, and the one that leaves again. */
export interface RosterLayover {
  airportIcao: string;
  arrivalUtc: string;
  departureUtc: string;
  /** the roster event that lands there (kept on the layover once the pilot saves it) */
  rosterEventId: string;
}

const MOVES = new Set(["FLIGHT", "DEADHEAD"]);
const MIN_REST_H = 8;
const MAX_DAYS = 7;

/**
 * Layovers from the roster: a flight or positioning lands at an airport other than the home base and the next
 * flight or positioning leaves from that same airport, at least 8 hours later and no more than a week later.
 * Without a home base, the base is taken as the airport the pilot leaves from most often.
 */
export function rosterLayovers(events: RosterEvent[], homeBase?: string | null): RosterLayover[] {
  const moves = events
    .filter((e) => !e.deletedAt && !e.tentative && MOVES.has(e.kind) && e.depIcao && e.arrIcao && e.startUtc && e.endUtc)
    .sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  let base = homeBase?.toUpperCase() || undefined;
  if (!base) {
    const count = new Map<string, number>();
    for (const e of moves) count.set(e.depIcao!.toUpperCase(), (count.get(e.depIcao!.toUpperCase()) ?? 0) + 1);
    base = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  }
  const out: RosterLayover[] = [];
  for (let i = 0; i < moves.length - 1; i++) {
    const cur = moves[i]!;
    const next = moves[i + 1]!;
    const at = cur.arrIcao!.toUpperCase();
    if (at === base || next.depIcao!.toUpperCase() !== at) continue;
    const arrival = cur.debriefUtc ?? cur.endUtc;
    const departure = next.reportUtc ?? next.startUtc;
    const h = (Date.parse(departure) - Date.parse(arrival)) / 3_600_000;
    if (!(h >= MIN_REST_H) || h > MAX_DAYS * 24) continue;
    out.push({ airportIcao: at, arrivalUtc: cur.endUtc, departureUtc: next.startUtc, rosterEventId: cur.id });
  }
  return out;
}

/**
 * The roster's layovers the pilot has not saved yet: none with that roster event (even deleted: a layover the
 * pilot removed does not come back), nor one at the same airport arriving the same day.
 */
export function unsavedRosterLayovers(events: RosterEvent[], layovers: Layover[], homeBase?: string | null): RosterLayover[] {
  const byEvent = new Set(layovers.map((l) => l.rosterEventId).filter(Boolean));
  const byDay = new Set(layovers.filter((l) => !l.deletedAt && l.arrivalUtc).map((l) => `${l.airportIcao}|${l.arrivalUtc!.slice(0, 10)}`));
  return rosterLayovers(events, homeBase).filter((r) => !byEvent.has(r.rosterEventId) && !byDay.has(`${r.airportIcao}|${r.arrivalUtc.slice(0, 10)}`));
}
