import { sameFamily, typeInfo } from "./aircraft";
import type { Job, LicenceLevel, PilotProfile } from "./types";

/**
 * "For you" score: how well the subscriber's experience meets a job's stated requirements.
 * Runs on the subscriber's device — the logbook never leaves it.
 */

export type GapCode = "licence" | "totalHours" | "picHours" | "onTypeHours" | "multiPilotHours" | "jetHours" | "turbineHours" | "typeRating" | "english";

export interface Gap {
  code: GapCode;
  required: number | string;
  have: number | string;
}

export interface Match {
  /** 0–100 */
  score: number;
  /** how much of the job's requirements Cielo could read (0–1); low means the % is less reliable */
  confidence: number;
  gaps: Gap[];
  /** requirements the pilot meets, for display */
  met: GapCode[];
  /** job's aircraft the pilot is rated / has logged on */
  onType: boolean;
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
  const jobMultiPilot = job.aircraft.some((t) => typeInfo(t)?.multiPilot);

  const crit: Criterion[] = [
    {
      code: "licence", weight: 15,
      ratio: r.licence ? (me.licence ? (RANK[me.licence] >= RANK[r.licence] ? 1 : RANK[me.licence] + 1 >= RANK[r.licence] ? 0.5 : 0) : 0.3) : null,
      required: r.licence, have: me.licence ?? "—",
    },
    { code: "totalHours", weight: 25, ratio: ratio(me.totalMin, r.totalHours && r.totalHours * 60), required: r.totalHours, have: h(me.totalMin) },
    { code: "picHours", weight: 12, ratio: ratio(me.picMin, r.picHours && r.picHours * 60), required: r.picHours, have: h(me.picMin) },
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

  // Position realism when nothing else is stated: a captain seat with little PIC time is a long shot.
  if (job.position === "CPT" && !r.picHours) crit.push({ code: "picHours", weight: 10, ratio: Math.min(1, me.picMin / (1500 * 60)), required: 1500, have: h(me.picMin) });
  if (jobMultiPilot && !r.multiPilotHours) crit.push({ code: "multiPilotHours", weight: 5, ratio: Math.min(1, me.multiPilotMin / (500 * 60)), required: 500, have: h(me.multiPilotMin) });

  const stated = crit.filter((c) => c.ratio !== null);
  const totalW = stated.reduce((s, c) => s + c.weight, 0);
  const raw = totalW ? stated.reduce((s, c) => s + c.weight * c.ratio!, 0) / totalW : 0.5;
  // A hard blocker (required type rating not held, licence two levels short) caps the score.
  const blocked = stated.some((c) => (c.code === "typeRating" && r.typeRatingRequired && c.ratio === 0) || (c.code === "licence" && c.ratio === 0));
  const score = Math.round(Math.min(blocked ? 0.55 : 1, raw) * 100);

  const gaps: Gap[] = [];
  const met: GapCode[] = [];
  for (const c of stated) {
    if (c.ratio! >= 0.999) {
      if (!met.includes(c.code)) met.push(c.code);
    } else if (c.required !== undefined && !gaps.some((g) => g.code === c.code)) gaps.push({ code: c.code, required: c.required, have: c.have ?? "—" });
  }
  const readable = ["licence", "totalHours", "picHours", "typeRating"] as const;
  const confidence = readable.filter((k) => (k === "typeRating" ? job.aircraft.length > 0 : r[k as "licence"] !== undefined)).length / readable.length;

  return { score, confidence, gaps, met, onType: rated };
}

/** Builds the profile from logbook rows (kept generic so web and mobile share it). */
export function buildProfile(
  flights: { totalMin: number; picMin: number; picusMin: number; multiPilotMin: number; singlePilotMeMin: number; aircraftTypeIcao?: string; isFstd: boolean; deletedAt?: string | null }[],
  opening: { totalMin: number; picMin: number; multiPilotMin: number; singlePilotMeMin: number; aircraftTypeIcao?: string | null; deletedAt?: string | null }[],
  licences: { code: string; kind: string; deletedAt?: string | null; validUntil?: string | null }[],
  engineTypeOf: (icao: string) => string | undefined,
  icaoFromRating: (code: string) => string[],
): PilotProfile {
  const p: PilotProfile = { totalMin: 0, picMin: 0, multiPilotMin: 0, multiEngineMin: 0, turbineMin: 0, jetMin: 0, typeMin: {}, ratedTypes: [] };
  const add = (icao: string | null | undefined, min: number) => {
    if (!icao) return;
    p.typeMin[icao] = (p.typeMin[icao] ?? 0) + min;
    const e = engineTypeOf(icao);
    if (e === "jet") p.jetMin += min;
    if (e === "jet" || e === "turboprop" || e === "turboshaft") p.turbineMin += min;
  };
  for (const f of flights) {
    if (f.deletedAt || f.isFstd) continue;
    p.totalMin += f.totalMin;
    p.picMin += f.picMin + f.picusMin;
    p.multiPilotMin += f.multiPilotMin;
    p.multiEngineMin += f.singlePilotMeMin + f.multiPilotMin;
    add(f.aircraftTypeIcao, f.totalMin);
  }
  for (const o of opening) {
    if (o.deletedAt) continue;
    p.totalMin += o.totalMin;
    p.picMin += o.picMin;
    p.multiPilotMin += o.multiPilotMin;
    p.multiEngineMin += o.singlePilotMeMin + o.multiPilotMin;
    add(o.aircraftTypeIcao, o.totalMin);
  }
  for (const l of licences) {
    if (l.deletedAt) continue;
    const c = l.code.toUpperCase();
    if (l.kind === "licence") {
      const lvl: LicenceLevel | undefined = /ATPL/.test(c) ? (/FROZEN/.test(c) ? "FATPL" : "ATPL") : /MPL/.test(c) ? "MPL" : /CPL/.test(c) ? "CPL" : /PPL|LAPL/.test(c) ? "PPL" : undefined;
      if (lvl && (!p.licence || RANK[lvl] > RANK[p.licence])) p.licence = lvl;
    }
    if (l.kind === "rating") for (const i of icaoFromRating(c)) if (!p.ratedTypes.includes(i)) p.ratedTypes.push(i);
    if (l.kind === "language" && /ENGLISH|ANGLAIS/.test(c)) {
      const m = c.match(/([4-6])/);
      if (m) p.englishLevel = Math.max(p.englishLevel ?? 0, Number(m[1]));
    }
  }
  for (const icao of Object.keys(p.typeMin)) if (!p.ratedTypes.includes(icao)) p.ratedTypes.push(icao);
  return p;
}
