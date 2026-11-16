import { isPilotJob } from "./extract";
import type { RawPosting, Source } from "./types";

/**
 * Adzuna job search API (https://developer.adzuna.com): pilot offers in the countries Adzuna covers.
 * Used under Adzuna's API terms: every offer links to Adzuna's own page for it and is credited "Jobs by Adzuna".
 * Only the facts extracted from the short summary are kept, never the text.
 */
export const ADZUNA_COUNTRIES = ["gb", "us", "ca", "au", "nz", "fr", "de", "nl", "be", "at", "ch", "es", "it", "pl", "in", "sg", "za", "br", "mx"] as const;

/** Searches that bring pilot jobs; results are then filtered on the title and an aviation context. */
const QUERIES = ["what=pilot", "what_phrase=first%20officer", "what_and=captain%20airline"];

const AVIATION = /\b(aircraft|airline|aviation|airways|air ?lines|flight|cockpit|ATPL|ATP|CPL|MPL|type[- ]rat|jet|turboprop|helicopter|rotor|cargo|charter|part ?1(21|35)|airbus|boeing|embraer|bombardier|citation|gulfstream|falcon|pilatus|king ?air|ATR|dash ?8|A3[0-9]{2}|B7[0-9]{2}|E1[79]0)\b/i;

export const ADZUNA_SOURCE: Omit<Source, "company"> = { ats: "adzuna", token: "adzuna", segment: "other" };

interface AdzunaResult {
  id: string;
  title: string;
  description?: string;
  redirect_url: string;
  created?: string;
  company?: { display_name?: string };
  location?: { display_name?: string; area?: string[] };
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string | number;
  contract_time?: string;
}

const CURRENCY: Record<string, string> = { gb: "GBP", us: "USD", ca: "CAD", au: "AUD", nz: "NZD", in: "INR", sg: "SGD", za: "ZAR", br: "BRL", mx: "MXN", pl: "PLN", ch: "CHF" };
const strip = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/** The segment, guessed from the words of the offer. */
export function segmentOf(text: string): Source["segment"] {
  if (/\bhelicopter|rotor|HEMS\b/i.test(text)) return "helicopter";
  if (/\bcargo|freight\b/i.test(text)) return "cargo";
  if (/\bflight instructor|instructeur|\bFI\b|flight school|academy\b/i.test(text)) return "training";
  if (/\bcharter|business jet|private jet|corporate|part ?135|fractional|citation|gulfstream|falcon|challenger|global ?[0-9]{4}\b/i.test(text)) return "business";
  if (/\bregional|turboprop|ATR|dash ?8|E1[79]0|CRJ\b/i.test(text)) return "regional";
  if (/\bairline|part ?121|A3[0-9]{2}|B7[0-9]{2}\b/i.test(text)) return "airline";
  return "other";
}

/** All pilot offers Adzuna lists in its countries (two pages per search at most). */
export async function fetchAdzuna(appId: string, appKey: string, countries: readonly string[] = ADZUNA_COUNTRIES): Promise<{ raws: (RawPosting & { segment: Source["segment"] })[]; errors: string[] }> {
  const raws: (RawPosting & { segment: Source["segment"] })[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  const queue = countries.flatMap((c) => QUERIES.map((q) => ({ c, q })));
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        const { c, q } = job;
        try {
          const url = `https://api.adzuna.com/v1/api/jobs/${c}/search/1?app_id=${encodeURIComponent(appId)}&app_key=${encodeURIComponent(appKey)}&results_per_page=50&${q}&max_days_old=60&content-type=application/json`;
          const r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
          if (!r.ok) throw new Error(`${r.status}`);
          const d = (await r.json()) as { results?: AdzunaResult[] };
          for (const j of d.results ?? []) {
            const text = strip(j.description ?? "");
            if (!isPilotJob(j.title) || !AVIATION.test(`${j.title} ${text}`)) continue;
            const key = `${(j.company?.display_name ?? "").toLowerCase()}|${j.title.toLowerCase()}|${c}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const predicted = String(j.salary_is_predicted ?? "0") === "1";
            raws.push({
              id: `az-${c}-${j.id}`,
              company: j.company?.display_name?.trim() || "—",
              title: strip(j.title),
              url: j.redirect_url,
              location: j.location?.display_name,
              country: c.toUpperCase() === "GB" ? "GB" : c.toUpperCase(),
              postedAt: j.created,
              employment: j.contract_time,
              text,
              // Adzuna's estimated salaries are left out: only those the employer published
              salary: !predicted && (j.salary_min || j.salary_max) ? { min: j.salary_min, max: j.salary_max, currency: CURRENCY[c] ?? "EUR", period: "year" } : undefined,
              segment: segmentOf(`${j.title} ${text}`),
            });
          }
        } catch (e) {
          errors.push(`${c}: ${(e as Error).message}`);
        }
      }
    }),
  );
  return { raws, errors };
}
