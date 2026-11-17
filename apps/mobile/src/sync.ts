/**
 * Cloud sync: the UI only ever talks to the LocalStore (SQLite); @cielo/sync pushes local changes
 * and pulls server changes (last-write-wins on updatedAt) every minute while signed in.
 * `startSync` is called by AppProvider when a Supabase session exists, and `stop()` on sign-out.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppState as RNAppState } from "react-native";
import { SYNC_TABLES, type LocalStore } from "@cielo/core";
import { createSupabaseSync, lastPushKey } from "@cielo/sync";
import { PILOT_ID_KEY } from "./db/seed";
import { isNetworkError, setSyncRequester, setSyncStatus } from "./syncStatus";

/** Rows changed on this phone since the last successful push, per the sync watermarks. */
export async function refreshPending(store: LocalStore, pilotId: string): Promise<void> {
  let pending = 0;
  const flightIds = new Set<string>();
  for (const table of SYNC_TABLES) {
    const since = (await store.getMeta(lastPushKey(table))) ?? "1970-01-01T00:00:00.000Z";
    const rows = (await store.changedSince(table, since)) as unknown as Record<string, unknown>[];
    const mine = rows.filter((r) => (table === "pilots" ? r.id === pilotId : table === "aircraft_types" ? r.ownerPilotId === pilotId : r.pilotId === pilotId));
    // the watermark is the updatedAt of the last row pushed: that row itself is already on the server
    const waiting = mine.filter((r) => String(r.updatedAt) > since);
    pending += waiting.length;
    if (table === "flights") for (const r of waiting) flightIds.add(String(r.id));
  }
  setSyncStatus({ pending, pendingFlightIds: flightIds });
}

export interface SyncHandle {
  syncNow(): Promise<void>;
  /** Recounts what is waiting on the phone (after a local change). */
  refresh(): Promise<void>;
  stop(): void;
}

export interface StartSyncArgs {
  supabase: SupabaseClient;
  store: LocalStore;
  pilotId: string;
  onChange?: () => void;
}

/** First sign-in after using the app offline: re-key local rows to the account id. */
async function adoptAccountId(store: LocalStore, localId: string, accountId: string): Promise<boolean> {
  if (localId === accountId) return false;
  const now = new Date().toISOString();
  for (const table of SYNC_TABLES) {
    const rows = (await store.all(table)) as unknown as Record<string, unknown>[];
    const changed = rows
      .filter((r) => (table === "pilots" ? r.id === localId : r.pilotId === localId))
      .map((r) => (table === "pilots" ? { ...r, id: accountId, updatedAt: now } : { ...r, pilotId: accountId, updatedAt: now }));
    if (changed.length) await store.bulkPut(table, changed as never);
  }
  await store.setMeta(PILOT_ID_KEY, accountId);
  return true;
}

export async function startSync({ supabase, store, pilotId, onChange }: StartSyncArgs): Promise<SyncHandle> {
  const { data } = await supabase.auth.getUser();
  const accountId = data.user?.id;
  if (!accountId) return { async syncNow() {}, async refresh() {}, stop() {} };
  if (await adoptAccountId(store, pilotId, accountId)) {
    // The pilot id changed: AppProvider reloads and calls startSync again with the account id.
    onChange?.();
    return { async syncNow() {}, async refresh() {}, stop() {} };
  }
  // A failed run is retried soon (10 s, 20 s, 40 s, then every minute) so flights logged without
  // network leave the phone as soon as it is back, without waiting for the next minute tick.
  let retry: ReturnType<typeof setTimeout> | null = null;
  let failures = 0;
  let stopped = false;
  const scheduleRetry = () => {
    if (retry || stopped) return;
    const delay = Math.min(60_000, 10_000 * 2 ** Math.min(failures - 1, 3));
    retry = setTimeout(() => {
      retry = null;
      void run();
    }, delay);
  };
  const engine = createSupabaseSync({
    supabase,
    store,
    pilotId: accountId,
    onResult: (r) => {
      if (Object.values(r.pulled).some((n) => (n ?? 0) > 0)) onChange?.();
      if (r.ok) {
        failures = 0;
        setSyncStatus({ mode: "idle", lastOkAt: r.finishedAt });
      } else {
        failures++;
        const offline = r.errors.every((e) => isNetworkError(e.message));
        setSyncStatus({ mode: offline ? "offline" : "error" });
        scheduleRetry();
      }
      void refreshPending(store, accountId).catch(() => undefined);
    },
  });
  const run = async () => {
    setSyncStatus({ mode: "syncing" });
    try {
      await engine.syncNow();
    } catch (e) {
      failures++;
      setSyncStatus({ mode: isNetworkError(e instanceof Error ? e.message : String(e)) ? "offline" : "error" });
      scheduleRetry();
    }
  };
  setSyncRequester(() => void run());
  // back in the app (often: back on the ground with network): sync at once
  const appState = RNAppState.addEventListener("change", (s) => {
    if (s === "active") void run();
  });
  await refreshPending(store, accountId).catch(() => undefined);
  engine.start(60_000);
  return {
    syncNow: run,
    refresh: () => refreshPending(store, accountId),
    stop: () => {
      stopped = true;
      if (retry) clearTimeout(retry);
      appState.remove();
      setSyncRequester(null);
      engine.stop();
    },
  };
}
