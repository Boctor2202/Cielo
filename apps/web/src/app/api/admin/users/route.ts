import { handle, HttpError, requireAdmin } from "@/lib/server/admin";

export const dynamic = "force-dynamic";

/** GET /api/admin/users?q= — pilots with plan, store subscription and activity (latest 300 or search). */
export function GET(req: Request) {
  return handle(async () => {
    const { db } = await requireAdmin(req);
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
    let query = db.from("pilots").select("id, email, full_name, created_at, subscription_tier, subscription_source, subscription_expires_at, locale").is("deleted_at", null).order("created_at", { ascending: false }).limit(300);
    if (q) query = query.or(`email.ilike.%${q.replace(/[%,()]/g, "")}%,full_name.ilike.%${q.replace(/[%,()]/g, "")}%`);
    const { data: pilots, error } = await query;
    if (error) throw error;
    const ids = (pilots ?? []).map((p) => p.id);
    const [{ data: stats }, { data: subs }] = await Promise.all([
      db.from("admin_pilot_stats").select("pilot_id, flights, last_flight_change").in("pilot_id", ids),
      db.from("subscriptions").select("pilot_id, source, tier, status, current_period_end, updated_at").in("pilot_id", ids).order("updated_at", { ascending: false }),
    ]);
    const st = new Map((stats ?? []).map((s) => [s.pilot_id, s]));
    const sub = new Map<string, (typeof subs extends (infer T)[] | null ? T : never)>();
    for (const s of subs ?? []) if (!sub.has(s.pilot_id)) sub.set(s.pilot_id, s);
    return Response.json({
      users: (pilots ?? []).map((p) => ({ ...p, flights: st.get(p.id)?.flights ?? 0, lastActivity: st.get(p.id)?.last_flight_change ?? null, subscription: sub.get(p.id) ?? null })),
    });
  });
}

/** POST /api/admin/users {pilotId, tier: "basic" | "premium" | "free", until?: ISO} — grant or remove a plan by hand. */
export function POST(req: Request) {
  return handle(async () => {
    const { db } = await requireAdmin(req);
    const b = (await req.json().catch(() => null)) as { pilotId?: string; tier?: string; until?: string | null } | null;
    if (!b?.pilotId || !["basic", "premium", "free"].includes(b.tier ?? "")) throw new HttpError(400, "bad_request");
    const until = b.until && !Number.isNaN(Date.parse(b.until)) ? new Date(b.until).toISOString() : null;
    const { error } = await db
      .from("pilots")
      .update({ subscription_tier: b.tier, subscription_source: null, subscription_expires_at: b.tier === "free" ? null : until, updated_at: new Date().toISOString() })
      .eq("id", b.pilotId);
    if (error) throw error;
    return Response.json({ ok: true });
  });
}
