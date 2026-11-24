import { icalToRosterEvent, parseIcal } from "./ical";
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
}

const content = (e: Partial<RosterEvent>) =>
  JSON.stringify([e.kind, e.title ?? null, e.startUtc, e.endUtc, e.flightNumber ?? null, e.depIcao ?? null, e.arrIcao ?? null, e.aircraftReg ?? null, e.aircraftTypeIcao ?? null, !!e.tentative]);

export function mergeCalendarFeed(
  ics: string,
  ctx: { pilotId: string; rosterId: string; existing: RosterEvent[]; flights?: Flight[]; iataToIcao: (iata: string) => string | undefined; keepAll?: boolean; now?: string },
): FeedMerge {
  const now = ctx.now ?? new Date().toISOString();
  const res: FeedMerge = { put: [], added: 0, updated: 0, removed: 0, skipped: 0 };
  const mine = ctx.existing.filter((e) => e.rosterId === ctx.rosterId && !e.deletedAt);
  const byUid = new Map(mine.filter((e) => e.externalUid).map((e) => [e.externalUid!, e]));
  const seen = new Set<string>();
  for (const ev of parseIcal(ics)) {
    const inc = icalToRosterEvent(ev, ctx.pilotId, ctx.iataToIcao);
    // a mixed calendar: an event that does not read as a duty (no route, no duty word) is a personal entry
    if (!ctx.keepAll && inc.kind === "OTHER" && !(inc.depIcao && inc.arrIcao)) {
      res.skipped++;
      continue;
    }
    const uid = inc.externalUid ?? `${inc.startUtc}|${inc.title}`;
    seen.add(uid);
    const prev = byUid.get(uid);
    const next = { ...prev, ...inc, externalUid: uid, rosterId: ctx.rosterId, flightId: prev?.flightId ?? null, deletedAt: null } as RosterEvent;
    if (prev) {
      if (content(prev) !== content(next)) {
        res.put.push(stamp({ ...next, id: prev.id, createdAt: prev.createdAt }, now));
        res.updated++;
      }
    } else {
      res.put.push(stamp(next, now));
      res.added++;
    }
  }
  // gone from the feed: removed, unless the duty was flown
  for (const e of mine) {
    if (!e.externalUid || seen.has(e.externalUid) || e.flightId) continue;
    res.put.push({ ...e, deletedAt: now, updatedAt: now });
    res.removed++;
  }
  return res;
}
