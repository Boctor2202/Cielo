import { PRICES_EUR } from "@cielo/core";
import { handle, requireAdmin } from "@/lib/server/admin";
import { thresholdStatus, type Revenue } from "@/lib/server/thresholds";

export const dynamic = "force-dynamic";

const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000).toISOString();

/** GET /api/admin/overview — sign-ups, subscribers, trials, estimated MRR, activity, open reports. */
export function GET(req: Request) {
  return handle(async () => {
    const { db } = await requireAdmin(req);
    const yearStart = `${new Date().getUTCFullYear()}-01-01T00:00:00Z`;
    const [{ data: pilots }, { data: subs }, { data: stats }, { count: openReports }, { count: flights }, { data: revenue }] = await Promise.all([
      db.from("pilots").select("id, created_at, subscription_tier, subscription_source, subscription_expires_at").is("deleted_at", null),
      db.from("subscriptions").select("pilot_id, source, tier, status, current_period_end"),
      db.from("admin_pilot_stats").select("pilot_id, flights, last_flight_change"),
      db.from("feedback").select("id", { count: "exact", head: true }).in("status", ["new", "in_progress"]),
      db.from("flights").select("id", { count: "exact", head: true }).is("deleted_at", null),
      db.from("revenue_events").select("occurred_at, source, amount_eur_cents, proceeds_eur_cents, country").eq("environment", "production").gte("occurred_at", yearStart),
    ]);
    const now = Date.now();
    const live = (exp?: string | null) => !exp || Date.parse(exp) > now;
    const P = pilots ?? [];
    const S = subs ?? [];
    const paying = S.filter((s) => ["active", "past_due", "canceling", "billing_issue"].includes(s.status) && live(s.current_period_end));
    const trials = S.filter((s) => s.status === "trialing" && live(s.current_period_end));
    const paidIds = new Set([...paying, ...trials].map((s) => s.pilot_id));
    // a plan granted from the admin (no store subscription behind it)
    const comped = P.filter((p) => (p.subscription_tier === "basic" || p.subscription_tier === "premium") && !paidIds.has(p.id) && live(p.subscription_expires_at));
    const mrr = paying.reduce((s, x) => s + (x.tier === "premium" ? PRICES_EUR.premium : x.tier === "basic" ? PRICES_EUR.basic : 0), 0);
    // sign-ups per day, last 30 days
    const perDay: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) perDay[daysAgo(i).slice(0, 10)] = 0;
    for (const p of P) {
      const d = p.created_at.slice(0, 10);
      if (d in perDay) perDay[d]!++;
    }
    const active7 = (stats ?? []).filter((s) => s.last_flight_change && Date.parse(s.last_flight_change) > now - 7 * 86400_000).length;
    return Response.json({
      pilots: P.length,
      signups7: P.filter((p) => p.created_at >= daysAgo(7)).length,
      signups30: P.filter((p) => p.created_at >= daysAgo(30)).length,
      signupsPerDay: Object.entries(perDay).map(([date, n]) => ({ date, n })),
      paying: { total: paying.length, basic: paying.filter((s) => s.tier === "basic").length, max: paying.filter((s) => s.tier === "premium").length, stripe: paying.filter((s) => s.source === "stripe").length, apple: paying.filter((s) => s.source === "apple").length, google: paying.filter((s) => s.source === "google").length },
      trials: trials.length,
      comped: comped.length,
      canceled30: S.filter((s) => ["canceled", "expired"].includes(s.status) && s.current_period_end && s.current_period_end >= daysAgo(30)).length,
      mrr: Math.round(mrr * 100) / 100,
      active7,
      flights: flights ?? 0,
      openReports: openReports ?? 0,
      thresholds: thresholdStatus((revenue ?? []) as Revenue[]),
    });
  });
}
