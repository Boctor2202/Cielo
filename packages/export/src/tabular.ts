import { formatClock, formatDuration, toCsv, type Flight } from "@cielo/core";

export interface TabularOptions {
  decimal?: boolean;
}

export const TABULAR_HEADERS = [
  "Date", "Flight number", "From", "To", "Off-block (UTC)", "Takeoff (UTC)", "Landing (UTC)", "On-block (UTC)",
  "Aircraft type", "Aircraft model", "Registration", "SE", "ME", "Multi-pilot", "Total", "Function", "PIC name",
  "PIC", "PICUS", "Co-pilot", "Dual", "Instructor", "Examiner", "Night", "IFR", "Actual IMC", "Cross-country",
  "Takeoffs day", "Takeoffs night", "Landings day", "Landings night", "Pilot flying", "Approaches",
  "FSTD", "FSTD type", "FSTD time", "Remarks", "Signed",
] as const;

/** One row per entry, in chronological order, durations as h:mm (or decimal). */
export function flightsToRows(flights: Flight[], opts: TabularOptions = {}): (string | number)[][] {
  const d = (m: number) => (m ? formatDuration(m, opts.decimal ? "decimal" : "hhmm") : "");
  return flights
    .filter((f) => !f.deletedAt)
    .sort((a, b) => (a.outUtc ?? a.date).localeCompare(b.outUtc ?? b.date))
    .map((f) => [
      f.date, f.flightNumber ?? "", f.depIcao, f.arrIcao, formatClock(f.outUtc), formatClock(f.offUtc), formatClock(f.onUtc),
      formatClock(f.inUtc), f.aircraftTypeIcao ?? "", f.aircraftModel ?? "", f.registration ?? "", d(f.singlePilotSeMin),
      d(f.singlePilotMeMin), d(f.multiPilotMin), d(f.totalMin), f.function, f.picName ?? "", d(f.picMin), d(f.picusMin),
      d(f.copilotMin), d(f.dualMin), d(f.instructorMin), d(f.examinerMin), d(f.nightMin), d(f.ifrMin), d(f.actualImcMin),
      d(f.xcMin), f.takeoffsDay, f.takeoffsNight, f.landingsDay, f.landingsNight, f.pilotFlying ? "Y" : "",
      (f.approaches ?? []).map((a) => `${a.count}x ${a.type}${a.runway ? " " + a.runway : ""}`).join("; "),
      f.isFstd ? "Y" : "", f.fstdType ?? "", d(f.fstdMin), f.remarks ?? "", f.signatureId ? "Y" : "",
    ]);
}

export function flightsToCsv(flights: Flight[], opts: TabularOptions & { delimiter?: string } = {}): string {
  return toCsv([[...TABULAR_HEADERS], ...flightsToRows(flights, opts)], opts.delimiter ?? ",");
}
