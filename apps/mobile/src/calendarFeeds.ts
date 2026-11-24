import { feedUrl, mergeCalendarFeed, stamp, type Pilot, type Roster, type RosterEvent } from "@cielo/core";
import { airports } from "./airports";
import { API_URL } from "./api";
import type { SqliteStore } from "./db/sqliteStore";

/**
 * Calendars the pilot subscribes to for the roster (iCloud, Google, Outlook, a crew portal's webcal link): rosters
 * of source "ical_url" whose file name holds the link, the same records as on the website. Read through the
 * website (the calendar servers do not answer an app directly the same way everywhere), again at launch when
 * older than an hour.
 */

const EVERY = 3_600_000;
const lastKey = (id: string) => `feed:sync:${id}`;
export type FeedError = "bad_url" | "signin" | "not_found" | "not_calendar" | "too_big" | "rate_limited" | "upstream";
export type FeedResult = { added: number; updated: number; removed: number } | { error: FeedError };

export async function feedRosters(store: SqliteStore): Promise<Roster[]> {
  return (await store.all("rosters")).filter((r) => r.source === "ical_url" && !r.deletedAt && r.fileName);
}

export const lastFeedSync = async (store: SqliteStore, id: string) => (await store.getMeta(lastKey(id))) ?? null;

export async function syncFeed(store: SqliteStore, pilot: Pilot, roster: Roster, token?: string): Promise<FeedResult> {
  if (!token) return { error: "signin" };
  const r = await fetch(`${API_URL}/api/calendar-feed?url=${encodeURIComponent(roster.fileName!)}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
  if (!r) return { error: "upstream" };
  if (!r.ok) return { error: (((await r.json().catch(() => ({}))) as { error?: FeedError }).error ?? "upstream") as FeedError };
  const ics = await r.text();
  const [existing, flights] = await Promise.all([store.all("roster_events"), store.all("flights")]);
  const m = mergeCalendarFeed(ics, { pilotId: pilot.id, rosterId: roster.id, existing, flights, iataToIcao: (c) => airports().iataToIcao(c) ?? undefined });
  if (m.put.length) await store.bulkPut("roster_events", m.put);
  await store.setMeta(lastKey(roster.id), new Date().toISOString());
  return { added: m.added, updated: m.updated, removed: m.removed };
}

export async function subscribeFeed(store: SqliteStore, pilot: Pilot, input: string, token?: string): Promise<FeedResult> {
  const url = feedUrl(input);
  if (!url) return { error: "bad_url" };
  if (!token) return { error: "signin" };
  const same = (await feedRosters(store)).find((r) => r.fileName === url);
  const roster = same ?? (stamp({ pilotId: pilot.id, source: "ical_url", fileName: url, importedAt: new Date().toISOString() } as Roster) as Roster);
  if (!same) await store.bulkPut("rosters", [roster]);
  const res = await syncFeed(store, pilot, roster, token);
  if ("error" in res && !same) await store.bulkPut("rosters", [stamp({ ...roster, deletedAt: new Date().toISOString() }) as Roster]);
  return res;
}

export async function unsubscribeFeed(store: SqliteStore, roster: Roster): Promise<void> {
  const now = new Date().toISOString();
  const events = (await store.all("roster_events")).filter((e) => e.rosterId === roster.id && !e.deletedAt && !e.flightId);
  if (events.length) await store.bulkPut("roster_events", events.map((e) => stamp({ ...e, deletedAt: now }, now) as RosterEvent));
  await store.bulkPut("rosters", [stamp({ ...roster, deletedAt: now }, now) as Roster]);
}

export async function syncFeedsIfStale(store: SqliteStore, pilot: Pilot, token?: string): Promise<number> {
  if (!token) return 0;
  let n = 0;
  for (const r of await feedRosters(store)) {
    const last = await lastFeedSync(store, r.id);
    if (last && Date.now() - Date.parse(last) < EVERY) continue;
    const res = await syncFeed(store, pilot, r, token).catch(() => null);
    if (res && !("error" in res)) n += res.added + res.updated + res.removed;
  }
  return n;
}
