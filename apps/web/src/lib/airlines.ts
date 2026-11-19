"use client";

import { useEffect, useState } from "react";
import { airlineDirectory, type AirlineDirectory } from "@cielo/core";

/** The world airline directory (loaded once, ~340 kB); our own table is used until it has arrived. */
let cache: Promise<AirlineDirectory> | null = null;
const fallback = airlineDirectory();

function load() {
  cache ??= fetch("/data/airlines.json")
    .then((r) => r.json())
    .then((f: { rows: Parameters<typeof airlineDirectory>[0] }) => airlineDirectory(f.rows))
    .catch(() => {
      cache = null;
      return fallback;
    });
  return cache;
}

export function useAirlineDirectory(): AirlineDirectory {
  const [dir, setDir] = useState<AirlineDirectory>(fallback);
  useEffect(() => {
    let on = true;
    void load().then((d) => on && setDir(d));
    return () => {
      on = false;
    };
  }, []);
  return dir;
}
