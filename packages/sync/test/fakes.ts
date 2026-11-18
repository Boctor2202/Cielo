/**
 * Test doubles: an in-memory LocalStore and a fake supabase-js client that
 * implements just the query-builder surface used by @cielo/sync, with
 * Postgres-like behaviour (snake_case rows, "+00:00" microsecond timestamps,
 * server-side LWW guard, RLS-like rejection of rows owned by someone else).
 */
import type { LocalStore, TableMap, TableName } from "@cielo/core";

type Row = Record<string, unknown>;

export class MemoryStore implements LocalStore {
  tables = new Map<TableName, Map<string, Row>>();
  meta = new Map<string, string>();

  private t(table: TableName) {
    let m = this.tables.get(table);
    if (!m) this.tables.set(table, (m = new Map()));
    return m;
  }
  async all<T extends TableName>(table: T) {
    return [...this.t(table).values()] as unknown as TableMap[T][];
  }
  async get<T extends TableName>(table: T, id: string) {
    return this.t(table).get(id) as unknown as TableMap[T] | undefined;
  }
  async bulkPut<T extends TableName>(table: T, rows: TableMap[T][]) {
    for (const r of rows) this.t(table).set((r as { id: string }).id, { ...(r as unknown as Row) });
  }
  async changedSince<T extends TableName>(table: T, isoUtc: string) {
    const since = Date.parse(isoUtc);
    return [...this.t(table).values()].filter((r) => Date.parse(r.updatedAt as string) > since) as unknown as TableMap[T][];
  }
  async getMeta(key: string) {
    return this.meta.get(key);
  }
  async setMeta(key: string, value: string) {
    this.meta.set(key, value);
  }
  async clear() {
    this.tables.clear();
    this.meta.clear();
  }
}

/** "2026-11-10T08:00:00.000Z" -> "2026-11-10T08:00:00.000123+00:00" (Postgres JSON output). */
export function pgTimestamp(iso: string, micros = "000"): string {
  return new Date(iso).toISOString().replace(/\.(\d{3})Z$/, `.$1${micros}+00:00`);
}

type Filter = (r: Row) => boolean;
type Result = { data: Row[] | null; error: { message: string } | null };

const unquote = (v: string) => (v.startsWith('"') ? v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\") : v);
const cmp = (a: unknown, b: unknown, col: string) =>
  col.endsWith("_at") ? Date.parse(String(a)) - Date.parse(String(b)) : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;

export class FakeSupabase {
  server = new Map<string, Map<string, Row>>();
  offline = false;
  /** Throw instead of returning { error } (some fetch polyfills do). */
  throwWhenOffline = false;
  failUpsertFor = new Set<string>();
  requests: { table: string; op: string }[] = [];

  constructor(public uid: string) {}

  table(name: string) {
    let m = this.server.get(name);
    if (!m) this.server.set(name, (m = new Map()));
    return m;
  }

  /** Seeds a server row (snake_case), converting *_at/*_utc values to Postgres format. */
  seed(name: string, row: Row, micros = "000") {
    const r: Row = { ...row };
    for (const [k, v] of Object.entries(r)) if (typeof v === "string" && (k.endsWith("_at") || k.endsWith("_utc"))) r[k] = pgTimestamp(v, micros);
    this.table(name).set(String(r.id), r);
  }

  private offlineResult(): Result {
    if (this.throwWhenOffline) throw new TypeError("Failed to fetch");
    return { data: null, error: { message: "TypeError: Failed to fetch" } };
  }

  private owner(name: string, r: Row) {
    return name === "pilots" ? r.id : name === "aircraft_types" ? r.owner_pilot_id : r.pilot_id;
  }

  from(name: string) {
    const fake = this;
    const filters: Filter[] = [];
    let limit = Infinity;
    const orders: string[] = [];

    const builder = {
      select(_cols: string) {
        return builder;
      },
      eq(col: string, v: unknown) {
        filters.push((r) => r[col] === v);
        return builder;
      },
      gt(col: string, v: string) {
        filters.push((r) => cmp(r[col], v, col) > 0);
        return builder;
      },
      gte(col: string, v: string) {
        filters.push((r) => cmp(r[col], v, col) >= 0);
        return builder;
      },
      /** Supports exactly the keyset form used by the sync engine. */
      or(expr: string) {
        const m = /^updated_at\.gt\.("(?:[^"\\]|\\.)*"),and\(updated_at\.eq\.("(?:[^"\\]|\\.)*"),id\.gt\.("(?:[^"\\]|\\.)*")\)$/.exec(expr);
        if (!m) throw new Error(`unsupported or(): ${expr}`);
        const ts = unquote(m[1]!);
        const id = unquote(m[3]!);
        filters.push((r) => {
          const c = cmp(r.updated_at, ts, "updated_at");
          return c > 0 || (c === 0 && String(r.id) > id);
        });
        return builder;
      },
      order(col: string) {
        orders.push(col);
        return builder;
      },
      limit(n: number) {
        limit = n;
        return builder;
      },
      then<R1 = Result, R2 = never>(ok?: (v: Result) => R1 | PromiseLike<R1>, ko?: (e: unknown) => R2 | PromiseLike<R2>) {
        return Promise.resolve()
          .then(() => {
            fake.requests.push({ table: name, op: "select" });
            if (fake.offline) return fake.offlineResult();
            // RLS: own rows (+ public aircraft types)
            let rows = [...fake.table(name).values()].filter((r) => {
              const o = fake.owner(name, r);
              return o === fake.uid || (name === "aircraft_types" && o == null);
            });
            rows = rows.filter((r) => filters.every((f) => f(r)));
            rows.sort((a, b) => {
              for (const col of orders) {
                const c = cmp(a[col], b[col], col);
                if (c) return c;
              }
              return 0;
            });
            return { data: rows.slice(0, limit).map((r) => ({ ...r })), error: null };
          })
          .then(ok, ko);
      },
    };

    return {
      select: builder.select,
      upsert(rows: Row[], _opts?: { onConflict?: string }) {
        return Promise.resolve().then((): Result => {
          fake.requests.push({ table: name, op: "upsert" });
          if (fake.offline) return fake.offlineResult();
          if (fake.failUpsertFor.has(name)) return { data: null, error: { message: `boom ${name}` } };
          for (const r of rows) {
            if (fake.owner(name, r) !== fake.uid) return { data: null, error: { message: "new row violates row-level security policy" } };
          }
          for (const r of rows) {
            const existing = fake.table(name).get(String(r.id));
            // cielo_lww_guard: keep the stored row when the incoming one is older
            if (existing && Date.parse(String(r.updated_at)) < Date.parse(String(existing.updated_at))) continue;
            // pilots protection trigger: end users cannot change their subscription columns
            if (name === "pilots") {
              const keep = existing ?? { subscription_tier: "free", subscription_source: null, subscription_expires_at: null };
              fake.seed(name, { ...existing, ...r, subscription_tier: keep.subscription_tier, subscription_source: keep.subscription_source, subscription_expires_at: keep.subscription_expires_at });
              continue;
            }
            // PostgREST upsert: the columns sent replace the stored ones, the others are kept
            fake.seed(name, { ...existing, ...r });
          }
          return { data: null, error: null };
        });
      },
    };
  }
}
