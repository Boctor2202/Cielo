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

/**
 * The airport the phone is at, read once (never tracked): undefined when the position is refused, takes too
 * long or is far from any airport. A recent position does, the phone often has one already.
 */
export async function airportHere(): Promise<string | undefined> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return undefined;
    const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000, requiredAccuracy: 3000 });
    const pos =
      last ??
      (await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((r) => setTimeout(() => r(null), 8000)),
      ]));
    if (!pos) return undefined;
    return nearestAirport(airports().list, pos.coords.latitude, pos.coords.longitude)?.icao;
  } catch {
    return undefined;
  }
}
