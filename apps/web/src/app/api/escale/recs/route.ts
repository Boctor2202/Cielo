import { adminDb, userFrom } from "@/lib/server/admin";
import { rateLimited } from "@/lib/places";

export const dynamic = "force-dynamic";

/**
 * Layover places recommended by Geardown members.
 *  GET  ?ids=<place id>,<place id>…   → { counts: { [id]: n }, mine: [id…] }
 *  POST { placeId, on }               → the pilot recommends a place, or takes the recommendation back
 * A count is only given from RECS_SHOWN recommendations on, and never who made them: a member sees "recommended
 * by 3 pilots", plus their own choice.
 */
const RECS_SHOWN = 2;
const ID = /^[A-Za-z0-9_-]{5,300}$/;

export async function GET(req: Request) {
  const db = adminDb();
  const ids = [...new Set((new URL(req.url).searchParams.get("ids") ?? "").split(",").filter((x) => ID.test(x)))].slice(0, 80);
  if (!db || !ids.length) return Response.json({ counts: {}, mine: [] });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(`recs:${ip}`, 240)) return Response.json({ error: "rate_limited" }, { status: 429 });
  const user = await userFrom(req).catch(() => null);
  const { data, error } = await db.from("place_recommendations").select("place_id, pilot_id").in("place_id", ids).limit(20_000);
  if (error) return Response.json({ counts: {}, mine: [] });
  const n: Record<string, number> = {};
  const mine: string[] = [];
  for (const r of data ?? []) {
    n[r.place_id] = (n[r.place_id] ?? 0) + 1;
    if (user && r.pilot_id === user.id) mine.push(r.place_id);
  }
  const counts = Object.fromEntries(Object.entries(n).filter(([, v]) => v >= RECS_SHOWN));
  return Response.json({ counts, mine }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: Request) {
  const user = await userFrom(req).catch(() => null);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const db = adminDb();
  const body = (await req.json().catch(() => null)) as { placeId?: unknown; on?: unknown } | null;
  const placeId = typeof body?.placeId === "string" ? body.placeId : "";
  if (!db || !ID.test(placeId) || typeof body?.on !== "boolean") return Response.json({ error: "bad_request" }, { status: 400 });
  if (rateLimited(`recs-post:${user.id}`, 60)) return Response.json({ error: "rate_limited" }, { status: 429 });
  const res = body.on
    ? await db.from("place_recommendations").upsert({ place_id: placeId, pilot_id: user.id }, { onConflict: "place_id,pilot_id", ignoreDuplicates: true })
    : await db.from("place_recommendations").delete().eq("place_id", placeId).eq("pilot_id", user.id);
  if (res.error) return Response.json({ error: "failed" }, { status: 500 });
  const { count } = await db.from("place_recommendations").select("place_id", { count: "exact", head: true }).eq("place_id", placeId);
  return Response.json({ mine: body.on, count: (count ?? 0) >= RECS_SHOWN ? count : 0 });
}
