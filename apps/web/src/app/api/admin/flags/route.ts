import { FLAG_KEYS, handle, HttpError, readFlags, requireAdmin, resetFlagsCache } from "@/lib/server/admin";

export const dynamic = "force-dynamic";

/** Whether a paid key is accepted right now (a free call: the list of models / a flights query is not made). */
async function anthropicStatus(): Promise<{ ok: boolean; note?: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false };
  const r = await fetch("https://api.anthropic.com/v1/models?limit=1", { headers: { "x-api-key": key, "anthropic-version": "2023-06-01" }, cache: "no-store" }).catch(() => null);
  if (!r) return { ok: false, note: "unreachable" };
  return r.ok ? { ok: true, note: "key accepted" } : { ok: false, note: r.status === 401 ? "key refused (expired or deleted)" : `error ${r.status}` };
}

/** Which outside services are configured (names only, never values). */
async function services() {
  const has = (k: string) => !!process.env[k];
  return [
    { key: "supabase", ok: has("NEXT_PUBLIC_SUPABASE_URL") && has("SUPABASE_SECRET_KEY") },
    { key: "googleMaps", ok: has("NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY") },
    { key: "googlePlaces", ok: has("GOOGLE_MAPS_API_KEY") },
    { key: "planespotters", ok: process.env.NEXT_PUBLIC_PLANESPOTTERS === "1" },
    { key: "adsblol", ok: true, note: has("ADSBLOL_API_KEY") ? "key" : "free quota (500/day)" },
    { key: "ticketmaster", ok: has("TICKETMASTER_API_KEY") },
    { key: "flightaware", ok: has("FLIGHTAWARE_API_KEY") },
    { key: "anthropic", ...(await anthropicStatus()) },
  ];
}

export function GET(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    resetFlagsCache();
    return Response.json({ flags: await readFlags(), services: await services() });
  });
}

/** PUT /api/admin/flags {key, enabled} */
export function PUT(req: Request) {
  return handle(async () => {
    const { db } = await requireAdmin(req);
    const b = (await req.json().catch(() => null)) as { key?: string; enabled?: boolean } | null;
    if (!b?.key || !(FLAG_KEYS as readonly string[]).includes(b.key) || typeof b.enabled !== "boolean") throw new HttpError(400, "bad_request");
    const { error } = await db.from("platform_flags").upsert({ key: b.key, enabled: b.enabled, updated_at: new Date().toISOString() });
    if (error) throw error;
    resetFlagsCache();
    return Response.json({ ok: true });
  });
}
