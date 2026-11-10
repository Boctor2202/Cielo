import { stamp, type AircraftType, type LocalStore, type Pilot } from "@cielo/core";
import { AIRCRAFT_TYPES } from "@cielo/reference-data";
import { deviceLocale } from "../i18n";

const SEED_KEY = "seed.aircraftTypes";
/** Reference rows get an old timestamp so the sync engine never treats them as local changes. */
const REFERENCE_STAMP = "2000-01-01T00:00:00.000Z";
export const PILOT_ID_KEY = "pilotId";

/** Seeds (or tops up) the public aircraft types shipped with @cielo/reference-data. Idempotent. */
export async function seedReferenceData(store: LocalStore): Promise<void> {
  const version = String(AIRCRAFT_TYPES.length);
  if ((await store.getMeta(SEED_KEY)) === version) return;
  const rows: AircraftType[] = AIRCRAFT_TYPES.map((t) => ({ ...t, createdAt: REFERENCE_STAMP, updatedAt: REFERENCE_STAMP, deletedAt: null }));
  await store.bulkPut("aircraft_types", rows);
  await store.setMeta(SEED_KEY, version);
}

/** Returns the local pilot, creating it on first launch (local mode works without any account). */
export async function ensureLocalPilot(store: LocalStore): Promise<Pilot> {
  const id = await store.getMeta(PILOT_ID_KEY);
  if (id) {
    const existing = await store.get("pilots", id);
    if (existing) return existing;
  }
  const pilot = stamp<Partial<Pilot>>({
    email: "",
    fullName: "",
    locale: deviceLocale(),
    regulatoryFramework: "EASA",
    defaultFunction: "PIC",
    defaultIfr: "ask",
    defaultPilotFlying: "always",
    timeDisplay: "hhmm",
    subscriptionTier: "free",
    subscriptionSource: null,
    subscriptionExpiresAt: null,
  }) as Pilot;
  await store.bulkPut("pilots", [pilot]);
  await store.setMeta(PILOT_ID_KEY, pilot.id);
  return pilot;
}

