import { CANDIDATES, collectJobs } from "@cielo/jobs";
import { rateLimited } from "@/lib/places";

/**
 * Temporary: tries the candidate employers' public job feeds, 22 at a time (?batch=0..3), and reports which ones
 * answer and how many pilot jobs they hold. Removed once the list of sources is settled.
 */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(`jobs-cand:${ip}`, 10)) return Response.json({ error: "rate_limited" }, { status: 429 });
  const batch = Math.max(0, Math.min(3, Number(new URL(req.url).searchParams.get("batch")) || 0));
  const list = CANDIDATES.slice(batch * 22, batch * 22 + 22);
  const results = await Promise.all(
    list.map(async (c) => {
      const r = (await collectJobs([c], 1)).sources[0]!;
      return { company: c.company, ats: c.ats, token: c.token, ok: r.ok, pilotJobs: r.pilotJobs, error: r.error };
    }),
  );
  return Response.json(results);
}
