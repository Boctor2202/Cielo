import { airlineDirectory, type AirlineDirectory } from "@cielo/core";

/** The world airline directory (OpenFlights + our own table), built on first use. */
let dir: AirlineDirectory | null = null;
export function airlines(): AirlineDirectory {
  if (!dir) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const file = require("@cielo/reference-data/airlines.json") as { rows: Parameters<typeof airlineDirectory>[0] };
    dir = airlineDirectory(file.rows);
  }
  return dir;
}
