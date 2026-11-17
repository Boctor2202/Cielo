import { daysBetween } from "./time";
import type { License } from "./types";

export type ValidityState = "valid" | "expiring" | "expired" | "no_expiry";

export interface LicenseStatus {
  state: ValidityState;
  daysLeft?: number;
  /** The alert threshold currently crossed (e.g. 30 when 12 days left with [90,30,7]) */
  threshold?: number;
}

export const DEFAULT_ALERT_DAYS = [90, 30, 7];

export function licenseStatus(l: Pick<License, "validUntil" | "alertDays">, today: string): LicenseStatus {
  if (!l.validUntil) return { state: "no_expiry" };
  const daysLeft = daysBetween(today, l.validUntil);
  if (daysLeft < 0) return { state: "expired", daysLeft };
  const thresholds = [...(l.alertDays?.length ? l.alertDays : DEFAULT_ALERT_DAYS)].sort((a, b) => a - b);
  const crossed = thresholds.find((d) => daysLeft <= d);
  const max = thresholds[thresholds.length - 1] ?? 90;
  return { state: daysLeft <= max ? "expiring" : "valid", daysLeft, threshold: crossed };
}

/** Alerts due today: a license crosses one of its thresholds exactly today, or expires today. */
export function alertsDueToday(licenses: License[], today: string): { license: License; daysLeft: number }[] {
  const out: { license: License; daysLeft: number }[] = [];
  for (const l of licenses) {
    if (l.deletedAt || !l.validUntil) continue;
    const d = daysBetween(today, l.validUntil);
    const th = l.alertDays?.length ? l.alertDays : DEFAULT_ALERT_DAYS;
    if (th.includes(d) || d === 0) out.push({ license: l, daysLeft: d });
  }
  return out;
}

/** Suggested catalogue for the license form (EASA Part-FCL first). */
export const LICENSE_CATALOGUE: { kind: License["kind"]; code: string }[] = [
  { kind: "licence", code: "LAPL(A)" },
  { kind: "licence", code: "PPL(A)" },
  { kind: "licence", code: "CPL(A)" },
  { kind: "licence", code: "MPL" },
  { kind: "licence", code: "ATPL(A)" },
  { kind: "licence", code: "PPL(H)" },
  { kind: "licence", code: "CPL(H)" },
  { kind: "licence", code: "ATPL(H)" },
  { kind: "licence", code: "SPL" },
  { kind: "medical", code: "Class 1" },
  { kind: "medical", code: "Class 2" },
  { kind: "medical", code: "LAPL medical" },
  { kind: "class_rating", code: "SEP(land)" },
  { kind: "class_rating", code: "MEP(land)" },
  { kind: "class_rating", code: "TMG" },
  { kind: "type_rating", code: "TR" },
  { kind: "skill_rating", code: "IR(A)" },
  { kind: "skill_rating", code: "IR(A) ME" },
  { kind: "skill_rating", code: "BIR" },
  { kind: "skill_rating", code: "CB-IR(A)" },
  { kind: "skill_rating", code: "FI(A)" },
  { kind: "skill_rating", code: "CRI(A)" },
  { kind: "skill_rating", code: "IRI(A)" },
  { kind: "skill_rating", code: "TRI(A)" },
  { kind: "skill_rating", code: "FE(A)" },
  { kind: "skill_rating", code: "Night rating" },
  { kind: "skill_rating", code: "Aerobatic" },
  { kind: "skill_rating", code: "Mountain" },
  { kind: "class_rating", code: "SET(land)" },
  { kind: "class_rating", code: "SEP(sea)" },
  { kind: "skill_rating", code: "EIR" },
  { kind: "skill_rating", code: "TRE(A)" },
  { kind: "skill_rating", code: "SFI(A)" },
  { kind: "skill_rating", code: "MCCI(A)" },
  { kind: "skill_rating", code: "Towing" },
  { kind: "radio", code: "FRTOL (radiotelephony)" },
  { kind: "radio", code: "Restricted radiotelephony" },
  { kind: "insurance", code: "Loss of licence" },
  { kind: "insurance", code: "Liability" },
  { kind: "endorsement", code: "Tailwheel" },
  { kind: "endorsement", code: "Variable pitch propeller" },
  { kind: "endorsement", code: "Retractable undercarriage" },
  { kind: "endorsement", code: "Pressurised" },
  { kind: "endorsement", code: "EFIS" },
  { kind: "language", code: "LPE English" },
  { kind: "language", code: "LPE French" },
  { kind: "other", code: "OPC / LPC" },
  { kind: "other", code: "Line check" },
  { kind: "other", code: "Dangerous goods" },
  { kind: "other", code: "CRM" },
  { kind: "other", code: "SEP / safety training" },
  { kind: "other", code: "Passport" },
  { kind: "other", code: "Crew ID / Badge" },
];

/* ---------- Language proficiency (FCL.055) ---------- */

/** Languages offered for an LPE; any other can be typed. Stored in English, as screening software reads it. */
export const LPE_LANGUAGES = ["English", "French", "Spanish", "German", "Italian", "Portuguese", "Dutch", "Arabic", "Chinese", "Russian", "Japanese"] as const;

/** Validity of a language proficiency endorsement (EASA FCL.055): level 4 four years, 5 six years, 6 no expiry. */
export function lpeValidUntil(level: number, assessedOn: string | null | undefined): string | null {
  if (!assessedOn || level >= 6) return null;
  const years = level === 5 ? 6 : 4;
  const d = new Date(`${assessedOn.slice(0, 10)}T12:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

/** "LPE English 6" ⇄ { language: "English", level: 6 } */
export function lpeCode(language: string, level?: number): string {
  return `LPE ${language.trim()}${level ? ` ${level}` : ""}`.trim();
}
export function parseLpe(code: string): { language: string; level?: number } {
  const m = code.trim().match(/^(?:LPE\s+)?(.*?)(?:\s+(?:level\s*|niveau\s*)?([4-6]))?$/i);
  return { language: m?.[1]?.trim() ?? "", level: m?.[2] ? Number(m[2]) : undefined };
}

/* ---------- Medical certificates (EASA MED.A.045) ---------- */

export type MedicalClass = "Class 1" | "Class 2" | "LAPL medical";
export const MEDICAL_CLASSES: MedicalClass[] = ["Class 1", "Class 2", "LAPL medical"];
/** Age at the examination, in the bands the validity depends on. */
export type AgeBand = "u40" | "40to49" | "50to59" | "60plus";
export const AGE_BANDS: AgeBand[] = ["u40", "40to49", "50to59", "60plus"];
/** Usual limitation codes written on a medical certificate. */
export const MEDICAL_LIMITATIONS = ["VDL", "VML", "VNL", "CCL", "OML", "OCL", "SIC", "TML", "RXO"] as const;

/**
 * Months of validity of a medical certificate (MED.A.045): class 1 twelve months, six from 60 or from 40 in
 * single-pilot commercial passenger operations; class 2 sixty months under 40, 24 under 50, then 12;
 * LAPL sixty months under 40, then 24.
 */
export function medicalValidityMonths(cls: MedicalClass, age: AgeBand, singlePilotPax = false): number {
  if (cls === "Class 1") return age === "60plus" || (singlePilotPax && age !== "u40") ? 6 : 12;
  if (cls === "Class 2") return age === "u40" ? 60 : age === "40to49" ? 24 : 12;
  return age === "u40" ? 60 : 24;
}

/** Valid until the end of the period counted from the examination date (the day before the anniversary). */
export function medicalValidUntil(cls: MedicalClass, examOn: string | null | undefined, age: AgeBand, singlePilotPax = false): string | null {
  if (!examOn) return null;
  const d = new Date(`${examOn.slice(0, 10)}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + medicalValidityMonths(cls, age, singlePilotPax));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Which fields a document form shows, by category. */
export interface DocumentForm {
  number: boolean;
  authority: "authority" | "aemc" | "organisation" | false;
  issued: "issuedOn" | "examOn" | "assessedOn" | "obtainedOn" | false;
  /** true: shown; "optional": hidden behind a link (licences do not expire); false: none */
  validity: true | "optional" | false;
  lastCheck: boolean;
}
export const DOCUMENT_FORMS: Record<License["kind"], DocumentForm> = {
  licence: { number: true, authority: "authority", issued: "issuedOn", validity: "optional", lastCheck: false },
  medical: { number: false, authority: "aemc", issued: "examOn", validity: true, lastCheck: false },
  rating: { number: false, authority: "authority", issued: "issuedOn", validity: true, lastCheck: true },
  class_rating: { number: false, authority: "authority", issued: "issuedOn", validity: true, lastCheck: true },
  type_rating: { number: false, authority: "authority", issued: "issuedOn", validity: true, lastCheck: true },
  skill_rating: { number: false, authority: "authority", issued: "issuedOn", validity: "optional", lastCheck: true },
  endorsement: { number: false, authority: false, issued: "obtainedOn", validity: false, lastCheck: false },
  language: { number: false, authority: "authority", issued: "assessedOn", validity: true, lastCheck: false },
  radio: { number: true, authority: "authority", issued: "issuedOn", validity: "optional", lastCheck: false },
  insurance: { number: true, authority: "organisation", issued: "issuedOn", validity: true, lastCheck: false },
  other: { number: true, authority: "organisation", issued: "issuedOn", validity: true, lastCheck: false },
};

/** Any kind of rating (class, type, additional, or the older single "rating" category). */
export const isRatingKind = (k: string) => k === "rating" || k === "class_rating" || k === "type_rating" || k === "skill_rating";

/** Categories offered in the document forms, in display order ("rating" stays readable but is not offered). */
export const DOCUMENT_KINDS = ["licence", "class_rating", "type_rating", "skill_rating", "medical", "language", "radio", "insurance", "endorsement", "other"] as const;
