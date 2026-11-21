import { File, Paths } from "expo-file-system";
import type { LogbookRescue } from "@cielo/sync";

/**
 * Rescued logbooks (see @cielo/sync rescue) on the phone: a file per account in the app's documents, outside the
 * SQLite database that sign-out clears.
 */
const fileOf = (pilotId: string) => new File(Paths.document, `geardown-rescue-${pilotId.replace(/[^a-zA-Z0-9-]/g, "")}.json`);

export function saveRescue(r: LogbookRescue): void {
  try {
    const f = fileOf(r.pilotId);
    if (f.exists) f.delete();
    f.create();
    f.write(JSON.stringify(r));
  } catch {
    // nothing better to do: the sign-out has already warned about the changes not sent
  }
}

export async function takeRescue(pilotId: string): Promise<LogbookRescue | undefined> {
  try {
    const f = fileOf(pilotId);
    return f.exists ? (JSON.parse(await f.text()) as LogbookRescue) : undefined;
  } catch {
    return undefined;
  }
}

export function dropRescue(pilotId: string): void {
  try {
    const f = fileOf(pilotId);
    if (f.exists) f.delete();
  } catch {}
}
