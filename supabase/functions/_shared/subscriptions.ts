// Subscription bookkeeping shared by stripe-webhook and revenuecat-webhook.
// subscriptions keeps one row per store subscription; pilots.subscription_* is
// derived from the best currently active row (so a pilot paying on two stores
// keeps the highest tier until both lapse).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type Tier = "free" | "basic" | "premium";
export type Source = "stripe" | "apple" | "google";

const TIER_RANK: Record<Tier, number> = { free: 0, basic: 1, premium: 2 };

/** Statuses that still grant the entitlement (until current_period_end). */
export const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due", "canceling", "billing_issue"]);

export interface SubscriptionUpsert {
  pilotId: string;
  source: Source;
  externalId: string;
  customerId?: string | null;
  productId?: string | null;
  tier: Tier;
  status: string;
  currentPeriodEnd?: string | null;
  raw: unknown;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

export async function upsertSubscription(admin: SupabaseClient, s: SubscriptionUpsert): Promise<void> {
  const { error } = await admin.from("subscriptions").upsert(
    {
      pilot_id: s.pilotId,
      source: s.source,
      external_id: s.externalId,
      customer_id: s.customerId ?? null,
      product_id: s.productId ?? null,
      tier: s.tier,
      status: s.status,
      current_period_end: s.currentPeriodEnd ?? null,
      raw: s.raw ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "source,external_id" },
  );
  if (error) throw new Error(`subscriptions upsert: ${error.message}`);
  await refreshPilotSubscription(admin, s.pilotId);
}

/** Recomputes pilots.subscription_tier/source/expires_at from the subscriptions table. */
export async function refreshPilotSubscription(admin: SupabaseClient, pilotId: string, now = new Date()): Promise<void> {
  const { data, error } = await admin
    .from("subscriptions")
    .select("source, tier, status, current_period_end")
    .eq("pilot_id", pilotId);
  if (error) throw new Error(`subscriptions select: ${error.message}`);

  let best: { tier: Tier; source: Source | null; expiresAt: string | null } = { tier: "free", source: null, expiresAt: null };
  for (const row of data ?? []) {
    const end = row.current_period_end as string | null;
    const active = ACTIVE_STATUSES.has(row.status as string) && (!end || Date.parse(end) > now.getTime());
    if (!active) continue;
    const tier = row.tier as Tier;
    const better = TIER_RANK[tier] > TIER_RANK[best.tier] ||
      (TIER_RANK[tier] === TIER_RANK[best.tier] && end && best.expiresAt && Date.parse(end) > Date.parse(best.expiresAt));
    if (better) best = { tier, source: row.source as Source, expiresAt: end };
  }

  // updated_at = now() so that clients pull the change (and the LWW guard accepts it).
  const { error: upErr } = await admin
    .from("pilots")
    .update({
      subscription_tier: best.tier,
      subscription_source: best.source,
      subscription_expires_at: best.expiresAt,
      updated_at: now.toISOString(),
    })
    .eq("id", pilotId);
  if (upErr) throw new Error(`pilots update: ${upErr.message}`);
}
