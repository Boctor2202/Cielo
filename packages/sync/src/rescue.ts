import { SYNC_TABLES, type LocalStore, type TableName } from "@cielo/core";

/**
 * The safety net of the local-first logbook: before a device forgets a logbook (sign-out, another account signing
 * in) while some of it has not reached the server yet, a full copy is kept on the device, outside the database
 * that is cleared. When that account signs in again here, the copy is merged back (rows newer than the server's)
 * and pushed. Nothing typed on a device is lost because of a sign-out without network.
 */
export interface LogbookRescue {
  /** the account (pilot id) the rows belong to */
  pilotId: string;
  at: string;
  rows: Partial<Record<TableName, Record<string, unknown>[]>>;
}

const EPOCH = "1970-01-01T00:00:00.000Z";
const lastPush = (t: TableName) => `lastPush:${t}`;
const mine = (table: TableName, r: Record<string, unknown>, pilotId: string) =>
  table === "pilots" ? r.id === pilotId : table === "aircraft_types" ? r.ownerPilotId === pilotId : r.pilotId === pilotId;

/** Rows of this pilot changed on this device and not pushed yet. */
export async function unsyncedCount(store: LocalStore, pilotId: string): Promise<number> {
  let n = 0;
  for (const table of SYNC_TABLES) {
    const since = (await store.getMeta(lastPush(table))) ?? EPOCH;
    const rows = (await store.changedSince(table, since)) as unknown as Record<string, unknown>[];
    n += rows.filter((r) => mine(table, r, pilotId) && String(r.updatedAt) > since).length;
  }
  return n;
}

/** The whole logbook of a pilot, as held on this device. */
export async function snapshotLogbook(store: LocalStore, pilotId: string): Promise<LogbookRescue> {
  const rows: LogbookRescue["rows"] = {};
  for (const table of SYNC_TABLES) {
    const all = (await store.all(table)) as unknown as Record<string, unknown>[];
    const own = all.filter((r) => mine(table, r, pilotId));
    if (own.length) rows[table] = own;
  }
  return { pilotId, at: new Date().toISOString(), rows };
}

/**
 * Merges a rescued copy into the device's logbook (after the account's data has been pulled): a row the device
 * does not have, or has in an older version, is written again with a fresh updatedAt so the next sync pushes it.
 * Returns the number of rows brought back.
 */
export async function restoreLogbook(store: LocalStore, rescue: LogbookRescue): Promise<number> {
  const now = new Date().toISOString();
  let n = 0;
  for (const table of SYNC_TABLES) {
    const rows = rescue.rows[table] ?? [];
    const back: Record<string, unknown>[] = [];
    for (const r of rows) {
      const cur = (await store.get(table, String(r.id))) as unknown as Record<string, unknown> | undefined;
      if (!cur || Date.parse(String(r.updatedAt)) > Date.parse(String(cur.updatedAt))) back.push({ ...r, updatedAt: now });
    }
    if (back.length) {
      await store.bulkPut(table, back as never);
      n += back.length;
    }
  }
  return n;
}
