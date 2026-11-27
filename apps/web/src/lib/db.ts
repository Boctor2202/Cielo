"use client";

import Dexie, { type Table } from "dexie";
import { SYNC_TABLES, type LocalStore, type TableMap, type TableName } from "@cielo/core";

class CieloDB extends Dexie {
  meta!: Table<{ key: string; value: string }, string>;
  constructor() {
    super("cielo");
    const v1: Record<string, string> = { meta: "key" };
    for (const t of SYNC_TABLES) if (t !== "flight_tracks" && t !== "flight_revisions" && t !== "endorsements") v1[t] = "id, updatedAt";
    v1.flights = "id, updatedAt, date";
    v1.roster_events = "id, updatedAt, startUtc";
    this.version(1).stores(v1);
    // v2: real flight tracks (ADS-B)
    this.version(2).stores({ ...v1, flight_tracks: "id, updatedAt, flightId" });
    // v3: audit trail of the flights (every change, field by field)
    this.version(3).stores({ ...v1, flight_tracks: "id, updatedAt, flightId", flight_revisions: "id, updatedAt, flightId" });
    // v4: logbook endorsements (FAA)
    this.version(4).stores({ ...v1, flight_tracks: "id, updatedAt, flightId", flight_revisions: "id, updatedAt, flightId", endorsements: "id, updatedAt" });
  }
  t<T extends TableName>(name: T): Table<TableMap[T], string> {
    return this.table(name);
  }
}

let _db: CieloDB | null = null;
export function db(): CieloDB {
  if (!_db) _db = new CieloDB();
  return _db;
}

/** IndexedDB implementation of the shared LocalStore contract. */
/** Set while this browser holds the fictional demo logbook: it is never merged into a real account. */
export const DEMO_META = "demoData";

export const localStore: LocalStore = {
  all: (table) => db().t(table).toArray(),
  get: (table, id) => db().t(table).get(id),
  bulkPut: async (table, rows) => {
    await db().t(table).bulkPut(rows);
  },
  changedSince: (table, iso) => db().t(table).where("updatedAt").above(iso).toArray(),
  getMeta: async (key) => (await db().meta.get(key))?.value,
  setMeta: async (key, value) => {
    await db().meta.put({ key, value });
  },
  clear: async () => {
    await db().transaction("rw", db().tables, async () => {
      for (const t of db().tables) await t.clear();
    });
  },
};
