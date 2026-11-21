"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { SYNC_TABLES } from "@cielo/core";
import { createSupabaseSync, lastPushKey, restoreLogbook, snapshotLogbook, unsyncedCount, type SupabaseSync, type SyncResult } from "@cielo/sync";
import { dropRescue, saveRescue, takeRescue } from "./rescue";
import { DEMO_META, localStore } from "./db";
import { adoptPilotId, dedupeAircraft, dedupeFlights, deleteAllLocal } from "./repo";
import { supabase } from "./supabase";

interface CloudState {
  enabled: boolean;
  session: Session | null;
  lastSync: SyncResult | null;
  syncing: boolean;
  syncNow: () => Promise<void>;
  signOut: (opts?: { forget?: boolean }) => Promise<void>;
  /** Calls an edge function as the signed-in user. */
  invoke: <T>(fn: string, body?: unknown) => Promise<T>;
}

const Ctx = createContext<CloudState>({
  enabled: false, session: null, lastSync: null, syncing: false,
  syncNow: async () => {}, signOut: async () => {}, invoke: async () => { throw new Error("cloud disabled"); },
});

/** The account this browser's logbook belongs to (recorded once it has synced with it). */
const OWNER_KEY = "sync.accountOwner";

/**
 * Whose logbook this browser holds: the recorded account, else inferred from the sync marks (a browser that has
 * pushed belongs to its local pilot, unless every push predates the signed-in account: then another account's).
 * null: a logbook only used locally, never synced, which may join the account.
 */
async function ownerOf(accountCreatedAt: string | undefined): Promise<string | null> {
  const recorded = await localStore.getMeta(OWNER_KEY);
  if (recorded) return recorded;
  let pushed: string | null = null;
  for (const t of SYNC_TABLES) {
    if (t === "pilots") continue;
    const at = await localStore.getMeta(lastPushKey(t));
    if (at && (!pushed || at > pushed)) pushed = at;
  }
  if (!pushed) return null;
  if (accountCreatedAt && pushed < accountCreatedAt) return "another-account";
  return (await localStore.getMeta("pilotId")) ?? "another-account";
}

/** Signs in (Supabase), rebinds the local logbook to the account and keeps it in sync every minute. */
export function CloudProvider({ children }: { children: ReactNode }) {
  const sb = supabase();
  const [session, setSession] = useState<Session | null>(null);
  const [lastSync, setLastSync] = useState<SyncResult | null>(null);
  const [syncing, setSyncing] = useState(false);
  const engine = useRef<SupabaseSync | null>(null);

  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((e, s) => {
      setSession(s);
      // arrived from the password e-mail's link (until codes replace links): ask for the new password
      if (e === "PASSWORD_RECOVERY" && !/[?&]reset=1/.test(window.location.search)) {
        const lang = window.location.pathname.split("/")[1] === "en" ? "en" : "fr";
        window.location.assign(`/${lang}/${lang === "en" ? "login" : "connexion"}?reset=1`);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [sb]);

  useEffect(() => {
    if (!sb || !session) return;
    let stopped = false;
    (async () => {
      // the fictional demo logbook stays out of a real account: this browser starts again from the account's data
      if ((await localStore.getMeta(DEMO_META)) === "1") await deleteAllLocal();
      // another account's logbook in this browser (someone signed in with a different account): it is on the server
      // under its own account already, so the browser starts clean and pulls this account's data. Never re-key it.
      const owner = await ownerOf(session.user.created_at);
      if (owner && owner !== session.user.id) {
        // what the other account had not sent yet is kept aside on this browser, restored when it signs in again
        const other = (await localStore.getMeta("pilotId")) ?? owner;
        if ((await unsyncedCount(localStore, other).catch(() => 0)) > 0) await saveRescue(await snapshotLogbook(localStore, other));
        await deleteAllLocal();
      }
      const merged = await adoptPilotId(session.user.id, session.user.email ?? undefined);
      if (stopped) return;
      let cleaned = !merged;
      let rescued = false;
      engine.current = createSupabaseSync({
        supabase: sb,
        store: localStore,
        pilotId: session.user.id,
        onResult: (r) => {
          setLastSync(r);
          setSyncing(false);
          if (r.ok) void localStore.setMeta(OWNER_KEY, session.user.id);
          // a copy of this account's logbook kept on this browser when it was signed out before everything was sent
          if (r.ok && !rescued) {
            rescued = true;
            void takeRescue(session.user.id).then(async (copy) => {
              if (!copy) return;
              const n = await restoreLogbook(localStore, copy);
              await dropRescue(session.user.id);
              if (n) void engine.current?.syncNow();
            });
          }
          // first sync after this browser's logbook joined the account: drop flights it already had
          if (!cleaned && r.ok) {
            cleaned = true;
            void Promise.all([dedupeFlights(), dedupeAircraft()]).then(([n, m]) => {
              if (n || m) void engine.current?.syncNow();
            });
          }
        },
      });
      engine.current.start(60_000);
    })();
    const online = () => engine.current?.syncNow();
    window.addEventListener("online", online);
    return () => {
      stopped = true;
      window.removeEventListener("online", online);
      engine.current?.stop();
      engine.current = null;
    };
  }, [sb, session]);

  const syncNow = useCallback(async () => {
    if (!engine.current) return;
    setSyncing(true);
    await engine.current.syncNow();
  }, []);

  const invoke = useCallback(async <T,>(fn: string, body?: unknown) => {
    if (!sb) throw new Error("cloud disabled");
    const { data, error } = await sb.functions.invoke(fn, { body: body as Record<string, unknown> });
    if (error) throw error;
    return data as T;
  }, [sb, session]);

  /**
   * Sign-out: what is not on the server yet is sent first, then this browser forgets the logbook (it stays in the
   * account), so the next person to sign in here never sees it nor gets it merged into their account.
   */
  const signOut = useCallback(async (opts?: { forget?: boolean }) => {
    try {
      await Promise.race([engine.current?.syncNow(), new Promise((r) => setTimeout(r, 8000))]);
    } catch {}
    // not everything reached the server (no network, server down): a full copy stays on this browser, merged back
    // and sent when this account signs in here again. Not after deleting the account (forget).
    const me = session?.user.id;
    if (me && !opts?.forget && (await unsyncedCount(localStore, me).catch(() => 0)) > 0) await saveRescue(await snapshotLogbook(localStore, me));
    if (me && opts?.forget) await dropRescue(me);
    engine.current?.stop();
    engine.current = null;
    // this browser only: the phone app stays signed in
    await sb?.auth.signOut({ scope: "local" });
    await deleteAllLocal();
    const lang = window.location.pathname.split("/")[1] === "en" ? "en" : "fr";
    window.location.assign(`/${lang}/${lang === "en" ? "login" : "connexion"}`);
  }, [sb]);

  return <Ctx.Provider value={{ enabled: !!sb, session, lastSync, syncing, syncNow, signOut, invoke }}>{children}</Ctx.Provider>;
}

export const useCloud = () => useContext(Ctx);
