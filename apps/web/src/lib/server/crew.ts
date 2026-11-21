import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { accessFor, canonicalFlightContent, noCardTrialDays, rowFromDb, type Flight } from "@cielo/core";

/**
 * Signatures between Geardown pilots (server side, service role).
 *  - A name in the PIC column is linked to another pilot's account only with something unique: their e-mail,
 *    their licence number, or the same flights in both logbooks. A name alone is never enough (namesakes).
 *  - The other pilot accepts the link; nothing about either pilot is shown to the other before that, apart
 *    from the requester's name on the request itself.
 *  - Then each unsigned flight with that name becomes a signature request; the signature drawn by the captain
 *    is written on the requester's flight, with the hash of the flight content they saw.
 */

export type Db = SupabaseClient;

const norm = (s?: string | null) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const normReg = (s?: string | null) => (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
export const normLicence = (s?: string | null) => (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Same as the apps' sync: Postgres timestamps ("+00:00", microseconds) read back as toISOString(). */
function normalize(row: Record<string, unknown>): Record<string, unknown> {
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === "string" && (k.endsWith("At") || k.endsWith("Utc"))) {
      const t = Date.parse(v);
      if (!Number.isNaN(t)) row[k] = new Date(t).toISOString();
    }
  }
  return row;
}
export const flightFromRow = (r: Record<string, unknown>) => normalize(rowFromDb<Record<string, unknown>>(r)) as unknown as Flight;
export const contentHash = (f: Flight) => createHash("sha256").update(canonicalFlightContent(f)).digest("hex");

/** What the signer is shown of a flight. */
export const snapshot = (f: Flight) => ({
  date: f.date,
  flightNumber: f.flightNumber ?? null,
  dep: f.depIcao,
  arr: f.arrIcao,
  out: f.outUtc ?? null,
  in: f.inUtc ?? null,
  registration: f.registration ?? null,
  type: f.aircraftTypeIcao ?? null,
  function: f.function ?? null,
  totalMin: f.totalMin ?? 0,
  picName: f.picName ?? null,
  isFstd: !!f.isFstd,
});

export async function canSign(db: Db, id: string): Promise<boolean> {
  const { data: p } = await db.from("pilots").select("created_at, trial_started_at, subscription_tier, subscription_expires_at").eq("id", id).maybeSingle();
  if (!p) return false;
  return accessFor({ createdAt: p.trial_started_at ?? p.created_at, subscriptionTier: p.subscription_tier, subscriptionExpiresAt: p.subscription_expires_at }, { signedIn: true, noCardTrialDays: noCardTrialDays(process.env.NEXT_PUBLIC_NO_CARD_TRIAL_DAYS) }).has("signature");
}

type FlightRow = { id: string; pilot_id: string; date: string; dep_icao: string; arr_icao: string; registration: string | null; pic_name: string | null; pic_min: number | null; function: string | null; signature_id: string | null; is_fstd: boolean };
const FLIGHT_COLS = "id, pilot_id, date, dep_icao, arr_icao, registration, pic_name, pic_min, function, signature_id, is_fstd";

async function myFlights(db: Db, pilotId: string): Promise<FlightRow[]> {
  const out: FlightRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("flights").select(FLIGHT_COLS).eq("pilot_id", pilotId).is("deleted_at", null).range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as FlightRow[]));
    if (!data || data.length < 1000) return out;
  }
}

const sameFlight = (a: FlightRow, b: FlightRow) =>
  a.date === b.date && a.dep_icao === b.dep_icao && a.arr_icao === b.arr_icao && (!a.registration || !b.registration || normReg(a.registration) === normReg(b.registration));

/**
 * For each PIC name of the pilot, the other Geardown pilot who logged the same flights as PIC (same date, route
 * and registration), when there is exactly one with at least one shared flight. Identities are not returned.
 */
export async function flightMatches(db: Db, pilotId: string, flights?: FlightRow[]): Promise<Map<string, { targetId: string; flights: number; total: number }>> {
  const mine = (flights ?? (await myFlights(db, pilotId))).filter((f) => !f.is_fstd && f.pic_name);
  const dates = [...new Set(mine.map((f) => f.date))];
  const others: FlightRow[] = [];
  for (let i = 0; i < dates.length; i += 200) {
    const { data } = await db.from("flights").select(FLIGHT_COLS).in("date", dates.slice(i, i + 200)).neq("pilot_id", pilotId).is("deleted_at", null).eq("is_fstd", false);
    others.push(...((data ?? []) as FlightRow[]));
  }
  // they were in command on that flight (or instructing)
  const commanding = others.filter((o) => (o.pic_min ?? 0) > 0 || o.function === "PIC" || o.function === "FI" || o.function === "FE");
  const byName = new Map<string, { counts: Map<string, number>; total: number }>();
  for (const f of mine) {
    const k = norm(f.pic_name);
    const e = byName.get(k) ?? { counts: new Map(), total: 0 };
    e.total++;
    for (const o of commanding) if (sameFlight(f, o)) e.counts.set(o.pilot_id, (e.counts.get(o.pilot_id) ?? 0) + 1);
    byName.set(k, e);
  }
  const out = new Map<string, { targetId: string; flights: number; total: number }>();
  for (const [k, e] of byName) {
    const ranked = [...e.counts.entries()].sort((a, b) => b[1] - a[1]);
    // one clear candidate: alone, or with at least three times the flights of the next one
    if (ranked.length && (ranked.length === 1 || ranked[0]![1] >= 3 * ranked[1]![1])) out.set(k, { targetId: ranked[0]![0], flights: ranked[0]![1], total: e.total });
  }
  return out;
}

/** The pilot's flights the captain also logged: requester flight id → the captain's flight id. */
async function matchedFlights(db: Db, requesterFlights: FlightRow[], targetId: string): Promise<Map<string, string>> {
  const dates = [...new Set(requesterFlights.map((f) => f.date))];
  const theirs: FlightRow[] = [];
  for (let i = 0; i < dates.length; i += 200) {
    const { data } = await db.from("flights").select(FLIGHT_COLS).eq("pilot_id", targetId).in("date", dates.slice(i, i + 200)).is("deleted_at", null);
    theirs.push(...((data ?? []) as FlightRow[]));
  }
  const m = new Map<string, string>();
  for (const f of requesterFlights) {
    const o = theirs.find((x) => sameFlight(f, x));
    if (o) m.set(f.id, o.id);
  }
  return m;
}

/**
 * Creates the missing signature requests of a requester: unsigned flights whose PIC is a linked captain.
 * `since` limits automatic requests to recent flights (older ones are asked for explicitly).
 */
export async function createRequests(db: Db, requesterId: string, opts: { linkId?: string; since?: string } = {}): Promise<number> {
  let q = db.from("crew_links").select("id, target_id, crew_name, responded_at").eq("requester_id", requesterId).eq("status", "accepted");
  if (opts.linkId) q = q.eq("id", opts.linkId);
  const { data: links } = await q;
  if (!links?.length) return 0;
  const flights = (await myFlights(db, requesterId)).filter((f) => !f.signature_id && f.pic_name);
  const { data: open } = await db.from("signature_requests").select("flight_id").eq("requester_id", requesterId).in("status", ["pending", "signed", "refused"]);
  const asked = new Set((open ?? []).map((r) => r.flight_id as string));
  let n = 0;
  for (const l of links) {
    // automatic: flights from 30 days before the link was accepted
    const since = opts.since ?? new Date(Date.parse(l.responded_at ?? new Date().toISOString()) - 30 * 86_400_000).toISOString().slice(0, 10);
    const todo = flights.filter((f) => norm(f.pic_name) === norm(l.crew_name) && f.date >= since && !asked.has(f.id));
    if (!todo.length) continue;
    const matched = await matchedFlights(db, todo, l.target_id);
    for (let i = 0; i < todo.length; i += 100) {
      const ids = todo.slice(i, i + 100).map((f) => f.id);
      const { data: full } = await db.from("flights").select("*").in("id", ids);
      const rows = (full ?? []).map((r) => {
        const f = flightFromRow(r);
        return {
          link_id: l.id,
          requester_id: requesterId,
          target_id: l.target_id,
          flight_id: f.id,
          flight: snapshot(f),
          content_hash: contentHash(f),
          matched_flight_id: matched.get(f.id) ?? null,
        };
      });
      const { error } = await db.from("signature_requests").insert(rows);
      if (!error) n += rows.length;
    }
  }
  return n;
}

/** Names of pilots by id (only for pilots linked or asking to be linked). */
export async function namesOf(db: Db, ids: string[]): Promise<Map<string, { name: string; licence?: string }>> {
  const m = new Map<string, { name: string; licence?: string }>();
  if (!ids.length) return m;
  const { data } = await db.from("pilots").select("id, full_name, display_name, licence_number").in("id", [...new Set(ids)]);
  for (const p of data ?? []) m.set(p.id, { name: p.display_name || p.full_name || "—", licence: p.licence_number ?? undefined });
  return m;
}

export { myFlights, norm };
