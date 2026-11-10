/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  SYNC HOOK POINT — @cielo/sync (being written in parallel, not a dependency yet)
 * ─────────────────────────────────────────────────────────────────────────────
 * The UI only ever talks to the LocalStore (SQLite). Once "@cielo/sync" is published in the
 * workspace, add it to package.json and replace the body of `startSync` with:
 *
 *   const { createSupabaseSync } = await import("@cielo/sync");
 *   const engine = createSupabaseSync({ supabase, store, pilotId });
 *   await engine.syncNow?.();
 *   return engine;
 *
 * `startSync` is called by AppProvider when a Supabase session exists, and `stop()` on sign-out.
 * `onChange` must be called by the engine after it pulled rows so the UI reloads.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LocalStore } from "@cielo/core";

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

export async function startSync(_args: StartSyncArgs): Promise<SyncHandle> {
  // TODO(@cielo/sync): wire createSupabaseSync({ supabase, store, pilotId }) here.
  return {
    async syncNow() {},
    stop() {},
  };
}
