import type { Flight, FlightRevision, RevisionAction } from "./types";

/** Fields that are bookkeeping, not logbook content: never recorded as changes. */
const META = new Set(["id", "createdAt", "updatedAt", "pilotId"]);

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Field-by-field differences between two versions of a flight (old → new). */
export function diffFlight(prev: Partial<Flight> | undefined, next: Partial<Flight>): { field: string; from: unknown; to: unknown }[] {
  const keys = new Set([...Object.keys(prev ?? {}), ...Object.keys(next)]);
  const out: { field: string; from: unknown; to: unknown }[] = [];
  for (const k of [...keys].sort()) {
    if (META.has(k)) continue;
    const a = (prev as Record<string, unknown> | undefined)?.[k];
    const b = (next as Record<string, unknown>)[k];
    if (!same(a, b)) out.push({ field: k, from: a ?? null, to: b ?? null });
  }
  return out;
}

/**
 * The revision to record when a flight is saved, or null when nothing in it changed. The kind of change is read
 * from the fields: created, deleted, restored, signed, signature removed, or edited.
 */
export function flightRevision(
  prev: Flight | undefined,
  next: Flight,
  source: FlightRevision["source"],
  at = new Date().toISOString(),
): Omit<FlightRevision, "id" | "createdAt" | "updatedAt"> | null {
  const changes = prev ? diffFlight(prev, next) : [];
  if (prev && !changes.length) return null;
  let action: RevisionAction = "update";
  if (!prev) action = "create";
  else if (!prev.deletedAt && next.deletedAt) action = "delete";
  else if (prev.deletedAt && !next.deletedAt) action = "restore";
  else if (!prev.signatureId && next.signatureId) action = "sign";
  else if (prev.signatureId && !next.signatureId) action = "unsign";
  return { pilotId: next.pilotId, flightId: next.id, at, action, source, changes: prev ? changes : [] };
}

/** The flight as it was before a revision: its "from" values put back (to undo a change). */
export function revertRevision(current: Flight, rev: Pick<FlightRevision, "changes">): Flight {
  const out = { ...current } as Record<string, unknown>;
  for (const c of rev.changes) {
    if (c.field === "signatureId" || c.field === "locked") continue;
    if (c.from === null || c.from === undefined) delete out[c.field];
    else out[c.field] = c.from;
  }
  return out as unknown as Flight;
}

/** Changes not worth showing (internal ids, or already said by the action: deleted, signed). */
const HIDDEN = new Set(["signatureId", "locked", "deletedAt", "aircraftId", "rosterEventId", "nightCalc", "source"]);
export const visibleChanges = (rev: Pick<FlightRevision, "changes">) => rev.changes.filter((c) => !HIDDEN.has(c.field));

const LABELS: Record<"fr" | "en", Record<string, string>> = {
  fr: {
    date: "Date", flightNumber: "N° de vol", depIcao: "Départ", arrIcao: "Arrivée", outUtc: "Bloc départ", offUtc: "Décollage", onUtc: "Atterrissage",
    inUtc: "Bloc arrivée", registration: "Immatriculation", aircraftTypeIcao: "Type", aircraftModel: "Modèle", totalMin: "Temps total",
    airMin: "Temps de vol", singlePilotSeMin: "Monopilote monomoteur", singlePilotMeMin: "Monopilote multimoteur", multiPilotMin: "Multipilote",
    function: "Fonction", picName: "Commandant de bord", picMin: "CDB", picusMin: "PICUS", copilotMin: "Copilote", dualMin: "Double commande",
    instructorMin: "Instructeur", examinerMin: "Examinateur", nightMin: "Nuit", ifrMin: "IFR", actualImcMin: "IMC réel", xcMin: "Navigation",
    takeoffsDay: "Décollages jour", takeoffsNight: "Décollages nuit", landingsDay: "Atterrissages jour", landingsNight: "Atterrissages nuit",
    pilotFlying: "PF", approaches: "Approches", isFstd: "Simulateur", fstdType: "Type de simulateur", fstdQualification: "Qualification FSTD",
    fstdMin: "Temps simulateur", crew: "Équipage", remarks: "Remarques",
  },
  en: {
    date: "Date", flightNumber: "Flight no.", depIcao: "From", arrIcao: "To", outUtc: "Off-block", offUtc: "Take-off", onUtc: "Landing",
    inUtc: "On-block", registration: "Registration", aircraftTypeIcao: "Type", aircraftModel: "Model", totalMin: "Total time",
    airMin: "Air time", singlePilotSeMin: "Single-pilot SE", singlePilotMeMin: "Single-pilot ME", multiPilotMin: "Multi-pilot",
    function: "Function", picName: "PIC name", picMin: "PIC", picusMin: "PICUS", copilotMin: "Co-pilot", dualMin: "Dual",
    instructorMin: "Instructor", examinerMin: "Examiner", nightMin: "Night", ifrMin: "IFR", actualImcMin: "Actual IMC", xcMin: "Cross-country",
    takeoffsDay: "Day take-offs", takeoffsNight: "Night take-offs", landingsDay: "Day landings", landingsNight: "Night landings",
    pilotFlying: "PF", approaches: "Approaches", isFstd: "Simulator", fstdType: "Simulator type", fstdQualification: "FSTD qualification",
    fstdMin: "Simulator time", crew: "Crew", remarks: "Remarks",
  },
};
export const revisionFieldLabel = (field: string, locale: string) => LABELS[locale === "fr" ? "fr" : "en"][field] ?? field;

/** A value of a change, readable: durations as h:mm, times as hh:mm UTC, lists summarised. */
export function revisionValue(field: string, v: unknown, locale: string): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? (locale === "fr" ? "oui" : "yes") : locale === "fr" ? "non" : "no";
  if (typeof v === "number" && /Min$/.test(field)) return `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, "0")}`;
  if (typeof v === "string" && /Utc$/.test(field)) return `${v.slice(11, 16)} UTC${v.slice(0, 10) ? ` (${v.slice(0, 10)})` : ""}`;
  if (field === "approaches" && Array.isArray(v)) return v.map((a: { type?: string; count?: number }) => `${a.count ?? 1}× ${a.type ?? ""}`.trim()).join(", ") || "—";
  if (field === "crew" && Array.isArray(v)) return v.map((c: { name?: string; role?: string }) => [c.name, c.role].filter(Boolean).join(" ")).join(", ") || "—";
  if (typeof v === "object") return JSON.stringify(v).slice(0, 80);
  return String(v);
}
