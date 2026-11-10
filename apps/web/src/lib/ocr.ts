import { parseDuration, parseFlexibleDate, type ImportedRow } from "@cielo/core";

/**
 * Heuristic parser for OCR'd paper logbook pages (EASA layout: date, dep place/time, arr place/time, type, reg, ...).
 * Each text line holding a date and two aerodrome codes becomes a candidate row; the pilot reviews before import.
 */
export function parseOcrText(text: string, isAirport: (icao: string) => boolean): ImportedRow[] {
  const out: ImportedRow[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.replace(/[|[\]{}]/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
  lines.forEach((line, rowIndex) => {
    const dateM = line.match(/\b(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})\b/);
    if (!dateM) return;
    const date = parseFlexibleDate(dateM[1]!);
    const codes = [...line.matchAll(/\b([A-Z]{4})\b/g)].map((m) => m[1]!).filter(isAirport);
    const clocks = [...line.matchAll(/\b([01]?\d|2[0-3])[:h.]?([0-5]\d)\b/g)].map((m) => `${m[1]!.padStart(2, "0")}:${m[2]}`);
    const reg = line.match(/\b([A-Z]{1,2}-[A-Z0-9]{3,5}|N\d{1,5}[A-Z]{0,2})\b/)?.[1];
    const durations = [...line.matchAll(/\b(\d{1,2}[:h]\d{2})\b/g)].map((m) => parseDuration(m[1]!)).filter((v): v is number => v !== null);
    const errors: string[] = [];
    if (!date) errors.push("date");
    if (codes.length < 2) errors.push("route");
    if (clocks.length < 2) errors.push("times");
    out.push({
      rowIndex,
      errors,
      explicit: durations.length > 2 ? { total: durations[2] } : {},
      input: date
        ? {
            date,
            depIcao: codes[0] ?? "",
            arrIcao: codes[1] ?? "",
            out: clocks[0],
            in: clocks[1],
            registration: reg,
            function: "PIC",
            ifr: false,
            pilotFlying: true,
            autoLandings: true,
            isFstd: false,
            remarks: "Scan",
          }
        : undefined,
    });
  });
  return out;
}
