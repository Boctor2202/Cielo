import type { CvDocument } from "./document";
import type { CvData } from "./types";

/**
 * Pre-submission check against what airline screening (ATS / AI readers) looks for.
 * Each item is a short code the UI translates; "warn" items lower the score less than "fail" ones.
 */

export type CheckCode =
  | "name" | "contact" | "summary" | "summaryLength" | "totalHours" | "picHours" | "typeHours" | "licence" | "licenceNumber"
  | "medical" | "medicalValid" | "language" | "experience" | "experienceBullets" | "recency" | "targetKeywords" | "targetType";

export interface Check {
  code: CheckCode;
  status: "ok" | "warn" | "fail";
  /** extra value for the message (e.g. missing keywords) */
  detail?: string;
}

export interface AtsReport {
  score: number;
  checks: Check[];
  /** target keywords found / missing in the CV text */
  keywords: { found: string[]; missing: string[] };
}

export function atsReport(cv: CvData, doc: CvDocument, text: string, today: string): AtsReport {
  const c: Check[] = [];
  const add = (code: CheckCode, ok: boolean, level: "warn" | "fail" = "fail", detail?: string) => c.push({ code, status: ok ? "ok" : level, detail });
  const p = cv.profile;
  const h = cv.hours;
  const lic = cv.licences;

  add("name", !!p.fullName.trim());
  add("contact", !!p.email && !!p.phone, p.email || p.phone ? "warn" : "fail");
  add("summary", !!p.summary?.trim(), "warn");
  const words = p.summary?.trim().split(/\s+/).length ?? 0;
  if (words) add("summaryLength", words >= 25 && words <= 90, "warn", String(words));
  add("totalHours", h.totalMin > 0);
  add("picHours", h.picMin + h.picusMin > 0, "warn");
  add("typeHours", h.byType.length > 0, "warn");
  add("licence", lic.some((l) => l.kind === "licence"));
  add("licenceNumber", lic.some((l) => l.kind === "licence" && !!l.number), "warn");
  const med = lic.find((l) => l.kind === "medical");
  add("medical", !!med, "warn");
  if (med?.validUntil) add("medicalValid", med.validUntil >= today, "fail", med.validUntil);
  add("language", p.languages.length > 0 || lic.some((l) => l.kind === "language"), "warn");
  add("experience", p.experience.length > 0, "warn");
  if (p.experience.length) add("experienceBullets", p.experience.every((x) => x.bullets.filter((b) => b.trim()).length >= 2), "warn");
  add("recency", h.last90dMin > 0 || !h.lastFlight, "warn", h.lastFlight);

  const hay = text.toLowerCase();
  // a long phrase (an offer title kept by an older draft) is not a keyword
  const kws = [...new Set([...(p.target?.keywords ?? []).filter((k) => k.trim().split(/\s+/).length <= 3), ...(p.target?.aircraft ?? [])])];
  const found = kws.filter((k) => hay.includes(k.toLowerCase()));
  const missing = kws.filter((k) => !hay.includes(k.toLowerCase()));
  if (kws.length) add("targetKeywords", missing.length === 0, "warn", missing.join(", "));
  if (p.target?.aircraft?.length) add("targetType", p.target.aircraft.some((a) => h.byType.some((t) => t.icao === a)), "warn", p.target.aircraft[0]);

  const weight = { ok: 1, warn: 0.5, fail: 0 } as const;
  const score = Math.round((c.reduce((s, x) => s + weight[x.status], 0) / c.length) * 100);
  void doc;
  return { score, checks: c, keywords: { found, missing } };
}
