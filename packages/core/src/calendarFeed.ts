import { icalToRosterEvent, parseIcal } from "./ical";
import { flightForDuty, rosterDistance } from "./rosterMerge";
import { stamp } from "./store";
import type { Flight, RosterEvent } from "./types";

/**
 * A calendar the pilot subscribes to (an iCloud, Google or Outlook calendar shared as an iCal link, or the
 * webcal feed of a crew portal), synced again and again. The feed is the truth for what it holds: each event is
 * matched by its UID and updated in place, so a duty already logged keeps its flight; an event the feed no
 * longer has is removed, unless it was flown. Personal entries of a mixed calendar (a dentist, a birthday) are
 * left out: only what reads as a duty is kept.
 */

/** https URL of a calendar link, or null: webcal:// becomes https://, anything else than http(s) is refused. */
export function feedUrl(input: string): string | null {
  const s = input.trim().replace(/^webcals?:\/\//i, "https://");
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Where the link comes from, to name it in the app (never the secret part of the address). */
export function feedLabel(url: string): string {
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (/(^|\.)icloud\.com$/.test(h)) return "iCloud";
    if (/(^|\.)google\.com$/.test(h)) return "Google";
    if (/outlook\.(com|office365\.com|live\.com)$|office\.com$/.test(h)) return "Outlook";
    return h.replace(/^www\./, "");
  } catch {
    return "Calendar";
  }
}

export interface FeedMerge {
  put: RosterEvent[];
  added: number;
  updated: number;
  removed: number;
  /** events of the feed left out as personal entries */
  skipped: number;
  /** duties already in the app from another import, taken over by the feed instead of doubled */
  merged: number;
  /** duties linked to a flight already in the logbook */
  linked: number;
}

const content = (e: Partial<RosterEvent>) =>
  JSON.stringify([e.kind, e.title ?? null, e.startUtc, e.endUtc, e.flightNumber ?? null, e.depIcao ?? null, e.arrIcao ?? null, e.aircraftReg ?? null, e.aircraftTypeIcao ?? null, !!e.tentative]);

export function mergeCalendarFeed(
  ics: string,
  ctx: { pilotId: string; rosterId: string; existing: RosterEvent[]; flights?: Flight[]; iataToIcao: (iata: string) => string | undefined; keepAll?: boolean; now?: string },
): FeedMerge {
  const now = ctx.now ?? new Date().toISOString();
  const res: FeedMerge = { put: [], added: 0, updated: 0, removed: 0, skipped: 0, merged: 0, linked: 0 };
  const alive = ctx.existing.filter((e) => !e.deletedAt);
  const mine = alive.filter((e) => e.rosterId === ctx.rosterId);
  // the same duties already in the app from another import (a printed roster, an earlier file): the feed takes
  // them over instead of adding them a second time
  const others = alive.filter((e) => e.rosterId !== ctx.rosterId && (!e.pilotId || e.pilotId === ctx.pilotId));
  const byUid = new Map(mine.filter((e) => e.externalUid).map((e) => [e.externalUid!, e]));
  const taken = new Set(alive.map((e) => e.flightId).filter((x): x is string => !!x));
  const flights = ctx.flights ?? [];
  const incoming: { inc: ReturnType<typeof icalToRosterEvent>; uid: string }[] = [];
  for (const ev of parseIcal(ics)) {
    const inc = icalToRosterEvent(ev, ctx.pilotId, ctx.iataToIcao);
    // a mixed calendar: an event that does not read as a duty (no route, no duty word) is a personal entry
    if (!ctx.keepAll && inc.kind === "OTHER" && !(inc.depIcao && inc.arrIcao)) {
      res.skipped++;
      continue;
    }
    incoming.push({ inc, uid: inc.externalUid ?? `${inc.startUtc}|${inc.title}` });
  }
  // the feed's own events, by UID first; some crew portals (Leon) give an event a new UID at each reading, so an
  // event of the feed that no UID matches is the same duty as before when it has the same route around the same time
  const used = new Set<string>();
  const prevOf = new Map<string, RosterEvent>();
  for (const { uid } of incoming) {
    const p = byUid.get(uid);
    if (p && !used.has(p.id)) {
      prevOf.set(uid, p);
      used.add(p.id);
    }
  }
  const closest = (inc: (typeof incoming)[number]["inc"], pool: RosterEvent[]) => {
    let best: RosterEvent | undefined;
    let bestD = Infinity;
    for (const o of pool) {
      if (used.has(o.id)) continue;
      const d = rosterDistance(inc, o);
      // on a tie, the copy already linked to the logbook
      if (d !== null && (d < bestD || (d === bestD && o.flightId && !best?.flightId))) {
        best = o;
        bestD = d;
      }
    }
    if (best) used.add(best.id);
    return best;
  };
  for (const { inc, uid } of incoming) {
    if (!prevOf.has(uid)) {
      const p = closest(inc, mine);
      if (p) prevOf.set(uid, p);
    }
  }
  for (const { inc, uid } of incoming) {
    const prev = prevOf.get(uid);
    // the same duty already in the app from another import: taken over (or, when the feed has it, removed)
    const twin = closest(inc, others);
    const base = prev ?? twin;
    const next = { ...base, ...inc, externalUid: uid, rosterId: ctx.rosterId, flightId: prev?.flightId ?? twin?.flightId ?? null, deletedAt: null } as RosterEvent;
    if (twin && prev) {
      res.put.push({ ...twin, flightId: null, deletedAt: now, updatedAt: now });
      res.merged++;
    } else if (twin) res.merged++;
    // a duty already flown and logged is linked to its flight, so it is not offered again as a flight to log
    let linked = false;
    if (!next.flightId && (next.kind === "FLIGHT" || next.kind === "DEADHEAD")) {
      const f = flightForDuty(next, flights, taken);
      if (f) {
        next.flightId = f.id;
        taken.add(f.id);
        res.linked++;
        linked = true;
      }
    }
    if (base) {
      if (linked || base !== prev || content(base) !== content(next) || (base.flightId ?? null) !== (next.flightId ?? null)) {
        res.put.push(stamp({ ...next, id: base.id, createdAt: base.createdAt }, now));
        res.updated++;
      }
    } else {
      res.put.push(stamp(next, now));
      res.added++;
    }
  }
  // gone from the feed: removed, unless the duty was flown
  for (const e of mine) {
    if (used.has(e.id) || e.flightId) continue;
    res.put.push({ ...e, deletedAt: now, updatedAt: now });
    res.removed++;
  }
  return res;
}
