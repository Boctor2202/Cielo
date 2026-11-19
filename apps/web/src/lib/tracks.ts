"use client";

import { useEffect } from "react";
import { stamp, type Flight, type FlightTrack } from "@cielo/core";
import { db, localStore } from "./db";
import { ensurePilot } from "./repo";
import { writeAllowed } from "./write-guard";
import { apiFetch } from "./report";

/** adsb.lol keeps an aircraft's track for about 24 h; we try for a little longer after block-on. */
export const TRACK_WINDOW_H = 30;
const RETRY_MIN = 15;

export type TrackResult = "saved" | "exists" | "no_times" | "too_old" | "no_hex" | "no_match" | "quota" | "error" | "signin" | "fa_off" | "history_off";

const blockTimes = (f: Flight) => {
  const out = f.outUtc ?? f.offUtc;
  const inn = f.inUtc ?? f.onUtc;
  return out && inn ? { out, inn } : null;
};

/** The aircraft's ICAO address: remembered on the aircraft record, else looked up while it is transmitting. */
async function hexFor(registration: string): Promise<string | null> {
  const reg = registration.trim().toUpperCase();
  const planes = (await db().t("aircraft").toArray()).filter((a) => !a.deletedAt && a.registration.toUpperCase() === reg);
  const known = planes.find((a) => a.icaoHex)?.icaoHex ?? (await localStore.getMeta(`hex:${reg}`));
  if (known) return known;
  const r = await fetch(`/api/radar/reg?r=${encodeURIComponent(reg)}`);
  if (r.status === 429) throw new Error("quota");
  if (!r.ok) return null;
  const hex = ((await r.json()) as { ac?: { hex: string }[] }).ac?.[0]?.hex;
  if (!hex) return null;
  // remember it for good (a Mode S address belongs to the airframe)
  await localStore.setMeta(`hex:${reg}`, hex);
  const now = new Date().toISOString();
  for (const a of planes) await db().t("aircraft").put({ ...a, icaoHex: hex, updatedAt: now });
  return hex;
}

/** The track from FlightAware (any age; a paid query on the server, signed-in pilots only). */
async function fromFlightAware(f: Flight, times: { out: string; inn: string }): Promise<{ hex: string; points: FlightTrack["points"]; source: "flightaware" } | TrackResult> {
  const r = await apiFetch(`/api/flight-track/flightaware?reg=${encodeURIComponent(f.registration!)}&out=${encodeURIComponent(times.out)}&in=${encodeURIComponent(times.inn)}`);
  const d = (await r.json().catch(() => ({}))) as { points?: FlightTrack["points"]; faId?: string; error?: string };
  if (r.ok && d.points) return { hex: "", points: d.points, source: "flightaware" };
  if (d.error === "signin") return "signin";
  if (d.error === "not_configured") return "fa_off";
  if (d.error === "history_off") return "history_off";
  if (r.status === 429) return "quota";
  if (r.status === 404) return "no_match";
  return "error";
}

/**
 * Fetches and stores the real track of one logged flight: from adsb.lol while it still has it (free, about a
 * day), else from FlightAware.
 */
export async function fetchFlightTrack(f: Flight, opts: { flightAware?: boolean } = { flightAware: true }): Promise<TrackResult> {
  if (!writeAllowed()) return "error";
  const existing = await db().t("flight_tracks").get(f.id);
  if (existing && !existing.deletedAt) return "exists";
  const times = blockTimes(f);
  if (f.isFstd || !f.registration || !times) return "no_times";
  const save = async (hex: string, points: FlightTrack["points"], source: FlightTrack["source"]) => {
    const pilot = await ensurePilot();
    await db().t("flight_tracks").put(stamp({ id: f.id, pilotId: pilot.id, flightId: f.id, hex, source, points, fetchedAt: new Date().toISOString() } as FlightTrack));
    return "saved" as const;
  };
  let adsb: TrackResult = "too_old";
  if (Date.now() - Date.parse(times.inn) <= TRACK_WINDOW_H * 3600_000) {
    try {
      const hex = await hexFor(f.registration);
      if (!hex) adsb = "no_hex";
      else {
        const r = await fetch(`/api/flight-track?hex=${hex}&out=${encodeURIComponent(times.out)}&in=${encodeURIComponent(times.inn)}`);
        if (r.ok) {
          const d = (await r.json()) as { hex: string; points: FlightTrack["points"] };
          return await save(d.hex, d.points, "adsb.lol");
        }
        adsb = r.status === 429 ? "quota" : r.status === 404 ? "no_match" : "error";
      }
    } catch (e) {
      adsb = (e as Error).message === "quota" ? "quota" : "error";
    }
  }
  // the automatic sweep stays on the free source: FlightAware is a paid query, made on request
  if (!opts.flightAware) return adsb;
  try {
    const fa = await fromFlightAware(f, times);
    if (typeof fa === "object") return await save(fa.hex, fa.points, fa.source);
    // FlightAware switched off or not signed in: say what adsb.lol answered
    return fa === "fa_off" || fa === "signin" ? (adsb === "too_old" ? fa : adsb) : fa;
  } catch {
    return adsb;
  }
}

let running = false;

/** Recent flights (block-on in the last 30 h, finished at least 10 min ago) that have no track yet. */
async function sweep() {
  if (running || !navigator.onLine) return;
  running = true;
  try {
    const since = new Date(Date.now() - TRACK_WINDOW_H * 3600_000).toISOString().slice(0, 10);
    const recent = await db().t("flights").where("date").aboveOrEqual(since).toArray();
    for (const f of recent) {
      const times = blockTimes(f);
      if (f.deletedAt || f.isFstd || !f.registration || !times) continue;
      const age = Date.now() - Date.parse(times.inn);
      if (age < 10 * 60_000 || age > TRACK_WINDOW_H * 3600_000) continue;
      if (await db().t("flight_tracks").get(f.id)) continue;
      const lastTry = Number(await localStore.getMeta(`track:try:${f.id}`)) || 0;
      if (Date.now() - lastTry < RETRY_MIN * 60_000) continue;
      await localStore.setMeta(`track:try:${f.id}`, String(Date.now()));
      const res = await fetchFlightTrack(f, { flightAware: false });
      if (res === "quota") break;
    }
  } finally {
    running = false;
  }
}

/** Mounted once in the app shell: saves the real track of each new flight while adsb.lol still has it. */
export function useTrackAutoFetch(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const first = setTimeout(sweep, 5_000);
    const i = setInterval(sweep, RETRY_MIN * 60_000);
    // a flight just saved: try soon
    const onChange = () => {
      setTimeout(sweep, 3_000);
    };
    db().t("flights").hook("creating", onChange);
    db().t("flights").hook("updating", onChange);
    return () => {
      clearTimeout(first);
      clearInterval(i);
      db().t("flights").hook("creating").unsubscribe(onChange);
      db().t("flights").hook("updating").unsubscribe(onChange);
    };
  }, [enabled]);
}
