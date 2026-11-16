"use client";
import type React from "react";

import { useEffect, useState } from "react";

/** Platform switches set from the admin back office (all on until loaded or if unreachable). */
export type Flags = Record<"radar" | "layovers" | "aircraftPhotos" | "flightTracks" | "jobs", boolean>;
const ALL_ON: Flags = { radar: true, layovers: true, aircraftPhotos: true, flightTracks: true, jobs: true };
let cache: Flags | null = null;
let pending: Promise<Flags> | null = null;

export function loadFlags(): Promise<Flags> {
  if (cache) return Promise.resolve(cache);
  pending ??= fetch("/api/flags")
    .then((r) => (r.ok ? r.json() : ALL_ON))
    .then((f: Flags) => (cache = { ...ALL_ON, ...f }))
    .catch(() => ALL_ON);
  return pending;
}

export function useFlags(): Flags {
  const [f, setF] = useState<Flags>(cache ?? ALL_ON);
  useEffect(() => {
    void loadFlags().then(setF);
  }, []);
  return f;
}

/** Shows a short notice instead of a feature switched off from the admin back office. */
export function FlagGate({ flag, children, message }: { flag: keyof Flags; children: React.ReactNode; message: string }) {
  const f = useFlags();
  if (!f[flag]) return <div className="card mx-auto mt-6 max-w-xl p-8 text-center text-sm text-muted">{message}</div>;
  return <>{children}</>;
}
