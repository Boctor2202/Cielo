/**
 * Storage contract shared by web (IndexedDB), mobile (SQLite) and the sync engine (Supabase).
 * Local-first: the UI only ever reads/writes the LocalStore; the sync engine pushes rows whose
 * updatedAt is newer than the last push and pulls rows changed on the server (last-write-wins on updatedAt).
 * Deletions are soft (deletedAt) so they propagate.
 */
import type {
  Aircraft, AircraftType, Flight, FlightRevision, FlightTrack, Layover, License, OpeningBalance, Pilot, Roster, RosterEvent, Signature, SyncedRecord,
} from "./types";

export interface TableMap {
  pilots: Pilot;
  aircraft_types: AircraftType;
  aircraft: Aircraft;
  flights: Flight;
  opening_balances: OpeningBalance;
  signatures: Signature;
  licenses: License;
  rosters: Roster;
  roster_events: RosterEvent;
  layovers: Layover;
  flight_tracks: FlightTrack;
  flight_revisions: FlightRevision;
}

export type TableName = keyof TableMap;

export const SYNC_TABLES: TableName[] = [
  "pilots", "aircraft_types", "aircraft", "flights", "opening_balances", "signatures", "licenses", "rosters", "roster_events", "layovers", "flight_tracks", "flight_revisions",
];

export interface LocalStore {
  all<T extends TableName>(table: T): Promise<TableMap[T][]>;
  get<T extends TableName>(table: T, id: string): Promise<TableMap[T] | undefined>;
  /** Writes rows as-is (caller sets updatedAt). */
  bulkPut<T extends TableName>(table: T, rows: TableMap[T][]): Promise<void>;
  changedSince<T extends TableName>(table: T, isoUtc: string): Promise<TableMap[T][]>;
  getMeta(key: string): Promise<string | undefined>;
  setMeta(key: string, value: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * The profile fields changed on this device since its last push. The profile is one row edited from several
 * devices: pushing the whole row would let a device with an old copy wipe what another one saved (a name, say).
 * Once a device has pushed its profile, only the fields listed here are sent.
 */
export const PILOT_DIRTY_KEY = "dirty:pilots";

export async function markPilotFields(store: Pick<LocalStore, "getMeta" | "setMeta">, fields: string[]): Promise<void> {
  if (!fields.length) return;
  const raw = await store.getMeta(PILOT_DIRTY_KEY);
  const prev: string[] = raw ? (JSON.parse(raw) as string[]) : [];
  await store.setMeta(PILOT_DIRTY_KEY, JSON.stringify([...new Set([...prev, ...fields])]));
}

export function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function stamp<T extends Partial<SyncedRecord>>(rec: T, now = new Date().toISOString()): T & SyncedRecord {
  return { ...rec, id: rec.id ?? newId(), createdAt: rec.createdAt ?? now, updatedAt: now, deletedAt: rec.deletedAt ?? null } as T & SyncedRecord;
}

/** camelCase <-> snake_case for Postgres columns. */
export const toSnake = (k: string) => k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
export const toCamel = (k: string) => k.replace(/_([a-z0-9])/g, (_, m: string) => m.toUpperCase());

export function rowToDb(rec: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) out[toSnake(k)] = v === undefined ? null : v;
  return out;
}

export function rowFromDb<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (v !== null) out[toCamel(k)] = v;
  return out as T;
}
