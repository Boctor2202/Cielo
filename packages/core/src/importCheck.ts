import type { ImportedRow } from "./import";
import type { Flight } from "./types";

/**
 * "Check your totals" after reading a logbook file and before saving it: what the file says (its own columns)
 * against what Geardown will record (times worked out from the clock times, the aircraft and the night rules),
 * with every difference row by row, and the rows left out with their reason.
 */
export type CheckField = "total" | "night" | "ifr" | "pic" | "picus" | "copilot" | "dual" | "instructor" | "multiPilot" | "landings";

const FLIGHT_KEY: Record<Exclude<CheckField, "landings">, keyof Flight> = {
  total: "totalMin", night: "nightMin", ifr: "ifrMin", pic: "picMin", picus: "picusMin", copilot: "copilotMin",
  dual: "dualMin", instructor: "instructorMin", multiPilot: "multiPilotMin",
};

export interface TotalLine {
  field: CheckField;
  /** sum of the file's column (minutes, or a count for landings); undefined when the file has no such column */
  file?: number;
  /** what Geardown will record, over the same rows */
  geardown: number;
  /** rows where the two differ (file row numbers, as shown in the preview) */
  rows: number[];
}

export type RejectReason = "date" | "route" | "times" | "duplicate" | "other";

export interface ImportCheck {
  lines: TotalLine[];
  rejected: { row: number; reasons: RejectReason[] }[];
  /** rows read and kept */
  kept: number;
  /** rows whose off-block / on-block times do not match the total written in the file (the total is kept) */
  timesToCheck: number[];
  /** rows with an airport code that is not a known airport (kept as written) */
  airportsToCheck: number[];
}

/** Same minute, or a one-minute rounding (decimal hours in the file). */
const same = (a: number, b: number) => Math.abs(a - b) <= 1;

/**
 * @param rows   the rows read from the file (ImportedRow), in file order
 * @param built  for each kept row, the flight as Geardown would save it (same order as the kept rows)
 * @param duplicates file row indexes skipped as already in the logbook (or twice in the file)
 * @param firstRow  number shown for the first row: 2 in a table (its header is row 1), 1 for flights read from a
 *                  document (a photo, a PDF: flight 1 is the first line of the page)
 */
export function checkImport(rows: ImportedRow[], built: { rowIndex: number; flight: Flight }[], duplicates: number[] = [], firstRow = 2): ImportCheck {
  const byRow = new Map(built.map((b) => [b.rowIndex, b.flight]));
  const lines: TotalLine[] = [];
  const fileRow = (i: number) => i + firstRow;
  for (const field of Object.keys(FLIGHT_KEY) as Exclude<CheckField, "landings">[]) {
    let file: number | undefined;
    let geardown = 0;
    const diff: number[] = [];
    for (const r of rows) {
      const f = byRow.get(r.rowIndex);
      if (!f) continue;
      const g = (f[FLIGHT_KEY[field]] as number) || 0;
      geardown += g;
      const v = r.explicit[field as keyof ImportedRow["explicit"]];
      if (v !== undefined) {
        file = (file ?? 0) + v;
        if (!same(v, g)) diff.push(fileRow(r.rowIndex));
      }
    }
    lines.push({ field, file, geardown, rows: diff });
  }
  // landings: counted from the file's columns when it has them
  let fileLdg: number | undefined;
  let gLdg = 0;
  const ldgDiff: number[] = [];
  for (const r of rows) {
    const f = byRow.get(r.rowIndex);
    if (!f) continue;
    const g = (f.landingsDay || 0) + (f.landingsNight || 0);
    gLdg += g;
    const d = r.input?.landingsDay;
    const n = r.input?.landingsNight;
    if (d !== undefined || n !== undefined) {
      const v = (d ?? 0) + (n ?? 0);
      fileLdg = (fileLdg ?? 0) + v;
      if (v !== g) ldgDiff.push(fileRow(r.rowIndex));
    }
  }
  lines.push({ field: "landings", file: fileLdg, geardown: gLdg, rows: ldgDiff });

  const dup = new Set(duplicates);
  const rejected = rows
    .filter((r) => r.errors.length > 0 || !r.input || dup.has(r.rowIndex))
    .map((r) => ({
      row: fileRow(r.rowIndex),
      reasons: (dup.has(r.rowIndex) ? ["duplicate"] : r.errors.length ? r.errors.map((e) => (e === "date" || e === "route" || e === "times" ? e : "other")) : ["date"]) as RejectReason[],
    }));
  // times that disagree with the written total: the total is kept, the times are worth a look (a misread hour)
  const timesToCheck: number[] = [];
  for (const r of rows) {
    const f = byRow.get(r.rowIndex);
    const written = r.explicit.total;
    if (!f || written === undefined || !f.outUtc || !f.inUtc) continue;
    const block = Math.round((Date.parse(f.inUtc) - Date.parse(f.outUtc)) / 60_000);
    if (Math.abs(block - written) > 5) timesToCheck.push(fileRow(r.rowIndex));
  }
  const airportsToCheck = rows.filter((r) => byRow.has(r.rowIndex) && r.warnings?.includes("airport")).map((r) => fileRow(r.rowIndex));
  return { lines, rejected, kept: built.length, timesToCheck, airportsToCheck };
}
