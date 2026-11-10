"use client";

import Dexie, { type Table } from "dexie";
import { SYNC_TABLES, type LocalStore, type TableMap, type TableName } from "@cielo/core";

class CieloDB extends Dexie {
  meta!: Table<{ key: string; value: string }, string>;
  constructor() {
    super("cielo");
    const schema: Record<string, string> = { meta: "key" };
    for (const t of SYNC_TABLES) schema[t] = "id, updatedAt";
    schema.flights = "id, updatedAt, date";
    schema.roster_events = "id, updatedAt, startUtc";
    this.version(1).stores(schema);
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
