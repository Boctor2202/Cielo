/**
 * @cielo/sync — offline-first, last-write-wins sync between a LocalStore
 * (IndexedDB on web, SQLite on mobile) and Supabase.
 *
 * For each table of SYNC_TABLES:
 *   1. push: local rows with updatedAt after meta `lastPush:<table>` are upserted
 *      (rowToDb). The server keeps the newest version (cielo_lww_guard trigger).
 *   2. pull: server rows with updated_at at/after meta `lastPull:<table>` are fetched
 *      (keyset pagination on (updated_at, id)) and written locally when they are
 *      newer than the local copy (updatedAt comparison). The watermark row itself is
 *      re-read (>=) so a run interrupted inside a group of equal timestamps loses nothing;
 *      the LWW comparison makes that re-read a no-op.
 *
 * Never throws: network/server failures are reported in SyncResult.errors and the
 * watermarks only advance over what actually succeeded, so the next run resumes.
 */
import { PILOT_DIRTY_KEY, rowFromDb, rowToDb, SYNC_TABLES, type LocalStore, type SyncedRecord, type TableMap, type TableName } from "@cielo/core";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SyncPhase = "push" | "pull";

export interface SyncError {
  table: TableName;
  phase: SyncPhase;
  message: string;
}

export interface SyncResult {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  pushed: Partial<Record<TableName, number>>;
  pulled: Partial<Record<TableName, number>>;
  errors: SyncError[];
}

export interface SupabaseSyncOptions {
  /** A supabase-js client signed in as the pilot (RLS scopes every query). */
  supabase: Pick<SupabaseClient, "from">;
  store: LocalStore;
  pilotId: string;
  /** Tables to sync, in order. Defaults to SYNC_TABLES. */
  tables?: TableName[];
  /** Rows per upsert request (rows can carry data URLs). Default 200. */
  pushBatchSize?: number;
  /** Rows per pull page. Default 500. */
  pullPageSize?: number;
  /** Called after every sync run (manual or scheduled). */
  onResult?: (result: SyncResult) => void;
}

export interface SupabaseSync {
  syncNow(): Promise<SyncResult>;
  /** Syncs now, then every intervalMs (default 60 s). Calling start twice restarts the timer. */
  start(intervalMs?: number): void;
  stop(): void;
}

const EPOCH = "1970-01-01T00:00:00.000Z";
export const lastPushKey = (t: TableName) => `lastPush:${t}`;
export const lastPullKey = (t: TableName) => `lastPull:${t}`;

type AnyRow = SyncedRecord & Record<string, unknown>;

/** Instant comparison that tolerates both "…000Z" and Postgres "…+00:00" / microsecond forms. */
function time(iso: string | null | undefined): number {
  if (!iso) return Number.NEGATIVE_INFINITY;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

/** Postgres returns timestamptz as "2026-11-10T08:35:00.123456+00:00"; local rows use toISOString(). */
function normalizeTimestamps(row: Record<string, unknown>): Record<string, unknown> {
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === "string" && (k.endsWith("At") || k.endsWith("Utc"))) {
      const t = Date.parse(v);
      if (!Number.isNaN(t)) row[k] = new Date(t).toISOString();
    }
  }
  return row;
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

/** Whether a local row belongs to this pilot and may be pushed (RLS would reject the others). */
function isPushable(table: TableName, row: AnyRow, pilotId: string): boolean {
  switch (table) {
    case "pilots":
      return row.id === pilotId;
    case "aircraft_types":
      // Public reference rows (ownerPilotId null) are read-only for clients.
      return row.ownerPilotId === pilotId;
    default:
      return row.pilotId === pilotId;
  }
}

/** Quotes a value for a PostgREST logic tree (or=(...)). */
const pgrstQuote = (v: string) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

export function createSupabaseSync(options: SupabaseSyncOptions): SupabaseSync {
  const { supabase, store, pilotId, onResult } = options;
  const tables = options.tables ?? SYNC_TABLES;
  const pushBatchSize = options.pushBatchSize ?? 200;
  const pullPageSize = options.pullPageSize ?? 500;

  let inFlight: Promise<SyncResult> | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  /**
   * The profile: only the fields changed on this device are sent (see PILOT_DIRTY_KEY), then the merged row is
   * read back. A device that never pushed its profile (no list yet) sends the whole row once.
   */
  async function pushPilot(): Promise<number> {
    const since = (await store.getMeta(lastPushKey("pilots"))) ?? EPOCH;
    const row = ((await store.changedSince("pilots", since)) as unknown as AnyRow[]).find((r) => r.id === pilotId);
    if (!row) return 0;
    const raw = await store.getMeta(PILOT_DIRTY_KEY);
    const fields = raw ? (JSON.parse(raw) as string[]) : undefined;
    let pushed = 0;
    if (!fields || fields.length) {
      const full = rowToDb(row);
      // without a list (first push from this device), empty values are left out so they cannot wipe the server's
      const payload = fields
        ? Object.fromEntries(Object.entries(full).filter(([k]) => k === "id" || k === "updated_at" || fields.some((f) => rowToDb({ [f]: null })[k] !== undefined)))
        : Object.fromEntries(Object.entries(full).filter(([, v]) => v !== null && v !== ""));
      const { error } = await supabase.from("pilots").upsert([payload], { onConflict: "id" });
      if (error) throw error;
      pushed = 1;
    }
    // fields changed while the push was in flight stay listed
    const now = await store.getMeta(PILOT_DIRTY_KEY);
    const left = fields ? (now ? (JSON.parse(now) as string[]) : []).filter((f) => !fields.includes(f)) : [];
    await store.setMeta(PILOT_DIRTY_KEY, JSON.stringify(left));
    let mark = String(row.updatedAt);
    // the server row now merges every device's changes: bring it back whole
    const { data } = await supabase.from("pilots").select("*").eq("id", pilotId).limit(1);
    const merged = Array.isArray(data) && data[0] ? (normalizeTimestamps(rowFromDb<Record<string, unknown>>(data[0] as Record<string, unknown>)) as AnyRow) : undefined;
    if (merged) {
      await store.bulkPut("pilots", [{ ...row, ...merged } as never]);
      if (time(String(merged.updatedAt)) > time(mark)) mark = String(merged.updatedAt);
    }
    await store.setMeta(lastPushKey("pilots"), mark);
    return pushed;
  }

  async function pushTable(table: TableName): Promise<number> {
    const since = (await store.getMeta(lastPushKey(table))) ?? EPOCH;
    const changed = (await store.changedSince(table, since)) as unknown as AnyRow[];
    const rows = changed
      .filter((r) => isPushable(table, r, pilotId))
      .sort((a, b) => time(a.updatedAt) - time(b.updatedAt));

    let pushed = 0;
    let watermark: string | undefined;
    for (let i = 0; i < rows.length; i += pushBatchSize) {
      const batch = rows.slice(i, i + pushBatchSize);
      // columns the server requires (NOT NULL with a default) that older local rows may lack
      const payload = batch.map(rowToDb).map((r) => (table === "roster_events" ? { ...r, tentative: r.tentative === true } : r));
      const { error } = await supabase.from(table).upsert(payload, { onConflict: "id", defaultToNull: false });
      if (error) {
        // Keep the progress made so far; the failed batch is retried next run.
        if (watermark) await store.setMeta(lastPushKey(table), watermark);
        throw error;
      }
      pushed += batch.length;
      watermark = batch[batch.length - 1]!.updatedAt;
    }
    // Only move forward (changedSince may return rows we filtered out).
    if (watermark && time(watermark) > time(since)) await store.setMeta(lastPushKey(table), watermark);
    return pushed;
  }

  async function pullTable(table: TableName): Promise<number> {
    const since = (await store.getMeta(lastPullKey(table))) ?? EPOCH;
    // Cursor = raw server values of the last row seen, so microsecond timestamps compare exactly.
    let cursor: { updatedAt: string; id: string } | null = null;
    let pulled = 0;

    for (;;) {
      let query = supabase.from(table).select("*");
      if (table === "pilots") query = query.eq("id", pilotId);
      else if (table !== "aircraft_types") query = query.eq("pilot_id", pilotId); // aircraft_types: public + own (RLS)
      query = cursor
        ? query.or(
          `updated_at.gt.${pgrstQuote(cursor.updatedAt)},and(updated_at.eq.${pgrstQuote(cursor.updatedAt)},id.gt.${pgrstQuote(cursor.id)})`,
        )
        : query.gte("updated_at", since);

      const { data, error } = await query
        .order("updated_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(pullPageSize);
      if (error) throw error;
      const page = (data ?? []) as Record<string, unknown>[];
      if (page.length === 0) break;

      const newer: AnyRow[] = [];
      for (const raw of page) {
        const remote = normalizeTimestamps(rowFromDb<Record<string, unknown>>(raw)) as AnyRow;
        const local = (await store.get(table, remote.id)) as unknown as AnyRow | undefined;
        if (!local || time(remote.updatedAt) > time(local.updatedAt)) newer.push(remote);
      }
      if (newer.length) await store.bulkPut(table, newer as unknown as TableMap[typeof table][]);
      pulled += newer.length;

      const last = page[page.length - 1]!;
      const next = { updatedAt: String(last.updated_at), id: String(last.id) };
      if (cursor && next.updatedAt === cursor.updatedAt && next.id === cursor.id) {
        throw new Error("pagination did not advance");
      }
      cursor = next;
      // Persist after every page so an interrupted pull resumes where it stopped.
      await store.setMeta(lastPullKey(table), cursor.updatedAt);
      if (page.length < pullPageSize) break;
    }
    return pulled;
  }

  /**
   * Columns the server owns (the database refuses client changes to them): the subscription and the start of the trial. A client that
   * pushes its profile keeps its own updated_at, so a plain pull would never bring the server value back.
   * Re-read them after each sync and patch the local profile without touching updatedAt.
   */
  async function refreshServerOwned(): Promise<void> {
    if (!tables.includes("pilots")) return;
    const { data, error } = await supabase
      .from("pilots")
      .select("subscription_tier, subscription_source, subscription_expires_at, trial_started_at")
      .eq("id", pilotId)
      .limit(1);
    if (error || !Array.isArray(data) || !data[0]) return;
    const row = data[0] as Record<string, unknown>;
    const local = (await store.get("pilots", pilotId)) as unknown as AnyRow | undefined;
    if (!local) return;
    const next = {
      subscriptionTier: (row.subscription_tier as string) ?? "free",
      subscriptionSource: (row.subscription_source as string | null) ?? null,
      subscriptionExpiresAt: row.subscription_expires_at ? new Date(String(row.subscription_expires_at)).toISOString() : null,
      trialStartedAt: row.trial_started_at ? new Date(String(row.trial_started_at)).toISOString() : null,
    };
    const prev = local as unknown as Record<string, unknown>;
    const changed =
      prev.subscriptionTier !== next.subscriptionTier ||
      (prev.subscriptionSource ?? null) !== next.subscriptionSource ||
      (prev.subscriptionExpiresAt ? new Date(String(prev.subscriptionExpiresAt)).toISOString() : null) !== next.subscriptionExpiresAt ||
      (prev.trialStartedAt ? new Date(String(prev.trialStartedAt)).toISOString() : null) !== next.trialStartedAt;
    if (changed) await store.bulkPut("pilots", [{ ...local, ...next } as never]);
  }

  async function run(): Promise<SyncResult> {
    const startedAt = new Date().toISOString();
    const result: SyncResult = { ok: true, startedAt, finishedAt: startedAt, pushed: {}, pulled: {}, errors: [] };

    for (const table of tables) {
      try {
        result.pushed[table] = table === "pilots" ? await pushPilot() : await pushTable(table);
      } catch (e) {
        result.errors.push({ table, phase: "push", message: errorMessage(e) });
      }
      try {
        result.pulled[table] = await pullTable(table);
      } catch (e) {
        result.errors.push({ table, phase: "pull", message: errorMessage(e) });
      }
    }

    try {
      await refreshServerOwned();
    } catch (e) {
      result.errors.push({ table: "pilots", phase: "pull", message: errorMessage(e) });
    }

    result.ok = result.errors.length === 0;
    result.finishedAt = new Date().toISOString();
    try {
      onResult?.(result);
    } catch {
      // a faulty listener must not break sync
    }
    return result;
  }

  function syncNow(): Promise<SyncResult> {
    // Coalesce concurrent calls (timer + manual "sync now" button).
    if (!inFlight) inFlight = run().finally(() => { inFlight = null; });
    return inFlight;
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function start(intervalMs = 60_000) {
    stop();
    void syncNow();
    timer = setInterval(() => void syncNow(), intervalMs);
  }

  return { syncNow, start, stop };
}
export * from "./rescue";
