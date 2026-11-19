import type { Flight, RosterEvent } from "./types";
import { stamp } from "./store";

/**
 * Re-importing a roster that changed (a new print of the month): the new print is the truth for the days it
 * covers. Each duty is matched with the one already in the app (same flight around the same time, or the same
 * kind of duty the same day) and updated in place, so a flight already logged keeps its link; flights logged
 * by hand are linked to their duty; duties the new print no longer has are removed, unless already logged.
 */

export type IncomingEvent = Omit<RosterEvent, "id" | "createdAt" | "updatedAt" | "deletedAt">;

export interface RosterMerge {
  /** records to save: new, updated and removed (soft-deleted) events */
  put: RosterEvent[];
  added: number;
  updated: number;
  unchanged: number;
  removed: number;
  /** duties now linked to a flight already in the logbook */
  linked: number;
}

const H = 3_600_000;
const isFlight = (k: RosterEvent["kind"]) => k === "FLIGHT" || k === "DEADHEAD";
const t = (iso: string) => Date.parse(iso);
const day = (iso: string) => iso.slice(0, 10);
const addDay = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** fields that tell an unchanged duty from an updated one */
const content = (e: Partial<RosterEvent>) =>
  JSON.stringify([e.kind, e.title ?? null, e.reportUtc ?? null, e.startUtc, e.endUtc, e.flightNumber ?? null, e.depIcao ?? null, e.arrIcao ?? null, e.aircraftReg ?? null, e.aircraftTypeIcao ?? null, !!e.tentative]);

/** How far two duties are from being the same one (lower is closer), or null when they cannot be. */
function distance(a: Pick<RosterEvent, "kind" | "startUtc" | "depIcao" | "arrIcao">, b: Pick<RosterEvent, "kind" | "startUtc" | "depIcao" | "arrIcao">): number | null {
  const dt = Math.abs(t(a.startUtc) - t(b.startUtc));
  if (isFlight(a.kind) !== isFlight(b.kind)) return null;
  if (isFlight(a.kind)) {
    // the same leg, its times moved by up to 6 h (a delay, a new slot)
    if ((a.depIcao ?? "") !== (b.depIcao ?? "") || (a.arrIcao ?? "") !== (b.arrIcao ?? "")) return null;
    return dt <= 6 * H ? dt : null;
  }
  if (a.kind !== b.kind) return null;
  return day(a.startUtc) === day(b.startUtc) || dt <= 12 * H ? dt : null;
}

/** The flight of the logbook a duty was flown as: same airports, off-block within 3 h of the duty's start. */
function flightFor(e: Pick<RosterEvent, "startUtc" | "depIcao" | "arrIcao">, flights: Flight[], taken: Set<string>): Flight | undefined {
  let best: Flight | undefined;
  let bestDt = Infinity;
  for (const f of flights) {
    if (f.deletedAt || f.isFstd || taken.has(f.id) || f.depIcao !== e.depIcao || f.arrIcao !== e.arrIcao) continue;
    const at = f.outUtc ?? f.offUtc;
    const dt = at ? Math.abs(t(at) - t(e.startUtc)) : f.date === day(e.startUtc) ? 2 * H : Infinity;
    if (dt <= 3 * H && dt < bestDt) {
      best = f;
      bestDt = dt;
    }
  }
  return best;
}

export function mergeRosterImport(existing: RosterEvent[], incoming: IncomingEvent[], flights: Flight[], now = new Date().toISOString()): RosterMerge {
  const res: RosterMerge = { put: [], added: 0, updated: 0, unchanged: 0, removed: 0, linked: 0 };
  if (!incoming.length) return res;
  // the days the new print covers
  const days = incoming.map((e) => day(e.startUtc)).sort();
  const from = `${days[0]}T00:00:00.000Z`;
  const to = `${addDay(days[days.length - 1]!, 1)}T00:00:00.000Z`;
  const alive = existing.filter((e) => !e.deletedAt);
  const inWindow = alive.filter((e) => e.startUtc >= from && e.startUtc < to);
  const matched = new Set<string>();
  // flights already linked to a duty
  const taken = new Set(alive.map((e) => e.flightId).filter((x): x is string => !!x));
  const out: RosterEvent[] = [];

  for (const inc of [...incoming].sort((a, b) => a.startUtc.localeCompare(b.startUtc))) {
    let prev: RosterEvent | undefined;
    let best = Infinity;
    for (const e of inWindow) {
      if (matched.has(e.id)) continue;
      const d = distance(inc, e);
      if (d !== null && d < best) {
        prev = e;
        best = d;
      }
    }
    if (prev) {
      matched.add(prev.id);
      const next = { ...prev, ...inc, id: prev.id, createdAt: prev.createdAt, flightId: prev.flightId ?? null, deletedAt: null } as RosterEvent;
      let changed = content(prev) !== content(next);
      if (!next.flightId && isFlight(next.kind)) {
        const f = flightFor(next, flights, taken);
        if (f) {
          next.flightId = f.id;
          taken.add(f.id);
          res.linked++;
          changed = true;
        }
      }
      if (changed) {
        out.push(stamp({ ...next }, now));
        res.updated++;
      } else res.unchanged++;
      continue;
    }
    const e = stamp({ ...inc, flightId: inc.flightId ?? null } as RosterEvent, now);
    if (isFlight(e.kind)) {
      const f = flightFor(e, flights, taken);
      if (f) {
        e.flightId = f.id;
        taken.add(f.id);
        res.linked++;
      }
    }
    out.push(e);
    res.added++;
  }

  // gone from the new print: removed, except a duty already logged (the flight happened)
  for (const e of inWindow) {
    if (matched.has(e.id) || e.flightId) continue;
    out.push({ ...e, deletedAt: now, updatedAt: now });
    res.removed++;
  }
  res.put = out;
  return res;
}
