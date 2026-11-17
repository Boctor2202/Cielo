"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { createSupabaseSync, type SupabaseSync, type SyncResult } from "@cielo/sync";
import { localStore } from "./db";
import { adoptPilotId, dedupeAircraft, dedupeFlights } from "./repo";
import { supabase } from "./supabase";

interface CloudState {
  enabled: boolean;
  session: Session | null;
  lastSync: SyncResult | null;
  syncing: boolean;
  syncNow: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Calls an edge function as the signed-in user. */
  invoke: <T>(fn: string, body?: unknown) => Promise<T>;
}

const Ctx = createContext<CloudState>({
  enabled: false, session: null, lastSync: null, syncing: false,
  syncNow: async () => {}, signOut: async () => {}, invoke: async () => { throw new Error("cloud disabled"); },
});

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
      const merged = await adoptPilotId(session.user.id, session.user.email ?? undefined);
      if (stopped) return;
      let cleaned = !merged;
      engine.current = createSupabaseSync({
        supabase: sb,
        store: localStore,
        pilotId: session.user.id,
        onResult: (r) => {
          setLastSync(r);
          setSyncing(false);
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
  }, [sb]);

  const signOut = useCallback(async () => {
    engine.current?.stop();
    await sb?.auth.signOut();
  }, [sb]);

  return <Ctx.Provider value={{ enabled: !!sb, session, lastSync, syncing, syncNow, signOut, invoke }}>{children}</Ctx.Provider>;
}

export const useCloud = () => useContext(Ctx);
