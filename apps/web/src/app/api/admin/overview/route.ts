import { PRICES_EUR } from "@cielo/core";
import { adminIds, handle, requireAdmin, testIds } from "@/lib/server/admin";
import { latestSubs, stageOf, type PilotRow, type SubRow } from "@/lib/server/pilotStage";
import { thresholdStatus, type Revenue } from "@/lib/server/thresholds";

export const dynamic = "force-dynamic";

const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000).toISOString();

/** GET /api/admin/overview — sign-ups, subscribers, trials, estimated MRR, activity, open reports (admin accounts left out). */
export function GET(req: Request) {
  return handle(async () => {
    const { db } = await requireAdmin(req);
    const yearStart = `${new Date().getUTCFullYear()}-01-01T00:00:00Z`;
    // the admin and test accounts are left out of every figure
    const admins = [...adminIds(), ...(await testIds(db))];
    const notAdmin = <T extends { not: (c: string, o: string, v: string) => T }>(q: T, col: string) => (admins.length ? q.not(col, "in", `(${admins.join(",")})`) : q);
    const [{ data: pilots }, { data: subs }, { data: stats }, { count: openReports }, { count: flights }, { data: revenue }] = await Promise.all([
      notAdmin(db.from("pilots").select("id, created_at, trial_started_at, subscription_tier, subscription_source, subscription_expires_at").is("deleted_at", null), "id"),
      notAdmin(db.from("subscriptions").select("pilot_id, source, tier, status, created_at, current_period_end"), "pilot_id"),
      notAdmin(db.from("admin_pilot_stats").select("pilot_id, flights, last_flight_change"), "pilot_id"),
      db.from("feedback").select("id", { count: "exact", head: true }).in("status", ["new", "in_progress"]),
      notAdmin(db.from("flights").select("id", { count: "exact", head: true }).is("deleted_at", null), "pilot_id"),
      notAdmin(db.from("revenue_events").select("occurred_at, source, amount_eur_cents, proceeds_eur_cents, country").eq("environment", "production").gte("occurred_at", yearStart), "pilot_id"),
    ]);
    const now = Date.now();
    const P = (pilots ?? []) as PilotRow[];
    const S = (subs ?? []) as SubRow[];
    const latest = latestSubs(S);
    const stages = P.map((p) => ({ p, s: latest.get(p.id), ...stageOf(p, latest.get(p.id), now) }));
    const paying = stages.filter((x) => x.stage === "paying").map((x) => x.s!);
    const trials = stages.filter((x) => x.stage === "trial");
    const comped = stages.filter((x) => x.stage === "comped");
    const mrr = paying.reduce((s, x) => s + (x.tier === "premium" ? PRICES_EUR.premium : x.tier === "basic" ? PRICES_EUR.basic : 0), 0);
    // sign-ups per day, last 30 days
    const perDay: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) perDay[daysAgo(i).slice(0, 10)] = 0;
    for (const p of P) {
      const d = p.created_at.slice(0, 10);
      if (d in perDay) perDay[d]!++;
    }
    // visitors of the website (one per browser and day, the admin's browsers left out), last 30 days
    const { data: visits } = await db.from("site_visits").select("day, ref_host, first_path").gte("day", daysAgo(29).slice(0, 10)).limit(50_000);
    const visitsPerDay: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) visitsPerDay[daysAgo(i).slice(0, 10)] = 0;
    const sources: Record<string, number> = {};
    const pages: Record<string, number> = {};
    for (const v of visits ?? []) {
      if (v.day in visitsPerDay) visitsPerDay[v.day]!++;
      const src = v.ref_host ?? "direct";
      sources[src] = (sources[src] ?? 0) + 1;
      if (v.first_path) pages[v.first_path] = (pages[v.first_path] ?? 0) + 1;
    }
    const top = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([key, n]) => ({ key, n }));
    const days = Object.values(visitsPerDay);
    const active7 = (stats ?? []).filter((s) => s.last_flight_change && Date.parse(s.last_flight_change) > now - 7 * 86400_000).length;
    return Response.json({
      pilots: P.length,
      signups7: P.filter((p) => p.created_at >= daysAgo(7)).length,
      signups30: P.filter((p) => p.created_at >= daysAgo(30)).length,
      signupsPerDay: Object.entries(perDay).map(([date, n]) => ({ date, n })),
      paying: { total: paying.length, basic: paying.filter((s) => s.tier === "basic").length, max: paying.filter((s) => s.tier === "premium").length, stripe: paying.filter((s) => s.source === "stripe").length, apple: paying.filter((s) => s.source === "apple").length, google: paying.filter((s) => s.source === "google").length },
      trials: trials.length,
      trialsEnded: stages.filter((x) => x.stage === "ended").length,
      comped: comped.length,
      canceled30: S.filter((s) => ["canceled", "expired"].includes(s.status) && s.current_period_end && s.current_period_end >= daysAgo(30)).length,
      mrr: Math.round(mrr * 100) / 100,
      active7,
      flights: flights ?? 0,
      openReports: openReports ?? 0,
      thresholds: thresholdStatus((revenue ?? []) as Revenue[]),
      visitors: {
        perDay: Object.entries(visitsPerDay).map(([date, n]) => ({ date, n })),
        today: days.at(-1) ?? 0,
        d7: days.slice(-7).reduce((a, b) => a + b, 0),
        d30: days.reduce((a, b) => a + b, 0),
        sources: top(sources),
        pages: top(pages),
      },
    });
  });
}
