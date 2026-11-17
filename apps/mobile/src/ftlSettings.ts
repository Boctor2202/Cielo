import { useEffect, useMemo, useSyncExternalStore } from "react";
import { getCalendars } from "expo-localization";
import { DEFAULT_FTL_SETTINGS, type FtlSettings, type Pilot } from "@cielo/core";
import { airports, lookupAirport } from "./airports";
import { useApp } from "./state";
import type { SqliteStore } from "./db/sqliteStore";

/**
 * The FTL estimate settings the pilot can change: kept on this device under the same "ftlSettings" meta key
 * and JSON shape as the web app (which also keeps them per device). The rules (ftlRegime) and the home base
 * live on the pilot record and sync. A stored homeTimezone is the pilot's explicit choice; without one, the
 * reference time follows the home base airport, then the device.
 */
export type FtlPrefs = Partial<Pick<FtlSettings, "reportBeforeMin" | "releaseAfterMin" | "homeTimezone">>;
const KEY = "ftlSettings";

let prefs: FtlPrefs = {};
let loadedFor: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());
const subscribe = (f: () => void) => (listeners.add(f), () => void listeners.delete(f));

const minutes = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(0, Math.round(v))) : undefined);

/** True when the runtime knows this IANA zone. */
export function isTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz }).format(0);
    return true;
  } catch {
    return false;
  }
}

async function load(store: SqliteStore, owner: string) {
  if (loadedFor === owner) return;
  loadedFor = owner;
  let next: FtlPrefs = {};
  try {
    const raw = await store.getMeta(KEY);
    const s = raw ? (JSON.parse(raw) as Partial<FtlSettings>) : {};
    next = {
      reportBeforeMin: minutes(s.reportBeforeMin, 180),
      releaseAfterMin: minutes(s.releaseAfterMin, 120),
      homeTimezone: typeof s.homeTimezone === "string" && isTimeZone(s.homeTimezone) ? s.homeTimezone : undefined,
    };
  } catch {
    next = {};
  }
  prefs = next;
  emit();
}

/** Saves a change (undefined clears it back to the default) and refreshes every screen using the settings. */
export async function saveFtlPrefs(store: SqliteStore, patch: FtlPrefs): Promise<void> {
  prefs = { ...prefs, ...patch };
  emit();
  const out = Object.fromEntries(Object.entries(prefs).filter(([, v]) => v !== undefined));
  await store.setMeta(KEY, JSON.stringify(out));
}

/** Reference time when the pilot has not chosen one: home base airport, else this device. */
export function autoTimezone(pilot: Pilot): string {
  let deviceTz: string | undefined;
  try {
    deviceTz = getCalendars()[0]?.timeZone ?? undefined;
  } catch {
    deviceTz = undefined;
  }
  const base = pilot.homeBaseIcao ? lookupAirport(pilot.homeBaseIcao) : undefined;
  return base?.timezone ?? deviceTz ?? DEFAULT_FTL_SETTINGS.homeTimezone;
}

/** FTL settings for the computation: the pilot's rules and base, this device's report/release times and zone. */
export function ftlSettingsFor(pilot: Pilot, p: FtlPrefs = prefs): FtlSettings {
  return {
    ...DEFAULT_FTL_SETTINGS,
    reportBeforeMin: p.reportBeforeMin ?? DEFAULT_FTL_SETTINGS.reportBeforeMin,
    releaseAfterMin: p.releaseAfterMin ?? DEFAULT_FTL_SETTINGS.releaseAfterMin,
    homeBaseIcao: pilot.homeBaseIcao,
    regime: pilot.ftlRegime ?? "oro",
    homeTimezone: p.homeTimezone ?? autoTimezone(pilot),
  };
}

/** The settings, loaded once from this device and kept in step across screens. */
export function useFtlSettings(): { settings: FtlSettings; prefs: FtlPrefs } {
  const { store, pilot } = useApp();
  // reloaded when the local pilot changes (sign-in, or a wipe of the phone's data)
  useEffect(() => void load(store, pilot.id), [store, pilot.id]);
  const p = useSyncExternalStore(subscribe, () => prefs);
  const settings = useMemo(() => ftlSettingsFor(pilot, p), [pilot, p]);
  return { settings, prefs: p };
}

const COMMON_ZONES = [
  "UTC",
  "Europe/London", "Europe/Dublin", "Europe/Lisbon", "Europe/Paris", "Europe/Brussels", "Europe/Amsterdam", "Europe/Luxembourg",
  "Europe/Zurich", "Europe/Berlin", "Europe/Madrid", "Europe/Rome", "Europe/Vienna", "Europe/Prague", "Europe/Warsaw",
  "Europe/Stockholm", "Europe/Oslo", "Europe/Copenhagen", "Europe/Helsinki", "Europe/Athens", "Europe/Istanbul", "Europe/Moscow",
  "Atlantic/Reykjavik", "Atlantic/Canary", "Africa/Casablanca", "Africa/Algiers", "Africa/Tunis", "Africa/Cairo", "Africa/Dakar",
  "Africa/Abidjan", "Africa/Lagos", "Africa/Nairobi", "Africa/Johannesburg", "Indian/Reunion", "Indian/Mauritius",
  "Asia/Dubai", "Asia/Qatar", "Asia/Riyadh", "Asia/Tel_Aviv", "Asia/Karachi", "Asia/Kolkata", "Asia/Bangkok", "Asia/Singapore",
  "Asia/Hong_Kong", "Asia/Shanghai", "Asia/Tokyo", "Asia/Seoul", "Australia/Perth", "Australia/Sydney", "Pacific/Auckland",
  "Pacific/Tahiti", "Pacific/Noumea", "America/Martinique", "America/Guadeloupe", "America/Cayenne", "America/Sao_Paulo",
  "America/Buenos_Aires", "America/Bogota", "America/Mexico_City", "America/New_York", "America/Toronto", "America/Montreal",
  "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu",
];

let zones: string[] | null = null;
/**
 * IANA zones to pick from: the runtime's own list when it has one (Intl.supportedValuesOf is missing on some
 * Hermes builds), otherwise every zone of the bundled airport database plus a short list of common ones.
 */
export function timeZones(): string[] {
  if (zones) return zones;
  const set = new Set<string>();
  try {
    const sv = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    for (const z of sv?.("timeZone") ?? []) set.add(z);
  } catch {
    // not available on this runtime
  }
  if (set.size === 0) {
    for (const z of COMMON_ZONES) set.add(z);
    for (const a of airports().list) if (a.timezone) set.add(a.timezone);
  }
  set.add("UTC");
  zones = [...set].filter(isTimeZone).sort();
  return zones;
}
