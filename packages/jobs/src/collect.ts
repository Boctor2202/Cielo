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
    url: raw.url,
    requirements,
    salary,
    fetchedAt: now,
  };
}

export interface CollectResult {
  jobs: Job[];
  sources: { company: string; ok: boolean; pilotJobs: number; error?: string }[];
}

/** Reads every source (a few at a time, politely) and returns the pilot jobs. */
export async function collectJobs(sources: Source[] = SOURCES, concurrency = 4, opts: { adzuna?: { appId: string; appKey: string } } = {}): Promise<CollectResult> {
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
  if (opts.adzuna) {
    const { raws, errors } = await fetchAdzuna(opts.adzuna.appId, opts.adzuna.appKey);
    const direct = new Set(out.jobs.map((j) => `${j.company.toLowerCase()}|${j.title.toLowerCase()}`));
    let n = 0;
    for (const r of raws) {
      if (direct.has(`${r.company.toLowerCase()}|${r.title.toLowerCase()}`)) continue;
      out.jobs.push(toJob(r, { ...ADZUNA_SOURCE, company: r.company, segment: r.segment }, now));
      n++;
    }
    out.sources.push({ company: "Adzuna", ok: raws.length > 0 || errors.length === 0, pilotJobs: n, error: errors.length ? errors.slice(0, 3).join("; ") : undefined });
  }
  out.jobs.sort((a, b) => (b.postedAt ?? "").localeCompare(a.postedAt ?? ""));
  return out;
}
