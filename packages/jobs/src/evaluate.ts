import { sameFamily } from "./aircraft";
import type { GapCode } from "./match";
import type { HourKey, Job, LicenceLevel, PicQualifier, PilotProfile } from "./types";

/**
 * Criterion by criterion: what the ad states, what the logbook shows, and one of three verdicts.
 *   met      — the logbook shows it, without relying on anything Geardown could not classify;
 *   unmet    — the logbook clearly falls short;
 *   unknown  — Geardown cannot tell (no licence entered, unclassified carry-forwards, work rights not declared,
 *              country-specific rules…). Unknown is never counted as met.
 * Only what the ad states is evaluated: nothing is assumed (no "a captain needs 1,500 h").
 */
export type Verdict = "met" | "unmet" | "unknown";

/** why a criterion is unknown or how it was read, for the UI wording */
export type Reason =
  | "noLicence"
  | "noEnglish"
  | "noAuthority"
  | "openingPic"
  | "unclassified"
  | "workRightsNotDeclared"
  | "workRightsCountry"
  | "visaSponsored"
  | "familyRating"
  | "authorityFromCountry";

export interface CriterionResult {
  code: GapCode;
  verdict: Verdict;
  /** as stated in the ad (hours, licence, type, region…) */
  required: number | string;
  /** what the logbook shows (hours rounded down, or a label) */
  have?: number | string;
  /** false when the ad gives it as preferred / an advantage */
  mandatory: boolean;
  /** for PIC hours: what they must be on */
  qualifier?: PicQualifier;
  reason?: Reason;
  /** excerpt of the ad the requirement was read from */
  evidence?: string;
}

export interface Evaluation {
  criteria: CriterionResult[];
  met: number;
  unmet: number;
  unknown: number;
  /** mandatory criteria clearly not met */
  blockers: CriterionResult[];
}

const RANK: Record<LicenceLevel, number> = { PPL: 0, CPL: 1, MPL: 2, FATPL: 2, ATPL: 3 };
const H = (min: number) => Math.floor(min / 60);
/** work rights can be declared per region only where one right covers the whole region */
const REGION_WIDE = new Set(["EU", "UK", "US", "CA"]);

export function evaluateJob(job: Job, me: PilotProfile): Evaluation {
  const r = job.requirements;
  const out: CriterionResult[] = [];
  const preferred = new Set(r.preferred ?? []);
  const u = me.unknown ?? { engineMin: 0, openingNoTypeMin: 0, openingPicMin: 0 };

  /** hours: met only if the certain part reaches it; unknown if what could not be classified might */
  const hours = (code: GapCode, key: HourKey, need: number | undefined, have: number, couldAdd: number, uncertainInHave = 0, qualifier?: PicQualifier) => {
    if (!need) return;
    const needMin = need * 60;
    let verdict: Verdict;
    let reason: Reason | undefined;
    if (have >= needMin && have - uncertainInHave >= needMin) verdict = "met";
    else if (have >= needMin) (verdict = "unknown"), (reason = "openingPic");
    else if (have + couldAdd >= needMin) (verdict = "unknown"), (reason = "unclassified");
    else verdict = "unmet";
    out.push({ code, verdict, required: need, have: H(have), mandatory: !preferred.has(key), qualifier, reason, evidence: r.evidence?.[key] });
  };

  // licence: any of the accepted ones
  if (r.licence) {
    const accepted = r.licenceAlternatives?.length ? r.licenceAlternatives : [r.licence];
    const min = Math.min(...accepted.map((l) => RANK[l]));
    out.push({
      code: "licence",
      verdict: !me.licence ? "unknown" : RANK[me.licence] >= min ? "met" : "unmet",
      reason: !me.licence ? "noLicence" : undefined,
      required: accepted.map((l) => (l === "FATPL" ? "ATPL (frozen)" : l)).join(" / "),
      have: me.licence ?? undefined,
      mandatory: true,
      evidence: r.evidence?.licence,
    });
  }

  const typeMin = job.aircraft.reduce((s, t) => s + (me.typeMin[t] ?? 0), 0);
  hours("totalHours", "totalHours", r.totalHours, me.totalMin, 0);
  const picHave =
    r.picQualifier === "jet" ? me.picJetMin ?? 0
    : r.picQualifier === "jetOrMeTurboprop" ? me.picJetOrMeTurbopropMin ?? 0
    : r.picQualifier === "turbine" ? me.picTurbineMin ?? 0
    : r.picQualifier === "multiEngine" ? me.picMultiEngineMin ?? 0
    : me.picMin;
  // PIC on a kind of aircraft: flights on unknown types and carry-forwards without type might add to it
  const picCouldAdd = r.picQualifier ? u.engineMin + u.openingNoTypeMin : 0;
  // paper PIC totals may hold PICUS: what they bring is not certain
  hours("picHours", "picHours", r.picHours, picHave, picCouldAdd, Math.min(u.openingPicMin, picHave), r.picQualifier);
  hours("onTypeHours", "onTypeHours", r.onTypeHours, typeMin, u.openingNoTypeMin);
  hours("multiPilotHours", "multiPilotHours", r.multiPilotHours, me.multiPilotMin, 0);
  hours("jetHours", "jetHours", r.jetHours, me.jetMin, u.engineMin + u.openingNoTypeMin);
  hours("turbineHours", "turbineHours", r.turbineHours, me.turbineMin, u.engineMin + u.openingNoTypeMin);

  // type rating, only when the ad requires it
  if (r.typeRatingRequired && job.aircraft.length) {
    const rated = job.aircraft.some((t) => me.ratedTypes.includes(t));
    const family = !rated && job.aircraft.some((t) => me.ratedTypes.some((x) => sameFamily(t, x)));
    out.push({ code: "typeRating", verdict: rated ? "met" : family ? "unknown" : "unmet", reason: family ? "familyRating" : undefined, required: job.aircraft.join(" / "), have: rated ? job.aircraft.find((t) => me.ratedTypes.includes(t)) : undefined, mandatory: true });
  }

  if (r.englishLevel) {
    out.push({ code: "english", verdict: !me.englishLevel ? "unknown" : me.englishLevel >= r.englishLevel ? "met" : "unmet", reason: !me.englishLevel ? "noEnglish" : undefined, required: r.englishLevel, have: me.englishLevel, mandatory: true });
  }

  // licence regime: stated by the ad, or the one the job's country normally requires (said as such)
  const stated = r.authority && r.authority !== "CAA" && r.authority !== "DGAC" ? r.authority : undefined;
  const authority = stated ?? (job.authority !== "LOCAL" ? job.authority : undefined);
  if (authority) {
    out.push({
      code: "licenceAuthority",
      verdict: !me.authorities.length ? "unknown" : me.authorities.includes(authority as never) ? "met" : "unmet",
      reason: !me.authorities.length ? "noAuthority" : stated ? undefined : "authorityFromCountry",
      required: authority,
      have: me.authorities.join(", ") || undefined,
      mandatory: true,
    });
  }

  // right to work: declared by the pilot, per region only where one right covers it
  if (job.region !== "OTHER" || r.rightToWorkRequired) {
    let verdict: Verdict;
    let reason: Reason | undefined;
    if (r.visaSponsored) (verdict = "met"), (reason = "visaSponsored");
    else if (!me.workRegionsDeclared) (verdict = "unknown"), (reason = "workRightsNotDeclared");
    else if (!REGION_WIDE.has(job.region)) (verdict = "unknown"), (reason = "workRightsCountry");
    else verdict = me.workRegions.includes(job.region) ? "met" : "unmet";
    out.push({ code: "workRights", verdict, reason, required: job.country ?? job.region, have: me.workRegions.join(", ") || undefined, mandatory: true });
  }

  // instructor / examiner posts need the rating itself
  const title = job.title;
  const wantsExaminer = /\b(examiner|examinateur|TRE|SFE|FE|CRE|IRE)\b/i.test(title);
  const wantsInstructor = wantsExaminer || job.position === "FI" || /\b(instructor|instructeur|ausbilder|TRI|SFI|CRI|IRI|FI)\b/i.test(title);
  if (wantsInstructor) out.push({ code: "instructorRating", verdict: me.instructor ? "met" : "unmet", required: "FI / TRI / SFI", mandatory: true });
  if (wantsExaminer) out.push({ code: "examinerRating", verdict: me.examiner ? "met" : "unmet", required: "TRE / SFE / FE", mandatory: true });

  const count = (v: Verdict) => out.filter((c) => c.verdict === v).length;
  return { criteria: out, met: count("met"), unmet: count("unmet"), unknown: count("unknown"), blockers: out.filter((c) => c.verdict === "unmet" && c.mandatory) };
}
