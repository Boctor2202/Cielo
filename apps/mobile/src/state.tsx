import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Platform } from "react-native";
import {
  accessFor,
  noCardTrialDays,
  flightRevision,
  stamp,
  type FlightRevision,
  type Access,
  type Aircraft,
  type AircraftType,
  type Flight,
  type Layover,
  type License,
  type Locale,
  type OpeningBalance,
  type Pilot,
  type RosterEvent,
  type SyncedRecord,
  type TableMap,
  type TableName,
  markPilotFields,
} from "@cielo/core";
import { SqliteStore } from "./db/sqliteStore";
import { ensureLocalPilot, seedReferenceData } from "./db/seed";
import { deviceLocale, translator, type TFunction } from "./i18n";
import { getSession, onAuthChange, signOut as authSignOut, supabase } from "./auth";
import { startSync, type SyncHandle } from "./sync";
import { cancelAllLicenseAlerts, scheduleLicenseAlerts } from "./notifications";
import { setSyncStatus } from "./syncStatus";
import { currencyFor, scheduleCurrencyAlerts } from "./currencyAlerts";
import { identify } from "./purchases";

export interface AppData {
  pilot: Pilot;
  flights: Flight[];
  aircraft: Aircraft[];
  aircraftTypes: AircraftType[];
  licenses: License[];
  rosterEvents: RosterEvent[];
  balances: OpeningBalance[];
  layovers: Layover[];
}

export interface AppState extends AppData {
  store: SqliteStore;
  locale: Locale;
  t: TFunction;
  session: Session | null;
  /** plan granted now: trial/demo, Basic, Max (premium) or read-only (same rules as the web app) */
  access: Access;
  /** Upsert (sets updatedAt via stamp) and reload. */
  put<T extends TableName>(table: T, row: Partial<TableMap[T]>): Promise<TableMap[T]>;
  /** Soft delete (deletedAt) so the deletion propagates through sync. */
  remove(table: TableName, id: string): Promise<void>;
  savePilot(patch: Partial<Pilot>): Promise<void>;
  reload(): Promise<void>;
  wipeAll(): Promise<void>;
  signOut(): Promise<void>;
}

export class ReadOnlyError extends Error {
  constructor() {
    super("read_only");
  }
}

const Ctx = createContext<AppState | null>(null);
const BootCtx = createContext<{ error: Error | null }>({ error: null });

const alive = <T extends SyncedRecord>(rows: T[]) => rows.filter((r) => !r.deletedAt);

async function loadAll(store: SqliteStore): Promise<AppData> {
  const pilot = await ensureLocalPilot(store);
  const [flights, aircraft, aircraftTypes, licenses, rosterEvents, balances, layovers] = await Promise.all([
    store.all("flights"),
    store.all("aircraft"),
    store.all("aircraft_types"),
    store.all("licenses"),
    store.all("roster_events"),
    store.all("opening_balances"),
    store.all("layovers"),
  ]);
  return {
    pilot,
    flights: alive(flights).sort((a, b) => (b.outUtc ?? b.date).localeCompare(a.outUtc ?? a.date)),
    aircraft: alive(aircraft).sort((a, b) => a.registration.localeCompare(b.registration)),
    aircraftTypes: alive(aircraftTypes).sort((a, b) => a.icao.localeCompare(b.icao)),
    licenses: alive(licenses),
    rosterEvents: alive(rosterEvents).sort((a, b) => a.startUtc.localeCompare(b.startUtc)),
    balances: alive(balances),
    layovers: alive(layovers).sort((a, b) => (b.arrivalUtc ?? b.createdAt).localeCompare(a.arrivalUtc ?? a.createdAt)),
  };
}

export function AppProvider({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  const [store, setStore] = useState<SqliteStore | null>(null);
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const syncRef = useRef<SyncHandle | null>(null);

  useEffect(() => {
    (async () => {
      const s = await SqliteStore.open();
      await seedReferenceData(s);
      const loaded = await loadAll(s);
      setData(loaded);
      setStore(s);
      // Re-arm expiry reminders at launch (they may have been cleared by the OS or a reinstall).
      if (loaded.licenses.some((l) => l.validUntil)) {
        void scheduleLicenseAlerts(loaded.licenses, translator(loaded.pilot.locale), loaded.pilot.locale, false).catch(() => undefined);
      }
      void scheduleCurrencyAlerts(currencyFor(loaded.flights, loaded.aircraftTypes, loaded.licenses, loaded.pilot), translator(loaded.pilot.locale), loaded.pilot.locale).catch(() => undefined);
    })().catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))));
  }, []);

  const reload = useCallback(async () => {
    if (!store) return;
    const next = await loadAll(store);
    setData(next);
    // documents may have arrived from the cloud: keep the reminders in step (no permission prompt here)
    void scheduleLicenseAlerts(next.licenses, translator(next.pilot.locale), next.pilot.locale, false).catch(() => undefined);
    void scheduleCurrencyAlerts(currencyFor(next.flights, next.aircraftTypes, next.licenses, next.pilot), translator(next.pilot.locale), next.pilot.locale).catch(() => undefined);
  }, [store]);

  // Auth session (cloud mode only).
  useEffect(() => {
    if (!supabase) return;
    getSession().then(setSession).catch(() => undefined);
    return onAuthChange(setSession);
  }, []);

  // Sync hook point + pilot e-mail / purchases identity once signed in.
  const pilotId = data?.pilot.id;
  useEffect(() => {
    if (!store || !pilotId || !session || !supabase) return;
    let cancelled = false;
    (async () => {
      const p = await store.get("pilots", pilotId);
      if (p && !p.email && session.user.email) {
        await store.bulkPut("pilots", [stamp({ ...p, email: session.user.email })]);
        await markPilotFields(store, ["email"]);
      }
      await identify(session.user.id);
      const handle = await startSync({ supabase: supabase!, store, pilotId, onChange: () => void reload() });
      if (cancelled) return handle.stop();
      syncRef.current = handle;
      await handle.syncNow();
      await reload();
    })().catch((e) => console.warn("[sync]", e));
    return () => {
      cancelled = true;
      syncRef.current?.stop();
      syncRef.current = null;
    };
  }, [store, pilotId, session, reload]);

  const locale: Locale = data?.pilot.locale ?? deviceLocale();
  const t = useMemo(() => translator(locale), [locale]);

  const value = useMemo<AppState | null>(() => {
    if (!store || !data) return null;
    // the trial runs from the account's creation, not from the day the app was first opened on this phone
    const access = accessFor(data.pilot, { signedIn: !!session, accountCreatedAt: session?.user.created_at, noCardTrialDays: noCardTrialDays(process.env.EXPO_PUBLIC_NO_CARD_TRIAL_DAYS) });
    const put: AppState["put"] = async (table, row) => {
      // read-only without a live subscription (the pilot's own settings stay editable)
      if (!access.canWrite && table !== "pilots") throw new ReadOnlyError();
      const rec = stamp(row as Partial<SyncedRecord>) as unknown as TableMap[typeof table];
      // the flight's audit trail: what changed, field by field (read before the write)
      const prevFlight = table === "flights" ? await store.get("flights", (rec as { id: string }).id) : undefined;
      await store.bulkPut(table, [rec]);
      if (table === "flights") {
        const r = flightRevision(prevFlight, rec as unknown as Flight, Platform.OS === "android" ? "android" : "ios");
        if (r) await store.bulkPut("flight_revisions", [stamp(r as Partial<SyncedRecord>) as unknown as FlightRevision]);
      }
      const next = await loadAll(store);
      setData(next);
      if (table === "licenses") void scheduleLicenseAlerts(next.licenses, t, locale).catch(() => undefined);
      if (table === "flights" || table === "licenses" || table === "pilots")
        void scheduleCurrencyAlerts(currencyFor(next.flights, next.aircraftTypes, next.licenses, next.pilot), t, locale).catch(() => undefined);
      void syncRef.current?.refresh().catch(() => undefined);
      void syncRef.current?.syncNow().catch(() => undefined);
      return rec;
    };
    return {
      ...data,
      store,
      locale,
      t,
      session,
      access,
      put,
      async remove(table, id) {
        const row = await store.get(table, id);
        if (!row) return;
        await put(table, { ...row, deletedAt: new Date().toISOString() } as Partial<TableMap[typeof table]>);
      },
      async savePilot(patch) {
        // from the stored copy (the screen's may be older), and only these fields are pushed
        const cur = (await store.get("pilots", data.pilot.id)) ?? data.pilot;
        await put("pilots", { ...cur, ...patch });
        await markPilotFields(store, Object.keys(patch));
      },
      reload,
      async wipeAll() {
        syncRef.current?.stop();
        await cancelAllLicenseAlerts().catch(() => undefined);
        await store.clear();
        await seedReferenceData(store);
        setData(await loadAll(store));
      },
      async signOut() {
        // last changes to the server first: the logbook lives on in the account
        await syncRef.current?.syncNow().catch(() => undefined);
        syncRef.current?.stop();
        syncRef.current = null;
        await authSignOut();
        setSyncStatus({ mode: "local", pending: 0, pendingFlightIds: new Set() });
        setSession(null);
        // then the phone is cleared: the next person or account starts clean, and signing back in brings it all back
        await cancelAllLicenseAlerts().catch(() => undefined);
        await store.clear();
        await seedReferenceData(store);
        setData(await loadAll(store));
      },
    };
  }, [store, data, locale, t, session, reload]);

  return (
    <BootCtx.Provider value={{ error }}>
      {value ? <Ctx.Provider value={value}>{children}</Ctx.Provider> : fallback}
    </BootCtx.Provider>
  );
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}

export const useBootError = () => useContext(BootCtx).error;

/** Today's UTC calendar date (logbook dates are UTC). */
export const todayUtc = () => new Date().toISOString().slice(0, 10);
