import Dexie, { type Table } from "dexie";
import type { LogbookRescue } from "@cielo/sync";

/**
 * Rescued logbooks (see @cielo/sync rescue): kept in their own IndexedDB database, so clearing the logbook's
 * database never takes them along. One copy per account; the newest wins.
 */
class RescueDb extends Dexie {
  copies!: Table<LogbookRescue, string>;
  constructor() {
    super("geardown-rescue");
    this.version(1).stores({ copies: "pilotId" });
  }
}

let db: RescueDb | null = null;
const rescueDb = () => (db ??= new RescueDb());

export const saveRescue = (r: LogbookRescue) => rescueDb().copies.put(r).catch(() => undefined);
export const takeRescue = (pilotId: string) => rescueDb().copies.get(pilotId).catch(() => undefined);
export const dropRescue = (pilotId: string) => rescueDb().copies.delete(pilotId).catch(() => undefined);
