import { useEffect } from "react";
import { Platform } from "react-native";
import { flightRevision, misreadOperators, operatorIndex, retypeLogbook, stamp, type Flight, type FlightRevision, type SyncedRecord } from "@cielo/core";
import { airlines } from "../airlines";
import { useApp } from "../state";

const KEY = "backfill:operators:v1";
const REPAIR = "repair:operators:v2";

/**
 * Once per device: flights entered or imported before operators were recorded get the operator the logbook
 * recognises for them (call sign, aircraft, what it learned). Signatures stay valid (the operator is not signed).
 */
export function OperatorBackfill() {
  const { store, pilot, access, reload } = useApp();
  useEffect(() => {
    if (!pilot || !access.canWrite) return;
    const id = setTimeout(async () => {
      try {
        // at each launch: flights and aircraft imported with a type name instead of its designator
        {
          const types = (await store.all("aircraft_types")).filter((t) => !t.deletedAt);
          const flights = await store.all("flights");
          const aircraft = await store.all("aircraft");
          const r = retypeLogbook(flights, aircraft, types);
          if (r.flights.length || r.aircraft.length) {
            const byF = new Map(flights.map((f) => [f.id, f]));
            const byA = new Map(aircraft.map((a) => [a.id, a]));
            const fs = r.flights.map((x) => stamp({ ...byF.get(x.id)!, aircraftTypeIcao: x.icao, aircraftModel: x.model }) as Flight);
            const as = r.aircraft.map((x) => stamp({ ...byA.get(x.id)!, aircraftTypeId: x.typeId }));
            if (fs.length) await store.bulkPut("flights", fs);
            if (as.length) await store.bulkPut("aircraft", as as never);
            await reload();
          }
        }
        // first, once: the operators an earlier version read from a registration typed as the flight number
        if (!(await store.getMeta(REPAIR))) {
          const all = (await store.all("flights")).filter((f) => !f.deletedAt);
          if (all.length) {
            const ids = new Set(misreadOperators(all, airlines()));
            const fixed = all.filter((f) => ids.has(f.id)).map((f) => stamp({ ...f, operator: undefined }) as Flight);
            if (fixed.length) {
              await store.bulkPut("flights", fixed);
              await reload();
            }
            await store.setMeta(REPAIR, new Date().toISOString());
          }
        }
        if (await store.getMeta(KEY)) return;
        const flights = (await store.all("flights")).filter((f) => !f.deletedAt);
        // nothing here yet (before the first sync): try again next time
        if (!flights.length) return;
        const ops = operatorIndex(flights, await store.all("aircraft"), airlines());
        const next: Flight[] = [];
        for (const f of flights) {
          if (f.operator || f.isFstd) continue;
          const op = ops.of(f);
          if (op) next.push(stamp({ ...f, operator: op }) as Flight);
        }
        if (next.length) {
          // in one write, with each flight's audit trail entry, then one reload (synced like any change)
          await store.bulkPut("flights", next);
          const byId = new Map(flights.map((f) => [f.id, f]));
          const os = Platform.OS === "android" ? "android" : "ios";
          const revs = next.map((f) => flightRevision(byId.get(f.id), f, os)).filter(Boolean).map((r) => stamp(r as Partial<SyncedRecord>) as unknown as FlightRevision);
          if (revs.length) await store.bulkPut("flight_revisions", revs);
          await reload();
        }
        await store.setMeta(KEY, new Date().toISOString());
      } catch {
        // tried again at the next launch
      }
    }, 8000);
    return () => clearTimeout(id);
  }, [pilot?.id, access.canWrite]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
