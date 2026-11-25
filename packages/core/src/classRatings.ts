import { computeRecency, type RecencyCheck } from "./recency";
import type { AircraftType, Flight, License } from "./types";

/**
 * Single-engine and multi-engine piston class ratings (aeroplanes), checked against EASA Part-FCL as published in
 * the Easy Access Rules for Aircrew (read on 25 November 2026):
 *  - recent experience (FCL.060(b)(1)): 3 takeoffs, approaches and landings as pilot flying in the preceding
 *    90 days, in the class (or an FFS representing it);
 *  - validity (FCL.740(a)(1)): 2 years for single-pilot single-engine class ratings, 1 year otherwise;
 *  - SEP revalidation (FCL.740.A(b)(1)): a proficiency check within the 3 months before expiry, or within the 12
 *    months before expiry 12 hours of flight time in the class, of which 6 hours as PIC, 12 takeoffs and 12
 *    landings, and refresher training of at least 1 hour with a flight instructor (FI or CRI);
 *  - MEP revalidation (FCL.740.A(a)): a proficiency check within the 3 months immediately before expiry, and during
 *    the validity period at least 10 route sectors as pilot of the class (or 1 with an examiner).
 */
export type PistonClass = "SEP" | "MEP";

/** The piston class of a flight's aircraft, from its class rating ("SEP(land)") or its engines. */
export function pistonClassOf(f: Flight, types: Pick<AircraftType, "icao" | "category" | "engineType" | "engineCount" | "multiPilot" | "classOrTypeRating">[]): PistonClass | undefined {
  const code = (f.isFstd ? f.fstdType : f.aircraftTypeIcao)?.trim().toUpperCase();
  if (!code) return undefined;
  const t = types.find((x) => x.icao.toUpperCase() === code);
  if (!t) return undefined;
  const rating = t.classOrTypeRating?.toUpperCase() ?? "";
  if (rating.startsWith("SEP")) return "SEP";
  if (rating.startsWith("MEP")) return "MEP";
  if (t.category !== "airplane" || t.engineType !== "piston" || t.multiPilot) return undefined;
  return t.engineCount === 1 ? "SEP" : t.engineCount > 1 ? "MEP" : undefined;
}

/** The pilot's SEP or MEP class rating among the licences (its expiry date, when entered). */
export function classRatingLicense(licenses: License[], kind: PistonClass): License | undefined {
  return licenses.find((l) => !l.deletedAt && new RegExp(`^${kind}\\b`, "i").test(l.code.trim()));
}

export interface SepRevalidation {
  /** the 12 months before expiry, in which the experience counts */
  from: string;
  hours: number;
  picHours: number;
  takeoffs: number;
  landings: number;
  /** a flight of at least 1 hour received from an instructor in the class, in the window */
  instructorFlight?: string;
  met: boolean;
}

export interface MepRevalidation {
  /** first day of the proficiency check window (3 months before expiry) */
  checkFrom: string;
  /** route sectors as pilot of the class during the validity period */
  sectors: number;
}

export interface ClassRatingStatus {
  kind: PistonClass;
  /** flights in the class, ever */
  flights: number;
  recency: RecencyCheck;
  license?: License;
  expiry?: string;
  daysLeft?: number;
  sep?: SepRevalidation;
  mep?: MepRevalidation;
}

const monthsBefore = (date: string, n: number) => {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1 - n, d));
  return t.toISOString().slice(0, 10);
};

export function classRatingStatus(flights: Flight[], types: AircraftType[], licenses: License[], today: string): ClassRatingStatus[] {
  const live = flights.filter((f) => !f.deletedAt && f.date <= today);
  return (["SEP", "MEP"] as const).map((kind) => {
    const inClass = live.filter((f) => pistonClassOf(f, types) === kind);
    const recency = computeRecency(inClass, today).passengers;
    const license = classRatingLicense(licenses, kind);
    const expiry = license?.validUntil ?? undefined;
    const out: ClassRatingStatus = { kind, flights: inClass.length, recency, license, expiry };
    if (expiry) {
      out.daysLeft = Math.round((Date.parse(expiry) - Date.parse(today)) / 86_400_000);
      if (kind === "SEP") {
        const from = monthsBefore(expiry, 12);
        const win = inClass.filter((f) => !f.isFstd && f.date >= from && f.date <= expiry);
        const min = (k: (f: Flight) => number) => win.reduce((s, f) => s + k(f), 0);
        const hours = min((f) => f.totalMin) / 60;
        const picHours = min((f) => f.picMin) / 60;
        const takeoffs = min((f) => f.takeoffsDay + f.takeoffsNight);
        const landings = min((f) => f.landingsDay + f.landingsNight);
        const instructorFlight = win.filter((f) => f.dualMin >= 60).sort((a, b) => b.date.localeCompare(a.date))[0]?.date;
        out.sep = { from, hours, picHours, takeoffs, landings, instructorFlight, met: hours >= 12 && picHours >= 6 && takeoffs >= 12 && landings >= 12 && !!instructorFlight };
      } else {
        const start = monthsBefore(expiry, 12);
        out.mep = { checkFrom: monthsBefore(expiry, 3), sectors: inClass.filter((f) => !f.isFstd && f.date >= start && f.date <= expiry).length };
      }
    }
    return out;
  });
}

