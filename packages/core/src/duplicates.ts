import type { Flight } from "./types";

/** A flight being imported that is already in the logbook: the same one, or very likely the same one. */
export interface DuplicateMatch {
  kind: "exact" | "probable";
  /** the flight already in the logbook */
  flight: Pick<Flight, "id" | "date" | "depIcao" | "arrIcao" | "outUtc" | "offUtc" | "totalMin">;
}

type F = Pick<Flight, "id" | "date" | "depIcao" | "arrIcao" | "outUtc" | "offUtc" | "totalMin" | "isFstd" | "fstdMin" | "deletedAt">;

const start = (f: F) => f.outUtc ?? f.offUtc ?? null;
const minutes = (iso: string) => Math.round(Date.parse(iso) / 60_000);

/**
 * Whether a flight is already in the logbook. Exact: same airports and the same off-block to the minute (or, with
 * no times, the same day and total). Probable: same day and airports with an off-block within 10 minutes (a time
 * typed 14:30 and read 14:29), or the same day, airports and total within 5 minutes when one of the two has no
 * times. Simulator sessions: same day and session time.
 */
export function findDuplicate(f: F, logbook: F[]): DuplicateMatch | null {
  let probable: DuplicateMatch | null = null;
  const s = start(f);
  for (const e of logbook) {
    if (e.deletedAt || e.id === f.id || !!e.isFstd !== !!f.isFstd) continue;
    if (f.isFstd) {
      if (e.date === f.date && Math.abs((e.fstdMin || 0) - (f.fstdMin || 0)) <= 5) return { kind: (e.fstdMin || 0) === (f.fstdMin || 0) ? "exact" : "probable", flight: e };
      continue;
    }
    if (e.depIcao !== f.depIcao || e.arrIcao !== f.arrIcao) continue;
    const es = start(e);
    if (s && es) {
      const d = Math.abs(minutes(s) - minutes(es));
      if (d === 0) return { kind: "exact", flight: e };
      if (d <= 10 && !probable) probable = { kind: "probable", flight: e };
      continue;
    }
    if (e.date !== f.date) continue;
    const dt = Math.abs((e.totalMin || 0) - (f.totalMin || 0));
    if (!s && !es && dt === 0) return { kind: "exact", flight: e };
    if (dt <= 5 && !probable) probable = { kind: "probable", flight: e };
  }
  return probable;
}
