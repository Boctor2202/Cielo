import { handle, requireAdmin } from "@/lib/server/admin";
import { GOOGLE_SKU, type GoogleSku } from "@/lib/server/usage";

export const dynamic = "force-dynamic";

interface Row {
  day: string;
  service: string;
  op: string;
  calls: number;
  errors: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

/** AeroAPI, USD per call (estimates from FlightAware's price list), and the monthly credit of the Personal plan. */
const FA_PRICE: Record<string, number> = { flights: 0.005, historyFlights: 0.02, track: 0.012, historyTrack: 0.02 };
const FA_FREE_USD = 5;
/** Subscriptions paid whatever the use, USD per month. */
const FIXED = [
  { key: "supabase", usd: 25 },
  { key: "appleDeveloper", usd: 99 / 12 },
];
/** Free allowances of the services billed by volume. */
const QUOTA = { adzuna: { perMonth: 5000 }, resend: { perMonth: 3000, perDay: 100 }, adsblol: { perDay: 500 } };

/** What FlightAware itself counted this month, when the key can read it (a free call). */
async function flightAwareActual(from: string): Promise<{ calls: number; costUsd: number } | null> {
  const key = process.env.FLIGHTAWARE_API_KEY;
  if (!key) return null;
  const r = await fetch(`https://aeroapi.flightaware.com/aeroapi/account/usage?start=${from}`, { headers: { "x-apikey": key, Accept: "application/json" }, cache: "no-store" }).catch(() => null);
  if (!r?.ok) return null;
  const d = (await r.json().catch(() => null)) as { total_calls?: number; total_cost?: number } | null;
  return d && typeof d.total_cost === "number" ? { calls: d.total_calls ?? 0, costUsd: d.total_cost } : null;
}

/** The month's cost of one service from its rows, the free allowances applied. */
function monthCost(service: string, rows: Row[]): number {
  if (service === "google") {
    const bySku = new Map<string, number>();
    for (const r of rows) bySku.set(r.op, (bySku.get(r.op) ?? 0) + r.calls);
    let usd = 0;
    for (const [sku, n] of bySku) {
      const p = GOOGLE_SKU[sku as GoogleSku];
      if (p) usd += (Math.max(0, n - p.free) * p.per1000) / 1000;
    }
    return usd;
  }
  if (service === "flightaware") {
    const usd = rows.reduce((s, r) => s + r.calls * (FA_PRICE[r.op] ?? 0.01), 0);
    return Math.max(0, usd - FA_FREE_USD);
  }
  return rows.reduce((s, r) => s + Number(r.cost_usd), 0);
}

/**
 * GET /api/admin/usage — the outside APIs: calls, errors, AI tokens and their cost this month and last month,
 * a projection to the month's end, the last 30 days day by day, the free quotas, and the fixed subscriptions.
 */
export function GET(req: Request) {
  return handle(async () => {
    const { db } = await requireAdmin(req);
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const from30 = new Date(now.getTime() - 29 * 86400_000);
    const since = (prevStart < from30 ? prevStart : from30).toISOString().slice(0, 10);
    const { data, error } = await db.from("api_usage").select("day, service, op, calls, errors, input_tokens, output_tokens, cost_usd").gte("day", since);
    if (error) return Response.json({ ready: false, reason: error.message });
    const rows = (data ?? []) as Row[];
    const m0 = monthStart.toISOString().slice(0, 10);
    const p0 = prevStart.toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);
    const thisMonth = rows.filter((r) => r.day >= m0);
    const lastMonth = rows.filter((r) => r.day >= p0 && r.day < m0);
    const daysIn = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
    const elapsed = (now.getTime() - monthStart.getTime()) / 86400_000;
    const fa = await flightAwareActual(m0);

    const SERVICES = ["anthropic", "google", "flightaware", "openaip", "gfs", "adzuna", "resend", "expo", "adsblol"];
    const services = SERVICES.map((service) => {
      const mine = thisMonth.filter((r) => r.service === service);
      const prev = lastMonth.filter((r) => r.service === service);
      const ops = [...new Set(mine.map((r) => r.op))].map((op) => {
        const o = mine.filter((r) => r.op === op);
        return { op, calls: o.reduce((s, r) => s + r.calls, 0), errors: o.reduce((s, r) => s + r.errors, 0), input: o.reduce((s, r) => s + Number(r.input_tokens), 0), output: o.reduce((s, r) => s + Number(r.output_tokens), 0), costUsd: o.reduce((s, r) => s + Number(r.cost_usd), 0) };
      });
      let cost = monthCost(service, mine);
      let actual = false;
      if (service === "flightaware" && fa) {
        cost = Math.max(0, fa.costUsd - FA_FREE_USD);
        actual = true;
      }
      // projection: the same pace to the end of the month (the free allowances re-applied on the projected volume)
      const scale = elapsed > 0.5 ? daysIn / elapsed : 0;
      const projected = scale ? monthCost(service, mine.map((r) => ({ ...r, calls: r.calls * scale, cost_usd: Number(r.cost_usd) * scale }))) : cost;
      const calls = mine.reduce((s, r) => s + r.calls, 0);
      const callsToday = mine.filter((r) => r.day === today).reduce((s, r) => s + r.calls, 0);
      return {
        service,
        calls,
        callsToday,
        errors: mine.reduce((s, r) => s + r.errors, 0),
        input: mine.reduce((s, r) => s + Number(r.input_tokens), 0),
        output: mine.reduce((s, r) => s + Number(r.output_tokens), 0),
        costUsd: cost,
        actual,
        projectedUsd: actual ? cost * (scale || 1) : Math.max(cost, projected),
        lastMonthUsd: monthCost(service, prev),
        lastMonthCalls: prev.reduce((s, r) => s + r.calls, 0),
        ops: ops.sort((a, b) => b.calls - a.calls),
        quota: (QUOTA as Record<string, { perDay?: number; perMonth?: number }>)[service] ?? null,
      };
    });
    const perDay: { date: string; calls: number; costUsd: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400_000).toISOString().slice(0, 10);
      const r = rows.filter((x) => x.day === d);
      perDay.push({ date: d, calls: r.reduce((s, x) => s + x.calls, 0), costUsd: r.reduce((s, x) => s + Number(x.cost_usd), 0) });
    }
    const fixedUsd = FIXED.reduce((s, f) => s + f.usd, 0);
    const first = rows.map((r) => r.day).sort()[0] ?? null;
    return Response.json({
      ready: true,
      since: first,
      month: m0,
      services,
      perDay,
      fixed: FIXED,
      totals: {
        variableUsd: services.reduce((s, x) => s + x.costUsd, 0),
        projectedUsd: services.reduce((s, x) => s + x.projectedUsd, 0) + fixedUsd,
        lastMonthUsd: services.reduce((s, x) => s + x.lastMonthUsd, 0) + fixedUsd,
        fixedUsd,
      },
    });
  });
}
