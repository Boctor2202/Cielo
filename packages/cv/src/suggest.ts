import { isNonCommercialOperator, type Flight, type OperatorIndex } from "@cielo/core";
import type { CvExperience } from "./types";

/** A past or current job read from the logbook: one per operator flown for. */
export interface ExperienceSuggestion extends CvExperience {
  flights: number;
  totalMin: number;
  /** the main base (the airport most often left from) */
  baseIcao?: string;
}

const ROLE: Record<string, string> = { PIC: "Captain", SIC: "First Officer", PICUS: "First Officer", FI: "Flight Instructor", FE: "Flight Examiner", DUAL: "Trainee Pilot" };
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\b(sas|ltd|limited|gmbh|sa|ag|inc|llc|airlines?|airways|aviation)\b/g, "").replace(/[^a-z0-9]/g, "");

/** The operators of the logbook as CV experiences, most recent first; the ones already on the CV are left out. */
export function experienceFromLogbook(flights: Flight[], ops: OperatorIndex, existing: CvExperience[] = [], today = new Date().toISOString().slice(0, 10)): ExperienceSuggestion[] {
  const by = new Map<string, Flight[]>();
  for (const f of flights) {
    if (f.deletedAt || f.isFstd) continue;
    const op = ops.of(f);
    // private and training flights are not jobs with a company
    if (!op || isNonCommercialOperator(op)) continue;
    by.set(op, [...(by.get(op) ?? []), f]);
  }
  const have = new Set(existing.map((e) => norm(e.employer)).filter(Boolean));
  const recent = new Date(Date.parse(`${today}T00:00:00Z`) - 90 * 86_400_000).toISOString().slice(0, 10);
  const most = <T,>(xs: T[]) => {
    const n = new Map<T, number>();
    for (const x of xs) n.set(x, (n.get(x) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([x]) => x);
  };
  const out: ExperienceSuggestion[] = [];
  for (const [employer, fs] of by) {
    if (have.has(norm(employer))) continue;
    const dates = fs.map((f) => f.date).sort();
    const last = dates[dates.length - 1]!;
    const totalMin = fs.reduce((s, f) => s + f.totalMin, 0);
    const types = most(fs.map((f) => f.aircraftTypeIcao).filter((x): x is string => !!x));
    const role = ROLE[most(fs.map((f) => f.function))[0] ?? ""] ?? "Pilot";
    const base = most(fs.map((f) => f.depIcao))[0];
    out.push({
      role,
      employer,
      start: dates[0]!.slice(0, 7),
      end: last >= recent ? undefined : last.slice(0, 7),
      aircraft: types.slice(0, 4),
      bullets: [],
      flights: fs.length,
      totalMin,
      baseIcao: base,
    });
  }
  return out.sort((a, b) => (b.end ?? "9999").localeCompare(a.end ?? "9999") || b.start.localeCompare(a.start));
}
