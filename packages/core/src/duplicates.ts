import type { Flight } from "./types";

/** A flight being imported that is already in the logbook: the same one, or very likely the same one. */
export interface DuplicateMatch {
  kind: "exact" | "probable";
  /** the flight already in the logbook */
  flight: Pick<Flight, "id" | "date" | "depIcao" | "arrIcao" | "outUtc" | "offUtc" | "totalMin">;
}

type F = Pick<Flight, "id" | "date" | "depIcao" | "arrIcao" | "outUtc" | "offUtc" | "totalMin" | "isFstd" | "fstdMin" | "deletedAt"> & { source?: Flight["source"] };

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
    // a flight confirmed from the roster carries the planned times: the same day and airports is the same leg
    if (e.source === "roster" && e.date === f.date && !probable) probable = { kind: "probable", flight: e };
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

/**
 * The rows of an import already in the logbook, matched one to one: a logbook flight stands for one row only, so
 * two circuits sessions the same morning (times often rounded or missing in old logbooks) both stay when the
 * logbook has one of them. The rows of one file are never compared with each other: each row is an entry the
 * pilot logged, even when two look alike.
 */
export function matchImported<T extends F>(rows: T[], logbook: F[]): (DuplicateMatch | null)[] {
  let pool = logbook.filter((e) => !e.deletedAt);
  return rows.map((f) => {
    const m = findDuplicate(f, pool);
    if (m) pool = pool.filter((e) => e.id !== m.flight.id);
    return m;
  });
}

/**
 * A flight already logged, met again in an Air France EP4/EP5 whose SAB code says who took off and landed and
 * with the HUD or not (`fromSab`). The statement is the airline's record: the logged flight takes its takeoffs,
 * landings, pilot flying / monitoring and HUD counts when they differ (a flight confirmed from the roster with
 * one takeoff and one landing as pilot flying, a leg the pilot actually monitored). Without a SAB code, only
 * what the logged flight lacks is filled. A signed or locked flight is left as it is. Null when nothing changes.
 */
export function landingsFill(imported: Flight, logged: Flight, now = new Date().toISOString(), fromSab = false): Flight | null {
  if (logged.deletedAt || logged.signatureId || logged.locked || logged.isFstd) return null;
  // a flight confirmed from the roster holds the planned times and no aircraft: the statement's flight replaces it
  if (fromSab && logged.source === "roster") {
    return { ...imported, id: logged.id, createdAt: logged.createdAt, rosterEventId: logged.rosterEventId, source: logged.source, flightNumber: imported.flightNumber ?? logged.flightNumber, operator: imported.operator ?? logged.operator, remarks: logged.remarks ?? imported.remarks, signatureId: null, locked: false, updatedAt: now };
  }
  // the aircraft the logged flight lacks
  const aircraft = !logged.registration && imported.registration ? { registration: imported.registration, aircraftTypeIcao: logged.aircraftTypeIcao ?? imported.aircraftTypeIcao, aircraftId: logged.aircraftId ?? imported.aircraftId } : null;
  const n = (f: Flight) => (f.takeoffsDay ?? 0) + (f.takeoffsNight ?? 0) + (f.landingsDay ?? 0) + (f.landingsNight ?? 0);
  const h = (f: Flight) => (f.hudTakeoffs ?? 0) + (f.hudLandings ?? 0);
  const same = (a: Flight, b: Flight) =>
    a.takeoffsDay === b.takeoffsDay && a.takeoffsNight === b.takeoffsNight && a.landingsDay === b.landingsDay && a.landingsNight === b.landingsNight && !!a.pilotFlying === !!b.pilotFlying;
  const landings = fromSab ? !same(logged, imported) : n(logged) === 0 && n(imported) > 0;
  const hud = fromSab ? (logged.hudTakeoffs ?? 0) !== (imported.hudTakeoffs ?? 0) || (logged.hudLandings ?? 0) !== (imported.hudLandings ?? 0) : h(logged) === 0 && h(imported) > 0;
  const note = h(imported) > 0 && /(^|\s·\s)HUD$/.test(logged.remarks ?? "");
  if (!landings && !hud && !note && !aircraft) return null;
  return {
    ...logged,
    ...(aircraft ?? {}),
    ...(landings
      ? { takeoffsDay: imported.takeoffsDay, takeoffsNight: imported.takeoffsNight, landingsDay: imported.landingsDay, landingsNight: imported.landingsNight, pilotFlying: fromSab ? !!imported.pilotFlying : true }
      : {}),
    ...(hud ? { hudTakeoffs: imported.hudTakeoffs || undefined, hudLandings: imported.hudLandings || undefined } : {}),
    // the "HUD" note an earlier version wrote in the remarks: now a count of its own
    remarks: note ? logged.remarks!.replace(/(^|\s·\s)HUD$/, "").trim() || undefined : logged.remarks,
    updatedAt: now,
  };
}
