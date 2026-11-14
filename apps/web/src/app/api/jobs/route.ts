import { collectJobs } from "@cielo/jobs";

/**
 * Pilot job offers read from employers' own public job feeds (see packages/jobs/src/sources.ts).
 * Only extracted facts and the link to the original posting are returned — never the posting text.
 * Cached and refreshed at most every 6 hours, so each employer feed is read a few times a day at most.
 */
export const dynamic = "force-static";
export const revalidate = 21600;

export async function GET() {
  try {
    const { jobs, sources } = await collectJobs();
    return Response.json({ updatedAt: new Date().toISOString(), jobs, sources: sources.map(({ company, ok, pilotJobs }) => ({ company, ok, pilotJobs })) });
  } catch {
    return Response.json({ updatedAt: new Date().toISOString(), jobs: [], sources: [] });
  }
}
