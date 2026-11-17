import { useSyncExternalStore } from "react";

/**
 * What the pilot sees of the cloud sync: whether this phone is signed in, syncing, offline or in error,
 * when it last reached the server, and which changes are still waiting on the phone.
 */
export type SyncMode = "local" | "idle" | "syncing" | "offline" | "error";

export interface SyncStatus {
  mode: SyncMode;
  lastOkAt?: string;
  /** rows changed on this phone and not yet on the server */
  pending: number;
  /** flights among them, to mark them in the logbook */
  pendingFlightIds: ReadonlySet<string>;
}

let status: SyncStatus = { mode: "local", pending: 0, pendingFlightIds: new Set() };
const listeners = new Set<() => void>();
let requester: (() => void) | null = null;

export function setSyncStatus(patch: Partial<SyncStatus>): void {
  status = { ...status, ...patch };
  for (const l of listeners) l();
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}

/** Registered by the running sync; the badge calls it to sync now. */
export function setSyncRequester(fn: (() => void) | null): void {
  requester = fn;
}
export function requestSync(): void {
  requester?.();
}

/** A failed request with no answer from the server: no network, not a server-side refusal. */
export function isNetworkError(message: string): boolean {
  return /network|fetch|timed? ?out|offline|internet|connection|abort/i.test(message);
}
