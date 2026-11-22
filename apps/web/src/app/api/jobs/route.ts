import { unstable_cache } from "next/cache";
import { collectJobs, fetchAdzuna } from "@cielo/jobs";
import { meter } from "@/lib/server/usage";

/**
 * Adzuna's offers, kept 12 hours in Vercel's data cache, which outlives deployments: each deployment rebuilds
 * this page, and reading Adzuna every time used up its daily quota (about 250 calls) in a few deployments.
 * A failed read throws, so it is never cached and the next request tries again.
 */
const adzunaCached = unstable_cache(
  async (appId: string, appKey: string) => {
    const r = await fetchAdzuna(appId, appKey);
    meter("adzuna", "search", { calls: r.calls, errors: r.errors.length });
    if (!r.raws.length && r.errors.length) throw new Error(`adzuna: ${r.errors.slice(0, 3).join("; ")}`);
    return r;
  },
  ["adzuna-v2"],
  { revalidate: 43200 },
);

/**
 * Pilot job offers read from employers' own public job feeds (see packages/jobs/src/sources.ts).
 * Only extracted facts and the link to the original posting are returned — never the posting text.
 * Cached and refreshed at most every 6 hours, so each employer feed is read a few times a day at most.
 */
export const dynamic = "force-static";
export const revalidate = 21600;
export const maxDuration = 120;

export async function GET() {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  const { jobs, sources } = await collectJobs(
    undefined,
    4,
    appId && appKey ? { adzunaFetch: () => adzunaCached(appId, appKey).catch((e: Error) => ({ raws: [], calls: 0, errors: [e.message.replace(/app_(id|key)=[^&\s]+/g, "")] })) } : {},
  );
  // every source down at once is an outage on our side, not offers closing: throwing during a background refresh
  // keeps the previous list cached (an empty list would hide every offer for six hours)
  if (!jobs.length && sources.length && sources.every((s) => !s.ok)) throw new Error("all job sources failed");
  return Response.json({ updatedAt: new Date().toISOString(), jobs, sources: sources.map(({ company, ok, pilotJobs, error }) => ({ company, ok, pilotJobs, ...(ok || !error ? {} : { error: error.slice(0, 120) }) })) });
}
