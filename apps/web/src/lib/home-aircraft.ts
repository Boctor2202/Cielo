"use client";

import { useCallback, useEffect, useState } from "react";
import { AIRCRAFT_TYPES } from "@cielo/reference-data";
import { visualFor, type AircraftVisual } from "./aircraft-visuals";

const KEY = "cielo-home-aircraft"; // ICAO type picked by the visitor
const CACHE = "cielo-home-aircraft-logbook"; // last type derived from the logbook (sync read on next visit)

export interface HomeAircraft {
  ready: boolean;
  icao: string | null;
  /** "choice" = picked in the selector, "logbook" = most-flown type in the pilot's logbook */
  source: "choice" | "logbook" | "default";
  label: string | null;
  visual: AircraftVisual;
  exact: boolean;
  choose: (icao: string | null) => void;
}

export function typeLabel(icao: string | null): string | null {
  if (!icao) return null;
  const t = AIRCRAFT_TYPES.find((x) => x.icao === icao);
  return t ? `${t.manufacturer} ${t.model}` : icao;
}

/** Most-flown aircraft type in the local logbook (block minutes), without creating the database for visitors. */
async function mostFlownType(): Promise<string | null> {
  try {
    const { default: Dexie } = await import("dexie");
    if (!(await Dexie.exists("cielo"))) return null;
    const { db } = await import("./db");
    const flights = await db().t("flights").toArray();
    const totals = new Map<string, number>();
    for (const f of flights) {
      if (f.deletedAt || f.isFstd || !f.aircraftTypeIcao) continue;
      totals.set(f.aircraftTypeIcao, (totals.get(f.aircraftTypeIcao) ?? 0) + f.totalMin);
    }
    let best: string | null = null;
    let max = 0;
    for (const [k, v] of totals) if (v > max) [best, max] = [k, v];
    return best;
  } catch {
    return null;
  }
}

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v) localStorage.setItem(k, v);
    else localStorage.removeItem(k);
  } catch {}
};

/** Which aircraft the home page shows: the visitor's pick, else the type they fly most, else the default. */
export function useHomeAircraft(): HomeAircraft {
  const [state, setState] = useState<{ ready: boolean; icao: string | null; source: HomeAircraft["source"] }>({ ready: false, icao: null, source: "default" });

  useEffect(() => {
    const chosen = read(KEY);
    if (chosen) {
      setState({ ready: true, icao: chosen, source: "choice" });
      return;
    }
    const cached = read(CACHE);
    if (cached) setState({ ready: true, icao: cached, source: "logbook" });
    let alive = true;
    mostFlownType().then((icao) => {
      if (!alive) return;
      write(CACHE, icao);
      setState({ ready: true, icao, source: icao ? "logbook" : "default" });
    });
    return () => {
      alive = false;
    };
  }, []);

  const choose = useCallback((icao: string | null) => {
    const k = icao?.trim().toUpperCase() || null;
    write(KEY, k);
    if (k) setState({ ready: true, icao: k, source: "choice" });
    else {
      const cached = read(CACHE);
      setState({ ready: true, icao: cached, source: cached ? "logbook" : "default" });
    }
  }, []);

  const { visual, exact } = visualFor(state.icao);
  return { ...state, label: typeLabel(state.icao), visual, exact, choose };
}
