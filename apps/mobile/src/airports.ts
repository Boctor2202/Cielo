import { AirportIndex, expandAirports, type AirportFile } from "@cielo/reference-data";

let index: AirportIndex | null = null;

/** Airport database (OurAirports, ~1.8 MB) bundled with the app and indexed once, lazily. */
export function airports(): AirportIndex {
  if (!index) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const file = require("@cielo/reference-data/airports.json") as AirportFile;
    index = new AirportIndex(expandAirports(file));
  }
  return index;
}

export const lookupAirport = (icao: string) => airports().get(icao);
