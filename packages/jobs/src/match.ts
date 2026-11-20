import { experience } from "@cielo/core";
import { sameFamily } from "./aircraft";
import { evaluateJob, type Evaluation } from "./evaluate";
import { authorityFromText, defaultWorkRegions, type Authority, type RegionId } from "./regions";
import type { Job, LicenceLevel, PilotProfile } from "./types";

/**
 * "For you" score: how well the subscriber's experience meets a job's stated requirements.
 * Runs on the subscriber's device — the logbook never leaves it.
 */

export type GapCode = "instructorRating" | "examinerRating" | "workRights" | "licenceAuthority" | "licence" | "totalHours" | "picHours" | "onTypeHours" | "multiPilotHours" | "jetHours" | "turbineHours" | "typeRating" | "english";

export interface Gap {
  code: GapCode;
  required: number | string;
  have: number | string;
}

export interface Match {
  /** 0–100 */
  score: number;
  /** how much of the job's requirements Geardown could read (0–1); low means the % is less reliable */
  confidence: number;
  gaps: Gap[];
  /** requirements the pilot meets, for display */
  met: GapCode[];
  /** job's aircraft the pilot is rated / has logged on */
  onType: boolean;
  /** the pilot may work in the job's region (or the employer sponsors the visa) */
  canWork: boolean;
  /** the pilot holds the licence regime the job's country requires */
  licenceValid: boolean;
  /** criterion by criterion (met / unmet / unknown): what the UI shows first; the score is secondary */
  evaluation: Evaluation;
}

const RANK: Record<LicenceLevel, number> = { PPL: 0, CPL: 1, MPL: 2, FATPL: 2, ATPL: 3 };

interface Criterion {
  code: GapCode;
  weight: number;
  /** 0..1, or null when the job does not state it */
  ratio: number | null;
  required?: number | string;
  have?: number | string;
}

export function matchJob(job: Job, me: PilotProfile): Match {
  const r = job.requirements;
  const h = (m: number) => Math.round(m / 60);
  const ratio = (have: number, need?: number) => (need ? Math.min(1, have / need) : null);

  const typeMin = job.aircraft.reduce((s, t) => s + (me.typeMin[t] ?? 0), 0);
  const rated = job.aircraft.some((t) => me.ratedTypes.includes(t) || (me.typeMin[t] ?? 0) > 0);
  const familyRated = !rated && job.aircraft.some((t) => me.ratedTypes.some((x) => sameFamily(t, x)));
  const evaluation = evaluateJob(job, me);
  const verdict = (code: GapCode) => evaluation.criteria.find((c) => c.code === code)?.verdict;

  // PIC on what the ad asks for (jet, multi-engine turboprop…), PIC strict
  const picHave =
    r.picQualifier === "jet" ? me.picJetMin ?? 0
    : r.picQualifier === "jetOrMeTurboprop" ? me.picJetOrMeTurbopropMin ?? 0
    : r.picQualifier === "turbine" ? me.picTurbineMin ?? 0
    : r.picQualifier === "multiEngine" ? me.picMultiEngineMin ?? 0
    : me.picMin;
  const crit: Criterion[] = [
    {
      code: "licence", weight: 15,
      ratio: r.licence ? (me.licence ? (RANK[me.licence] >= Math.min(...(r.licenceAlternatives ?? [r.licence]).map((l) => RANK[l])) ? 1 : RANK[me.licence] + 1 >= RANK[r.licence] ? 0.5 : 0) : 0.3) : null,
      required: r.licence, have: me.licence ?? "—",
    },
    { code: "totalHours", weight: 25, ratio: ratio(me.totalMin, r.totalHours && r.totalHours * 60), required: r.totalHours, have: h(me.totalMin) },
    { code: "picHours", weight: 12, ratio: ratio(picHave, r.picHours && r.picHours * 60), required: r.picHours, have: h(picHave) },
    { code: "onTypeHours", weight: 10, ratio: ratio(typeMin, r.onTypeHours && r.onTypeHours * 60), required: r.onTypeHours, have: h(typeMin) },
    { code: "multiPilotHours", weight: 8, ratio: ratio(me.multiPilotMin, r.multiPilotHours && r.multiPilotHours * 60), required: r.multiPilotHours, have: h(me.multiPilotMin) },
    { code: "jetHours", weight: 8, ratio: ratio(me.jetMin, r.jetHours && r.jetHours * 60), required: r.jetHours, have: h(me.jetMin) },
    { code: "turbineHours", weight: 6, ratio: ratio(me.turbineMin, r.turbineHours && r.turbineHours * 60), required: r.turbineHours, have: h(me.turbineMin) },
    {
      code: "typeRating", weight: 22,
      // required → must hold it; provided / not stated → being rated is a bonus, family rating half
      ratio: job.aircraft.length === 0 ? null : r.typeRatingRequired ? (rated ? 1 : familyRated ? 0.45 : 0) : rated ? 1 : familyRated ? 0.85 : r.typeRatingProvided ? 0.75 : 0.6,
      required: job.aircraft[0], have: rated ? job.aircraft.find((t) => me.ratedTypes.includes(t) || me.typeMin[t]) ?? "✓" : "—",
    },
    { code: "english", weight: 4, ratio: r.englishLevel ? (me.englishLevel ? (me.englishLevel >= r.englishLevel ? 1 : 0.4) : 0.6) : null, required: r.englishLevel, have: me.englishLevel ?? "—" },
  ];

  // Where the job is: licence regime and right to work. Unknown country → not penalised.
  const known = job.region !== "OTHER" && job.authority !== "LOCAL";
  const licenceValid = !known || me.authorities.length === 0 || me.authorities.includes(job.authority);
  const canWork = job.region === "OTHER" || me.workRegions.length === 0 || me.workRegions.includes(job.region) || !!r.visaSponsored;
  if (known && me.authorities.length) crit.push({ code: "licenceAuthority", weight: 15, ratio: licenceValid ? 1 : 0.15, required: job.authority, have: me.authorities.join(", ") });
  if (job.region !== "OTHER" && me.workRegions.length) crit.push({ code: "workRights", weight: 15, ratio: canWork ? 1 : 0, required: job.region, have: me.workRegions.join(", ") });

  // Nothing the ad does not state is assumed (no "a captain needs 1,500 h"): only stated criteria count.

  // Instructor and examiner posts need the rating or certificate itself: hours alone do not qualify.
  const title = job.title;
  const wantsExaminer = /\b(examiner|examinateur|TRE|SFE|FE|CRE|IRE)\b/i.test(title);
  const wantsInstructor = wantsExaminer || job.position === "FI" || /\b(instructor|instructeur|ausbilder|TRI|SFI|CRI|IRI|FI)\b/i.test(title);
  if (wantsInstructor) crit.push({ code: "instructorRating", weight: 30, ratio: me.instructor ? 1 : 0, required: "FI / TRI / SFI", have: me.instructor ? "✓" : "—" });
  if (wantsExaminer) crit.push({ code: "examinerRating", weight: 20, ratio: me.examiner ? 1 : 0, required: "TRE / SFE / FE", have: me.examiner ? "✓" : "—" });

  const stated = crit.filter((c) => c.ratio !== null);
  const totalW = stated.reduce((s, c) => s + c.weight, 0);
  const raw = totalW ? stated.reduce((s, c) => s + c.weight * c.ratio!, 0) / totalW : 0.5;
  // A hard blocker (required type rating not held, licence two levels short) caps the score.
  const blocked = stated.some((c) => (c.code === "typeRating" && r.typeRatingRequired && c.ratio === 0) || (c.code === "licence" && c.ratio === 0));
  const notQualified = (wantsInstructor && !me.instructor) || (wantsExaminer && !me.examiner);
  // No right to work there is the hardest blocker; a foreign licence can be converted, at a cost.
  const cap = notQualified ? 0.2 : !canWork ? 0.35 : !licenceValid ? 0.5 : blocked ? 0.55 : 1;

  const gaps: Gap[] = [];
  const met: GapCode[] = [];
  for (const c of stated) {
    if (c.ratio! >= 0.999) {
      if (!met.includes(c.code)) met.push(c.code);
    } else if (c.required !== undefined && !gaps.some((g) => g.code === c.code)) gaps.push({ code: c.code, required: c.required, have: c.have ?? "—" });
  }
  const readable = ["licence", "totalHours", "picHours", "typeRating"] as const;
  const confidence = readable.filter((k) => (k === "typeRating" ? job.aircraft.length > 0 : r[k as "licence"] !== undefined)).length / readable.length;
  // When the offer states little, the few criteria read cannot make a 100 %: the score leans towards 60 %.
  const trust = 0.4 + 0.6 * confidence;
  const score = Math.round(Math.min(cap, raw * trust + 0.6 * (1 - trust)) * 100);

  // unknowns never count as met: the score cannot exceed the share of criteria actually met or unclear
  return { score, confidence, gaps, met, onType: rated, canWork: verdict("workRights") !== "unmet" && canWork, licenceValid: verdict("licenceAuthority") !== "unmet" && licenceValid, evaluation };
}

/** Builds the profile from logbook rows (kept generic so web and mobile share it). */
export function buildProfile(
  flights: { totalMin: number; picMin: number; picusMin: number; multiPilotMin: number; singlePilotMeMin: number; aircraftTypeIcao?: string; isFstd: boolean; deletedAt?: string | null; copilotMin?: number }[],
  opening: { totalMin: number; picMin: number; multiPilotMin: number; singlePilotMeMin: number; aircraftTypeIcao?: string | null; deletedAt?: string | null }[],
  licences: { code: string; kind: string; authority?: string; deletedAt?: string | null; validUntil?: string | null }[],
  engineTypeOf: (icao: string) => string | undefined,
  icaoFromRating: (code: string) => string[],
  opts: { framework?: string; workRegions?: RegionId[] } = {},
): PilotProfile {
  // one definition of each figure, shared with the app and the CV (PIC strict, PICUS apart): see core experience.ts
  const x = experience(flights, opening, engineTypeOf);
  const typeMin: Record<string, number> = {};
  for (const [icao, r] of Object.entries(x.byType)) typeMin[icao] = r.totalMin;
  const p: PilotProfile = {
    totalMin: x.totalMin, picMin: x.picMin, picusMin: x.picusMin, picJetOrMeTurbopropMin: x.picJetOrMeTurbopropMin,
    picJetMin: x.picJetMin, picTurbineMin: x.picTurbineMin, picMultiEngineMin: x.picMultiEngineMin,
    multiPilotMin: x.multiPilotMin, multiEngineMin: x.multiEngineMin, turbineMin: x.turbineMin, jetMin: x.jetMin,
    typeMin, ratedTypes: [], authorities: [], workRegions: [],
    unknown: { engineMin: x.unknown.engineMin, openingNoTypeMin: x.unknown.openingNoTypeMin, openingPicMin: x.unknown.openingPicMin },
  };
  for (const l of licences) {
    if (l.deletedAt) continue;
    const c = l.code.toUpperCase();
    if (l.kind === "licence") {
      const a = authorityFromText(l.authority) ?? authorityFromText(c);
      if (a && !p.authorities.includes(a)) p.authorities.push(a);
      const lvl: LicenceLevel | undefined = /ATPL/.test(c) ? (/FROZEN/.test(c) ? "FATPL" : "ATPL") : /MPL/.test(c) ? "MPL" : /CPL/.test(c) ? "CPL" : /PPL|LAPL/.test(c) ? "PPL" : undefined;
      if (lvl && (!p.licence || RANK[lvl] > RANK[p.licence])) p.licence = lvl;
    }
    if (l.kind === "rating" || l.kind === "class_rating" || l.kind === "type_rating" || l.kind === "skill_rating") for (const i of icaoFromRating(c)) if (!p.ratedTypes.includes(i)) p.ratedTypes.push(i);
    if ((!l.validUntil || l.validUntil >= new Date().toISOString().slice(0, 10)) && /\b(FI|CRI|IRI|TRI|SFI|MCCI|STI|FIC|INSTRUCT\w*)\b/.test(c)) p.instructor = true;
    if ((!l.validUntil || l.validUntil >= new Date().toISOString().slice(0, 10)) && /\b(FE|TRE|CRE|IRE|SFE|FIE|EXAMIN\w*)\b/.test(c)) p.examiner = true;
    if (l.kind === "language" && /ENGLISH|ANGLAIS/.test(c)) {
      const m = c.match(/([4-6])/);
      if (m) p.englishLevel = Math.max(p.englishLevel ?? 0, Number(m[1]));
    }
  }
  for (const icao of Object.keys(p.typeMin)) if (!p.ratedTypes.includes(icao)) p.ratedTypes.push(icao);
  // Licence regime from the pilot's settings when the licence record does not say
  if (!p.authorities.length && opts.framework) {
    const a = ({ EASA: "EASA", FAA: "FAA", CASA: "CASA" } as Record<string, Authority>)[opts.framework];
    if (a) p.authorities.push(a);
  }
  p.workRegionsDeclared = !!opts.workRegions?.length;
  p.workRegions = opts.workRegions?.length ? opts.workRegions : defaultWorkRegions(p.authorities);
  return p;
}
