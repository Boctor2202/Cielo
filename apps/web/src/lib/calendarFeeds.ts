import { feedUrl, mergeCalendarFeed, type Roster } from "@cielo/core";
import { loadAirports } from "./airports";
import { db, localStore } from "./db";
import { ensurePilot, put } from "./repo";
import { apiFetch } from "./report";

/**
 * Calendars the pilot subscribes to (iCloud, Google, Outlook or a crew portal's webcal link), kept as rosters
 * of source "ical_url" whose file name holds the link. Synced again at each launch when older than an hour,
 * and on demand; the same records sync to the app, which refreshes them the same way.
 */

const EVERY = 3_600_000;
const lastKey = (id: string) => `feed:sync:${id}`;

export type FeedError = "bad_url" | "signin" | "not_found" | "not_calendar" | "too_big" | "rate_limited" | "upstream";

export async function feedRosters(): Promise<Roster[]> {
  return (await db().t("rosters").toArray()).filter((r) => r.source === "ical_url" && !r.deletedAt && r.fileName);
}

export async function lastFeedSync(id: string): Promise<string | null> {
  return (await localStore.getMeta(lastKey(id))) ?? null;
}

/** Fetches one calendar and merges it into the roster. */
export async function syncFeed(roster: Roster): Promise<{ added: number; updated: number; removed: number } | { error: FeedError }> {
  const r = await apiFetch(`/api/calendar-feed?url=${encodeURIComponent(roster.fileName!)}`).catch(() => null);
  if (!r) return { error: "upstream" };
  if (!r.ok) return { error: (((await r.json().catch(() => ({}))) as { error?: FeedError }).error ?? "upstream") as FeedError };
  const ics = await r.text();
  const [airports, existing, flights, pilot] = await Promise.all([loadAirports(), db().t("roster_events").toArray(), db().t("flights").toArray(), ensurePilot()]);
  const m = mergeCalendarFeed(ics, { pilotId: pilot.id, rosterId: roster.id, existing, flights, iataToIcao: (c) => airports.iataToIcao(c) ?? undefined });
  if (m.put.length) await db().t("roster_events").bulkPut(m.put);
  await localStore.setMeta(lastKey(roster.id), new Date().toISOString());
  return { added: m.added, updated: m.updated, removed: m.removed };
}

/** Subscribes to a calendar link and reads it a first time. */
export async function subscribeFeed(input: string): Promise<{ roster: Roster; result: Awaited<ReturnType<typeof syncFeed>> } | { error: FeedError }> {
  const url = feedUrl(input);
  if (!url) return { error: "bad_url" };
  const same = (await feedRosters()).find((r) => r.fileName === url);
  const roster = same ?? (await put("rosters", { source: "ical_url", fileName: url, importedAt: new Date().toISOString() }));
  const result = await syncFeed(roster);
  // a link that cannot be read is not kept
  if ("error" in result && !same) await db().t("rosters").put({ ...roster, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  return "error" in result ? { error: result.error } : { roster, result };
}

/** Stops a subscription: its duties not yet flown leave the roster. */
export async function unsubscribeFeed(roster: Roster): Promise<void> {
  const now = new Date().toISOString();
  const events = (await db().t("roster_events").toArray()).filter((e) => e.rosterId === roster.id && !e.deletedAt && !e.flightId);
  if (events.length) await db().t("roster_events").bulkPut(events.map((e) => ({ ...e, deletedAt: now, updatedAt: now })));
  await db().t("rosters").put({ ...roster, deletedAt: now, updatedAt: now });
}

/** At launch: every subscription older than an hour is read again (quietly: an error waits for the next time). */
export async function syncFeedsIfStale(): Promise<number> {
  let n = 0;
  for (const r of await feedRosters()) {
    const last = await lastFeedSync(r.id);
    if (last && Date.now() - Date.parse(last) < EVERY) continue;
    const res = await syncFeed(r).catch(() => null);
    if (res && !("error" in res)) n += res.added + res.updated + res.removed;
  }
  return n;
}
