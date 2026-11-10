import * as SQLite from "expo-sqlite";
import { SYNC_TABLES, type LocalStore, type TableMap, type TableName } from "@cielo/core";

/**
 * LocalStore (from @cielo/core) backed by expo-sqlite.
 * One table per TableName: (id TEXT PK, updated_at TEXT, data TEXT JSON payload) + a key/value meta table.
 * Rows are stored as-is (soft-deleted rows included): callers filter on deletedAt.
 */
export class SqliteStore implements LocalStore {
  private constructor(private readonly db: SQLite.SQLiteDatabase) {}

  static async open(name = "cielo.db"): Promise<SqliteStore> {
    const db = await SQLite.openDatabaseAsync(name);
    const ddl = [
      "PRAGMA journal_mode = WAL;",
      "CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);",
      ...SYNC_TABLES.map(
        (t) =>
          `CREATE TABLE IF NOT EXISTS ${t} (id TEXT PRIMARY KEY NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);` +
          `CREATE INDEX IF NOT EXISTS ${t}_updated_at ON ${t}(updated_at);`,
      ),
    ];
    await db.execAsync(ddl.join("\n"));
    return new SqliteStore(db);
  }

  private static table(t: TableName): string {
    if (!SYNC_TABLES.includes(t)) throw new Error(`Unknown table ${t}`);
    return t;
  }

  async all<T extends TableName>(table: T): Promise<TableMap[T][]> {
    const rows = await this.db.getAllAsync<{ data: string }>(`SELECT data FROM ${SqliteStore.table(table)}`);
    return rows.map((r) => JSON.parse(r.data) as TableMap[T]);
  }

  async get<T extends TableName>(table: T, id: string): Promise<TableMap[T] | undefined> {
    const row = await this.db.getFirstAsync<{ data: string }>(`SELECT data FROM ${SqliteStore.table(table)} WHERE id = ?`, id);
    return row ? (JSON.parse(row.data) as TableMap[T]) : undefined;
  }

  async bulkPut<T extends TableName>(table: T, rows: TableMap[T][]): Promise<void> {
    if (rows.length === 0) return;
    const t = SqliteStore.table(table);
    await this.db.withExclusiveTransactionAsync(async (txn) => {
      const stmt = await txn.prepareAsync(
        `INSERT INTO ${t} (id, updated_at, data) VALUES ($id, $u, $d) ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at, data = excluded.data`,
      );
      try {
        for (const r of rows) await stmt.executeAsync({ $id: r.id, $u: r.updatedAt, $d: JSON.stringify(r) });
      } finally {
        await stmt.finalizeAsync();
      }
    });
  }

  async changedSince<T extends TableName>(table: T, isoUtc: string): Promise<TableMap[T][]> {
    const rows = await this.db.getAllAsync<{ data: string }>(
      `SELECT data FROM ${SqliteStore.table(table)} WHERE updated_at > ? ORDER BY updated_at`,
      isoUtc,
    );
    return rows.map((r) => JSON.parse(r.data) as TableMap[T]);
  }

  async getMeta(key: string): Promise<string | undefined> {
    const row = await this.db.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = ?", key);
    return row?.value;
  }

  async setMeta(key: string, value: string): Promise<void> {
    await this.db.runAsync("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, value);
  }

  async clear(): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async (txn) => {
      for (const t of SYNC_TABLES) await txn.execAsync(`DELETE FROM ${t};`);
      await txn.execAsync("DELETE FROM meta;");
    });
  }
}
