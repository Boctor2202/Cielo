// Records money received (payments and refunds) for the admin's tax-threshold tracking.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface RevenueEvent {
  occurredAt: string;
  source: "stripe" | "apple" | "google";
  externalId: string;
  pilotId?: string | null;
  kind: "payment" | "refund";
  amountCents: number;
  currency: string;
  amountEurCents: number;
  proceedsEurCents?: number | null;
  country?: string | null;
  environment?: string;
}

/** Idempotent on (source, external_id): webhook retries do not double count. */
export async function recordRevenue(admin: SupabaseClient, e: RevenueEvent): Promise<void> {
  const { error } = await admin.from("revenue_events").upsert(
    {
      occurred_at: e.occurredAt,
      source: e.source,
      external_id: e.externalId,
      pilot_id: e.pilotId ?? null,
      kind: e.kind,
      amount_cents: Math.round(e.amountCents),
      currency: e.currency.toUpperCase(),
      amount_eur_cents: Math.round(e.amountEurCents),
      proceeds_eur_cents: e.proceedsEurCents == null ? null : Math.round(e.proceedsEurCents),
      country: e.country?.toUpperCase() ?? null,
      environment: e.environment ?? "production",
    },
    { onConflict: "source,external_id", ignoreDuplicates: true },
  );
  if (error) throw new Error(`revenue_events: ${error.message}`);
}
