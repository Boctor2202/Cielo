/**
 * Cloud sync: the UI only ever talks to the LocalStore (SQLite); @cielo/sync pushes local changes
 * and pulls server changes (last-write-wins on updatedAt) every minute while signed in.
 * `startSync` is called by AppProvider when a Supabase session exists, and `stop()` on sign-out.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { SYNC_TABLES, type LocalStore } from "@cielo/core";
import { createSupabaseSync } from "@cielo/sync";
import { PILOT_ID_KEY } from "./db/seed";

export interface SyncHandle {
  syncNow(): Promise<void>;
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
  if (!accountId) return { async syncNow() {}, stop() {} };
  if (await adoptAccountId(store, pilotId, accountId)) {
    // The pilot id changed: AppProvider reloads and calls startSync again with the account id.
    onChange?.();
    return { async syncNow() {}, stop() {} };
  }
  const engine = createSupabaseSync({
    supabase,
    store,
    pilotId: accountId,
    onResult: (r) => {
      if (Object.values(r.pulled).some((n) => (n ?? 0) > 0)) onChange?.();
    },
  });
  engine.start(60_000);
  return {
    async syncNow() {
      await engine.syncNow();
    },
    stop: () => engine.stop(),
  };
}
