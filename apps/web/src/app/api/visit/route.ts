import { createHash } from "node:crypto";
import { adminDb } from "@/lib/server/admin";
import { rateLimited } from "@/lib/places";

export const dynamic = "force-dynamic";

/**
 * POST /api/visit { path, ref } — one visitor of the website for the day, for the admin's count. Nothing is set
 * on the visitor's device: the visitor is a hash of the day, the network address and the browser with a server
 * secret (another value every day, never the address itself). Robots are left out; the admin's own browsers
 * do not call this (see VisitBeacon).
 */
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|node-fetch|axios/i;

export async function POST(req: Request) {
  const db = adminDb();
  const ua = req.headers.get("user-agent") ?? "";
  if (!db || !ua || BOT.test(ua)) return new Response(null, { status: 204 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(`visit:${ip}`, 60)) return new Response(null, { status: 204 });
  const body = (await req.json().catch(() => null)) as { path?: unknown; ref?: unknown } | null;
  const day = new Date().toISOString().slice(0, 10);
  const secret = process.env.VISIT_SALT ?? process.env.SUPABASE_SECRET_KEY ?? "";
  const visitor = createHash("sha256").update(`${secret}|${day}|${ip}|${ua}`).digest("hex").slice(0, 20);
  const path = typeof body?.path === "string" ? body.path.slice(0, 200) : null;
  let refHost: string | null = null;
  try {
    const h = typeof body?.ref === "string" && body.ref ? new URL(body.ref).hostname.replace(/^www\./, "") : null;
    // a visit coming from the site itself has no outside source
    refHost = h && !/(^|\.)geardown\.app$/.test(h) ? h.slice(0, 100) : null;
  } catch {}
  const country = req.headers.get("x-vercel-ip-country")?.slice(0, 2) ?? null;
  await db
    .from("site_visits")
    .upsert({ day, visitor, first_path: path, ref_host: refHost, country }, { onConflict: "day,visitor", ignoreDuplicates: true })
    .then(() => undefined, () => undefined);
  // kept 13 months
  if (Math.random() < 0.01) {
    const cut = new Date(Date.now() - 396 * 86_400_000).toISOString().slice(0, 10);
    await db.from("site_visits").delete().lt("day", cut).then(() => undefined, () => undefined);
  }
  return new Response(null, { status: 204 });
}
