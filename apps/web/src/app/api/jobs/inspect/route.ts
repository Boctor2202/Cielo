/**
 * Temporary (removed once the Air Astana reader is written): lists the scripts of job.airastana.com and the API
 * paths their code mentions. Fixed host, no parameters: it cannot be pointed anywhere else.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const HOST = "https://job.airastana.com";

export async function GET() {
  const html = await (await fetch(`${HOST}/vacancies`, { headers: { "User-Agent": "Mozilla/5.0" } })).text();
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]!);
  const hits: Record<string, string[]> = {};
  for (const src of scripts.slice(0, 8)) {
    const url = src.startsWith("http") ? src : `${HOST}${src.startsWith("/") ? "" : "/"}${src}`;
    if (!url.startsWith(HOST)) continue;
    const js = await (await fetch(url)).text();
    const found = new Set<string>();
    for (const m of js.matchAll(/["'`]((?:https?:\/\/[^"'`\s]{0,80})?\/(?:api|odata|graphql)[^"'`\s]{0,100})["'`]/gi)) found.add(m[1]!);
    for (const m of js.matchAll(/["'`]([^"'`\s]{0,60}[Vv]acanc[^"'`\s]{0,60})["'`]/g)) found.add(m[1]!);
    hits[src] = [...found].slice(0, 80);
  }
  return Response.json({ htmlLength: html.length, head: html.slice(0, 1500), scripts, hits });
}
