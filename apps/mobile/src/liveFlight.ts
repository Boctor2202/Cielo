import * as Location from "expo-location";
import { nearestAirport, type LiveFlight } from "@cielo/core";
import type { SqliteStore } from "./db/sqliteStore";
import { airports } from "./airports";

/** The flight in progress, kept on the phone (the app can be closed, the phone restarted). */
const KEY = "liveFlight";

export async function loadLive(store: SqliteStore): Promise<LiveFlight | null> {
  try {
    const v = await store.getMeta(KEY);
    return v ? (JSON.parse(v) as LiveFlight) : null;
  } catch {
    return null;
  }
}

export async function saveLive(store: SqliteStore, f: LiveFlight | null): Promise<void> {
  await store.setMeta(KEY, f ? JSON.stringify(f) : "");
}

export type HereResult =
  | { status: "ok"; icao: string; km: number }
  /** a position, but no airport within reach: the nearest one and how far */
  | { status: "far"; nearest?: string; km?: number }
  | { status: "denied"; canAskAgain: boolean }
  | { status: "unavailable" };

/** Asks for the position once (iOS shows its question the first time only). */
export async function locationAllowed(): Promise<{ granted: boolean; canAskAgain: boolean }> {
  try {
    const p = await Location.requestForegroundPermissionsAsync();
    return { granted: p.granted, canAskAgain: p.canAskAgain };
  } catch {
    return { granted: false, canAskAgain: false };
  }
}

/**
 * The airport the phone is at, read once (never tracked), with what happened when there is none: position
 * refused, no fix in time, or no airport within 6 km (then the nearest one, for the pilot to see why).
 */
export async function airportHere(): Promise<HereResult> {
  const perm = await locationAllowed();
  if (!perm.granted) return { status: "denied", canAskAgain: perm.canAskAgain };
  try {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000, requiredAccuracy: 3000 });
    const pos =
      last ??
      (await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((r) => setTimeout(() => r(null), 10_000)),
      ]));
    if (!pos) return { status: "unavailable" };
    const { latitude, longitude } = pos.coords;
    const list = airports().list;
    const here = nearestAirport(list, latitude, longitude);
    if (here) return { status: "ok", icao: here.icao, km: distanceKm(latitude, longitude, here.lat, here.lon) };
    const near = nearestAirport(list, latitude, longitude, 300);
    return { status: "far", nearest: near?.icao, km: near ? distanceKm(latitude, longitude, near.lat, near.lon) : undefined };
  } catch {
    return { status: "unavailable" };
  }
}

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const r = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLon - aLon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
