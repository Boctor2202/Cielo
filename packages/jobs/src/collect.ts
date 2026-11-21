import { extractAircraft, extractRequirements, extractSalary, detectPosition, finishSalary, isPilotJob } from "./extract";
import { FETCHERS } from "./fetchers";
import { ADZUNA_SOURCE, fetchAdzuna } from "./adzuna";
import { authorityOf, countryFrom, regionOf } from "./regions";
import { SOURCES } from "./sources";
import type { Job, RawPosting, Salary, Source } from "./types";

const PERIODS: Record<string, Salary["period"]> = { year: "year", yearly: "year", annual: "year", per_year: "year", month: "month", monthly: "month", per_month: "month", day: "day", daily: "day", hour: "hour", hourly: "hour" };

/** RawPosting → Job: keeps the facts and the link, drops the text. */
export function toJob(raw: RawPosting, src: Source, now = new Date().toISOString()): Job {
  const requirements = extractRequirements(raw.title, raw.text);
  let salary = extractSalary(raw.text);
  if (raw.salary && (raw.salary.min || raw.salary.max) && raw.salary.currency) {
    salary = finishSalary(raw.salary.min, raw.salary.max, raw.salary.currency.toUpperCase(), PERIODS[(raw.salary.period ?? "year").toLowerCase()] ?? "year") ?? salary;
  }
  const country = countryFrom(raw.country, raw.location) ?? src.country;
  return {
    id: raw.id,
    source: src.ats,
    company: raw.company,
    segment: src.segment,
    title: raw.title.replace(/\s+/g, " ").trim(),
    position: detectPosition(raw.title, raw.text),
    aircraft: extractAircraft(raw.title, raw.text),
    location: raw.location || undefined,
    country,
    region: regionOf(country),
    authority: authorityOf(country),
    employment: raw.employment,
    postedAt: raw.postedAt,
    updatedAt: raw.updatedAt,
    url: raw.url,
    requirements,
    salary,
    fetchedAt: now,
    kind: isPool(raw.title, raw.text) ? "pool" : "position",
    ...ambiguity(raw, requirements),
  };
}

/** A call for applications to a pool, not a precise post. */
export function isPool(title: string, text = ""): boolean {
  return /\b(talent ?pool|pool|open application|spontaneous application|unsolicited|candidature spontan[ée]e|vivier|initiativbewerbung|future opportunities|expression of interest)\b/i.test(title) ||
    /\b(this is (?:not a|an?) (?:specific|open) (?:vacancy|position)|for our talent pool|pour notre vivier)\b/i.test(text);
}

function ambiguity(raw: RawPosting, r: Job["requirements"]): Pick<Job, "ambiguous"> {
  const a: NonNullable<Job["ambiguous"]> = [];
  if (detectPosition(raw.title, raw.text) === "OTHER") a.push("position");
  if (!extractAircraft(raw.title, raw.text).length) a.push("aircraft");
  // figures followed by "hours" in the text, but none read as a requirement
  if (/\d{2,5}\s*(?:h|hrs?|hours|heures|stunden)\b/i.test(raw.text) && r.totalHours === undefined && r.picHours === undefined && r.onTypeHours === undefined && r.jetHours === undefined && r.turbineHours === undefined && r.multiPilotHours === undefined) a.push("hours");
  return a.length ? { ambiguous: a } : {};
}

/** Title without the gender / language markers employers add ("(m/w/d)", "H/F", "- EN"), to find copies. */
export const titleKey = (t: string) =>
  t
    .toLowerCase()
    .replace(/\((?:m|f|w|d|h|x|all genders?)(?:\s*[/|,]\s*(?:m|f|w|d|h|x))*\)|\b[hfm]\s*\/\s*[hfm]\b|\b(?:m|w|d)\/(?:m|w|d)\/(?:m|w|d)\b/g, " ")
    .replace(/\b(?:en|fr|de|es|it)\b\s*$/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Folds copies of one offer (republished, or posted in several languages) into the earliest one. */
export function foldCopies(jobs: Job[]): Job[] {
  const groups = new Map<string, Job[]>();
  for (const j of jobs) {
    const k = `${j.company.toLowerCase()}|${j.country ?? ""}|${j.position}|${[...j.aircraft].sort().join(",")}|${titleKey(j.title)}`;
    const g = groups.get(k);
    if (g) g.push(j);
    else groups.set(k, [j]);
  }
  return [...groups.values()].map((g) => {
    if (g.length === 1) return g[0]!;
    const first = [...g].sort((a, b) => (a.postedAt ?? "9999").localeCompare(b.postedAt ?? "9999"))[0]!;
    return { ...first, variants: g.length - 1 };
  });
}

export interface CollectResult {
  jobs: Job[];
  sources: { company: string; ok: boolean; pilotJobs: number; error?: string }[];
}

/** Reads every source (a few at a time, politely) and returns the pilot jobs. */
export async function collectJobs(sources: Source[] = SOURCES, concurrency = 4, opts: { adzuna?: { appId: string; appKey: string }; adzunaFetch?: () => Promise<Awaited<ReturnType<typeof fetchAdzuna>>> } = {}): Promise<CollectResult> {
  const now = new Date().toISOString();
  const out: CollectResult = { jobs: [], sources: [] };
  const queue = [...sources];
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      for (let s = queue.shift(); s; s = queue.shift()) {
        try {
          const raws = (await FETCHERS[s.ats](s)).filter((r) => isPilotJob(r.title));
          for (const r of raws) out.jobs.push(toJob(r, s, now));
          out.sources.push({ company: s.company, ok: true, pilotJobs: raws.length });
        } catch (e) {
          out.sources.push({ company: s.company, ok: false, pilotJobs: 0, error: String((e as Error).message ?? e).slice(0, 120) });
        }
      }
    }),
  );
  // Adzuna (when its keys are set): offers from many countries; the employers read directly win on duplicates
  // (adzunaFetch: the caller's own, e.g. cached, so that Adzuna's daily quota is not spent on every refresh)
  if (opts.adzuna || opts.adzunaFetch) {
    const { raws, errors } = opts.adzunaFetch ? await opts.adzunaFetch() : await fetchAdzuna(opts.adzuna!.appId, opts.adzuna!.appKey);
    const direct = new Set(out.jobs.map((j) => `${j.company.toLowerCase()}|${j.title.toLowerCase()}`));
    let n = 0;
    for (const r of raws) {
      if (direct.has(`${r.company.toLowerCase()}|${r.title.toLowerCase()}`)) continue;
      out.jobs.push(toJob(r, { ...ADZUNA_SOURCE, company: r.company, segment: r.segment }, now));
      n++;
    }
    out.sources.push({ company: "Adzuna", ok: raws.length > 0 || errors.length === 0, pilotJobs: n, error: errors.length ? errors.slice(0, 3).join("; ") : undefined });
  }
  // an offer published for several bases comes back several times with the same id: keep one
  const ids = new Set<string>();
  out.jobs = foldCopies(out.jobs.filter((j) => !ids.has(j.id) && !!ids.add(j.id)));
  out.jobs.sort((a, b) => (b.postedAt ?? "").localeCompare(a.postedAt ?? ""));
  return out;
}
