import type { RawPosting, Source } from "./types";

/**
 * Readers for the public job feeds of common applicant-tracking systems. Each returns transient RawPostings;
 * the text is only used to extract facts (see extract.ts) and is never stored.
 */

const UA = "GeardownJobs/1.0 (reads employers' public job feeds)";

async function get(url: string, accept = "application/json"): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: accept }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", ndash: "–", mdash: "—", rsquo: "’" };
export function toText(html: string | undefined): string {
  if (!html) return "";
  const decode = (s: string) =>
    s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) =>
      e[0] === "#" ? String.fromCodePoint(e[1]?.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENTITIES[e.toLowerCase()] ?? m),
    );
  return decode(decode(html).replace(/<\s*(br|\/p|\/li|\/div|\/h\d)\s*\/?>/gi, "\n").replace(/<li[^>]*>/gi, "\n• ").replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? m[1]!.replace(/^<!\[CDATA\[|\]\]>$/g, "").trim() : undefined;
};

type Fetcher = (s: Source) => Promise<RawPosting[]>;

const greenhouse: Fetcher = async (s) => {
  const d = JSON.parse(await get(`https://boards-api.greenhouse.io/v1/boards/${s.token}/jobs?content=true`)) as {
    jobs: { id: number; title: string; absolute_url: string; location?: { name?: string }; content?: string; first_published?: string; updated_at?: string }[];
  };
  return d.jobs.map((j) => ({ id: `gh-${s.token}-${j.id}`, company: s.company, title: j.title, url: j.absolute_url, location: j.location?.name, postedAt: j.first_published ?? j.updated_at, text: toText(j.content) }));
};

const lever: Fetcher = async (s) => {
  const d = JSON.parse(await get(`https://api.lever.co/v0/postings/${s.token}?mode=json`)) as {
    id: string; text: string; hostedUrl: string; categories?: { location?: string; commitment?: string }; createdAt?: number; descriptionPlain?: string; lists?: { text: string; content: string }[];
    salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
  }[];
  return d.map((j) => ({
    id: `lv-${s.token}-${j.id}`, company: s.company, title: j.text, url: j.hostedUrl, location: j.categories?.location, employment: j.categories?.commitment,
    postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : undefined,
    text: [j.descriptionPlain ?? "", ...(j.lists ?? []).map((l) => `${l.text}\n${toText(l.content)}`)].join("\n"),
    salary: j.salaryRange ? { min: j.salaryRange.min, max: j.salaryRange.max, currency: j.salaryRange.currency, period: j.salaryRange.interval } : undefined,
  }));
};

const recruitee: Fetcher = async (s) => {
  const d = JSON.parse(await get(`https://${s.token}.recruitee.com/api/offers/`)) as {
    offers: { id: number; title: string; careers_url: string; location?: string; country_code?: string; created_at?: string; published_at?: string; employment_type_code?: string; description?: string; requirements?: string;
      salary?: { min?: string | number | null; max?: string | number | null; currency?: string | null; period?: string | null } }[];
  };
  return d.offers.map((o) => ({
    id: `rc-${s.token}-${o.id}`, company: s.company, title: o.title, url: o.careers_url, location: o.location, country: o.country_code ?? undefined,
    postedAt: o.published_at ?? o.created_at, employment: o.employment_type_code, text: `${toText(o.requirements)}\n${toText(o.description)}`,
    salary: o.salary && (o.salary.min || o.salary.max) ? { min: Number(o.salary.min) || undefined, max: Number(o.salary.max) || undefined, currency: o.salary.currency ?? undefined, period: o.salary.period ?? undefined } : undefined,
  }));
};

const teamtailor: Fetcher = async (s) => {
  const x = await get(`https://${s.token}.teamtailor.com/jobs.rss`, "application/rss+xml, text/xml");
  return [...x.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m, i) => {
    const it = m[1]!;
    const link = tag(it, "link") ?? "";
    return {
      id: `tt-${s.token}-${tag(it, "guid") ?? link ?? i}`, company: s.company, title: toText(tag(it, "title")), url: link,
      location: toText(tag(it, "tt:city") ?? tag(it, "tt:name")), country: tag(it, "tt:country"), postedAt: tag(it, "pubDate") ? new Date(tag(it, "pubDate")!).toISOString() : undefined,
      text: toText(tag(it, "description")),
    };
  });
};

const personio: Fetcher = async (s) => {
  const x = await get(`https://${s.token}.jobs.personio.de/xml`, "application/xml, text/xml");
  return [...x.matchAll(/<position>([\s\S]*?)<\/position>/g)].map((m) => {
    const p = m[1]!;
    const id = tag(p, "id")!;
    const descs = [...p.matchAll(/<jobDescription>([\s\S]*?)<\/jobDescription>/g)].map((d) => `${toText(tag(d[1]!, "name"))}\n${toText(tag(d[1]!, "value"))}`);
    return {
      id: `ps-${s.token}-${id}`, company: s.company, title: toText(tag(p, "name")), url: `https://${s.token}.jobs.personio.de/job/${id}`,
      location: toText(tag(p, "office")), postedAt: tag(p, "createdAt"), employment: tag(p, "employmentType"), text: descs.join("\n"),
    };
  });
};

const ashby: Fetcher = async (s) => {
  const d = JSON.parse(await get(`https://api.ashbyhq.com/posting-api/job-board/${s.token}?includeCompensation=true`)) as {
    jobs: { id: string; title: string; jobUrl: string; location?: string; publishedAt?: string; employmentType?: string; descriptionPlain?: string }[];
  };
  return d.jobs.map((j) => ({ id: `ab-${s.token}-${j.id}`, company: s.company, title: j.title, url: j.jobUrl, location: j.location, postedAt: j.publishedAt, employment: j.employmentType, text: j.descriptionPlain ?? "" }));
};

const workable: Fetcher = async (s) => {
  const d = JSON.parse(await get(`https://apply.workable.com/api/v1/widget/accounts/${s.token}?details=true`)) as {
    jobs: { shortcode: string; title: string; url: string; city?: string; country?: string; published_on?: string; employment_type?: string; description?: string }[];
  };
  return d.jobs.map((j) => ({ id: `wk-${s.token}-${j.shortcode}`, company: s.company, title: j.title, url: j.url, location: j.city, country: j.country, postedAt: j.published_on, employment: j.employment_type, text: toText(j.description) }));
};

const smartrecruiters: Fetcher = async (s) => {
  const d = JSON.parse(await get(`https://api.smartrecruiters.com/v1/companies/${s.token}/postings?limit=100`)) as {
    content: { id: string; name: string; location?: { city?: string; country?: string }; releasedDate?: string; typeOfEmployment?: { label?: string } }[];
  };
  return d.content.map((j) => ({
    id: `sr-${s.token}-${j.id}`, company: s.company, title: j.name, url: `https://jobs.smartrecruiters.com/${s.token}/${j.id}`,
    location: j.location?.city, country: j.location?.country?.toUpperCase(), postedAt: j.releasedDate, employment: j.typeOfEmployment?.label, text: "",
  }));
};

/**
 * SAP SuccessFactors career sites (token = host, e.g. "netjets.jobs.hr.cloud.sap"): the public search page,
 * 25 results a page. Their robots.txt keeps robots out of /services/ (where the RSS lives), not out of /search/.
 */
const successfactors: Fetcher = async (s) => {
  const out: RawPosting[] = [];
  const seen = new Set<string>();
  for (let start = 0; start < 200; start += 25) {
    const html = await get(`https://${s.token}/search/?q=pilot&locale=en_US&startrow=${start}`, "text/html");
    let rows = html.split(/<tr[^>]*class="[^"]*data-row[^"]*"/i).slice(1);
    // other SuccessFactors templates have no table rows: one chunk per job link
    if (!rows.length) rows = html.split(/(?=<a[^>]+href="\/[^"]*\/job\/[^"]+\/\d+\/?")/i).slice(1);
    let added = 0;
    for (const row of rows) {
      const a = row.match(/<a[^>]+href="(\/[^"]*\/job\/[^"]+\/(\d+)\/?)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!a || seen.has(a[2]!)) continue;
      seen.add(a[2]!);
      added++;
      const loc = row.match(/class="[^"]*jobLocation[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1];
      const date = row.match(/class="[^"]*jobDate[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1];
      const when = date ? new Date(`${toText(date)} 12:00 UTC`) : null;
      out.push({
        id: `sf-${s.token.split(".")[0]}-${a[2]}`,
        company: s.company,
        title: toText(a[3]).replace(/\s*\([^)]*\)\s*$/, ""),
        url: `https://${s.token}${a[1]}`,
        // "US +36 more…" for multi-base postings: the first place only
        location: loc ? toText(loc).split(/\n|\s\+\d+\s*more/i)[0]!.trim() || undefined : undefined,
        postedAt: when && !Number.isNaN(when.getTime()) ? when.toISOString() : undefined,
        text: toText(a[3]),
      });
    }
    if (added < 25) break;
  }
  return out;
};

// Adzuna is not a per-employer feed: it is read once for all countries (see adzuna.ts)
export const FETCHERS: Record<Source["ats"], Fetcher> = { greenhouse, lever, recruitee, teamtailor, personio, ashby, workable, smartrecruiters, successfactors, adzuna: async () => [] };
