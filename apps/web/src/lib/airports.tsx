"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AirportIndex, expandAirports, type AirportFile } from "@cielo/reference-data";

let cache: Promise<AirportIndex> | null = null;

export function loadAirports(): Promise<AirportIndex> {
  if (!cache) {
    cache = fetch("/data/airports.json")
      .then((r) => r.json() as Promise<AirportFile>)
      .then((f) => new AirportIndex(expandAirports(f)))
      .catch((e) => {
        cache = null;
        throw e;
      });
  }
  return cache;
}

const Ctx = createContext<AirportIndex | null>(null);

export function AirportsProvider({ children }: { children: ReactNode }) {
  const [idx, setIdx] = useState<AirportIndex | null>(null);
  useEffect(() => {
    loadAirports().then(setIdx).catch(() => setIdx(null));
  }, []);
  return <Ctx.Provider value={idx}>{children}</Ctx.Provider>;
}

/** null while the airport table is loading */
export const useAirports = () => useContext(Ctx);
