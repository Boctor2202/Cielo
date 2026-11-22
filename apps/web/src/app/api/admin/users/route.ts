import type { SupabaseClient } from "@supabase/supabase-js";
import { adminIds, handle, HttpError, requireAdmin, testIds } from "@/lib/server/admin";
import { latestSubs, stageOf, type PilotRow, type SubRow } from "@/lib/server/pilotStage";

export const dynamic = "force-dynamic";

/** Last sign-in of every account (auth), by id. */
async function lastSignIns(db: SupabaseClient): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) break;
    for (const u of data.users) if (u.last_sign_in_at) m.set(u.id, u.last_sign_in_at);
    if (data.users.length < 1000) break;
  }
  return m;
}

const latest = (...d: (string | null | undefined)[]) => d.filter((x): x is string => !!x).sort().at(-1) ?? null;

/**
 * GET /api/admin/users?q= — the subscribers (on a trial, paying, trial over, cancelled), newest first, and apart
 * the pilots given a plan by hand. The admin accounts are left out.
 */
export function GET(req: Request) {
  return handle(async () => {
    const { db } = await requireAdmin(req);
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim().replace(/[%,()]/g, "");
    let query = db
      .from("pilots")
      .select("id, email, full_name, created_at, updated_at, trial_started_at, subscription_tier, subscription_source, subscription_expires_at, locale")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1000);
    const admins = adminIds();
    if (admins.length) query = query.not("id", "in", `(${admins.join(",")})`);
    if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
    const { data: pilots, error } = await query;
    if (error) throw error;
    const ids = (pilots ?? []).map((p) => p.id);
    const [{ data: stats }, { data: subs }, signIns, tests] = await Promise.all([
      db.from("admin_pilot_stats").select("pilot_id, flights, last_flight_change").in("pilot_id", ids),
      db.from("subscriptions").select("pilot_id, source, tier, status, created_at, current_period_end").in("pilot_id", ids),
      lastSignIns(db),
      testIds(db).then((t) => new Set(t)),
    ]);
    const st = new Map((stats ?? []).map((s) => [s.pilot_id, s]));
    const sub = latestSubs(subs as SubRow[]);
    const users = (pilots ?? []).map((p) => {
      const s = sub.get(p.id);
      return {
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        created_at: p.created_at,
        subscription_tier: p.subscription_tier,
        subscription_expires_at: p.subscription_expires_at,
        flights: st.get(p.id)?.flights ?? 0,
        lastActivity: latest(signIns.get(p.id), st.get(p.id)?.last_flight_change, p.updated_at),
        subscription: s ? { source: s.source, tier: s.tier, status: s.status } : null,
        test: tests.has(p.id),
        ...stageOf(p as PilotRow, s),
      };
    });
    return Response.json({ users, adminsHidden: admins.length });
  });
}

/**
 * POST /api/admin/users {pilotId, tier: "basic" | "premium" | "free", until?: ISO} — grant or remove a plan by hand;
 * {pilotId, test: boolean} — mark or unmark a test account.
 */
export function POST(req: Request) {
  return handle(async () => {
    const { db } = await requireAdmin(req);
    const b = (await req.json().catch(() => null)) as { pilotId?: string; tier?: string; until?: string | null; test?: boolean; signIn?: boolean; locale?: string } | null;
    // a one-time sign-in link to a TEST account, to see its screens (never offered for a real pilot's account)
    if (b?.pilotId && b.signIn) {
      const { data: p } = await db.from("pilots").select("email, test_account").eq("id", b.pilotId).maybeSingle();
      if (!p?.test_account || !p.email) throw new HttpError(403, "not_test_account");
      const origin = new URL(req.url).origin;
      const lang = b.locale === "en" ? "en" : "fr";
      const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email: p.email, options: { redirectTo: `${origin}/${lang}/app` } });
      if (error || !data.properties?.action_link) throw new HttpError(502, "link_failed");
      return Response.json({ link: data.properties.action_link });
    }
    if (b?.pilotId && typeof b.test === "boolean") {
      const { error } = await db.from("pilots").update({ test_account: b.test }).eq("id", b.pilotId);
      if (error) throw new HttpError(503, "migration_0032");
      return Response.json({ ok: true });
    }
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
