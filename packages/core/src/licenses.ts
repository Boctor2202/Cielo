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
  { kind: "rating", code: "SEP(land)" },
  { kind: "rating", code: "MEP(land)" },
  { kind: "rating", code: "TMG" },
  { kind: "rating", code: "TR" },
  { kind: "rating", code: "IR(A)" },
  { kind: "rating", code: "IR(A) ME" },
  { kind: "rating", code: "BIR" },
  { kind: "rating", code: "CB-IR(A)" },
  { kind: "rating", code: "FI(A)" },
  { kind: "rating", code: "CRI(A)" },
  { kind: "rating", code: "IRI(A)" },
  { kind: "rating", code: "TRI(A)" },
  { kind: "rating", code: "FE(A)" },
  { kind: "rating", code: "Night rating" },
  { kind: "rating", code: "Aerobatic" },
  { kind: "rating", code: "Mountain" },
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
