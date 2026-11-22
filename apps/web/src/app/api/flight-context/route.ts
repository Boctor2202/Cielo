import { accessFor, airspacesCrossed, cruiseSample, noCardTrialDays, windComponents, type TrackPoint } from "@cielo/core";
import { adminDb, userFrom } from "@/lib/server/admin";
import { airspacesAlong } from "@/lib/server/openaip";
import { windAt } from "@/lib/server/winds";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/flight-context {points: TrackPoint[]} — what a logged flight went through: the airspaces crossed
 * (openAIP) and the wind and temperature at cruise level (NOAA GFS model). Max plan; for information only.
 */
export async function POST(req: Request) {
  const user = await userFrom(req).catch(() => null);
  if (!user) return Response.json({ error: "signin" }, { status: 401 });
  const db = adminDb();
  const { data: p } = db ? await db.from("pilots").select("created_at, trial_started_at, subscription_tier, subscription_expires_at").eq("id", user.id).maybeSingle() : { data: null };
  const access = accessFor(p ? { createdAt: p.trial_started_at ?? p.created_at, subscriptionTier: p.subscription_tier, subscriptionExpiresAt: p.subscription_expires_at } : undefined, { signedIn: true, noCardTrialDays: noCardTrialDays(process.env.NEXT_PUBLIC_NO_CARD_TRIAL_DAYS) });
  if (!access.has("tracks")) return Response.json({ error: "plan" }, { status: 403 });

  const b = (await req.json().catch(() => null)) as { points?: TrackPoint[] } | null;
  const points = (b?.points ?? []).filter((x) => Array.isArray(x) && x.length >= 4 && [x[0], x[1], x[2]].every((v) => typeof v === "number")).slice(0, 4000);
  if (points.length < 2) return Response.json({ error: "bad_request" }, { status: 400 });

  const missing: string[] = [];
  const [crossed, cruise] = await Promise.all([
    airspacesAlong(points.map((x) => [x[1], x[2]]))
      .then((list) => {
        if (list === null) missing.push("airspace");
        return list ? airspacesCrossed(points, list) : [];
      })
      .catch(() => (missing.push("airspaceError"), [])),
    (async () => {
      const c = cruiseSample(points);
      if (!c) return null;
      const w = await windAt(c.lat, c.lon, c.altFt, c.t).catch(() => (missing.push("windError"), null));
      return { ...c, ...(w ? { ...w, ...windComponents(w.windFrom, w.windKt, c.trackDeg) } : {}) };
    })(),
  ]);
  return Response.json({ airspaces: crossed, cruise, missing }, { headers: { "Cache-Control": "no-store" } });
}
