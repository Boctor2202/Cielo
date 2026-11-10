// RevenueCat webhook (in-app purchases on iOS / Android).
// The mobile app must call Purchases.logIn(<pilot id>) so that app_user_id = pilots.id.
// Entitlements "premium" / "basic" map to tiers. Secret: REVENUECAT_WEBHOOK_AUTH
// (the exact Authorization header value configured in the RevenueCat dashboard).
import { errorResponse, json, readJson, requireEnv, safeEqual } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";
import { isUuid, refreshPilotSubscription, type Source, type Tier, upsertSubscription } from "../_shared/subscriptions.ts";

interface RevenueCatEvent {
  id: string;
  type: string;
  app_user_id: string;
  original_app_user_id?: string;
  aliases?: string[];
  entitlement_ids?: string[] | null;
  entitlement_id?: string | null;
  product_id?: string;
  store?: string;
  expiration_at_ms?: number | null;
  original_transaction_id?: string;
  transaction_id?: string;
  environment?: "SANDBOX" | "PRODUCTION";
  transferred_from?: string[];
  transferred_to?: string[];
}

const STORE_SOURCE: Record<string, Source> = {
  APP_STORE: "apple",
  MAC_APP_STORE: "apple",
  PLAY_STORE: "google",
};

function tierFromEntitlements(ids: string[]): Tier {
  if (ids.includes("premium")) return "premium";
  if (ids.includes("basic")) return "basic";
  return "free";
}

function statusFor(type: string): string {
  switch (type) {
    case "EXPIRATION":
      return "expired";
    case "CANCELLATION": // auto-renew turned off: access continues until expiration
      return "canceling";
    case "BILLING_ISSUE": // store grace period
      return "billing_issue";
    default: // INITIAL_PURCHASE, RENEWAL, PRODUCT_CHANGE, UNCANCELLATION, NON_RENEWING_PURCHASE, SUBSCRIPTION_EXTENDED...
      return "active";
  }
}

/** First candidate id that is a pilot uuid (anonymous $RCAnonymousID ids are skipped). */
function pilotIdOf(ev: RevenueCatEvent): string | undefined {
  return [ev.app_user_id, ev.original_app_user_id, ...(ev.aliases ?? [])].find(isUuid);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return errorResponse(405, "method not allowed");

  const expected = requireEnv("REVENUECAT_WEBHOOK_AUTH");
  const received = req.headers.get("Authorization") ?? "";
  if (!safeEqual(received, expected) && !safeEqual(received, `Bearer ${expected}`)) {
    return errorResponse(401, "unauthorized");
  }

  const payload = await readJson<{ event?: RevenueCatEvent }>(req);
  const ev = payload?.event;
  if (!ev?.type) return errorResponse(400, "invalid payload");
  if (ev.type === "TEST") return json({ received: true, test: true });

  const admin = adminClient();
  try {
    if (ev.type === "TRANSFER") {
      // Purchases moved between app users: reassign the store rows, then recompute everyone involved.
      const to = ev.transferred_to?.find(isUuid);
      const from = (ev.transferred_from ?? []).filter(isUuid);
      if (to && from.length) {
        const { error } = await admin.from("subscriptions").update({ pilot_id: to }).in("pilot_id", from).in("source", ["apple", "google"]);
        if (error) throw new Error(error.message);
      }
      for (const id of new Set([...from, ...(to ? [to] : [])])) await refreshPilotSubscription(admin, id);
      return json({ received: true });
    }

    const pilotId = pilotIdOf(ev);
    const source = ev.store ? STORE_SOURCE[ev.store] : undefined;
    if (!pilotId || !source) {
      console.warn("revenuecat-webhook: ignored event", ev.id, ev.type, ev.store);
      return json({ received: true, ignored: true });
    }

    const entitlements = ev.entitlement_ids ?? (ev.entitlement_id ? [ev.entitlement_id] : []);
    await upsertSubscription(admin, {
      pilotId,
      source,
      externalId: ev.original_transaction_id ?? ev.transaction_id ?? `${pilotId}:${ev.product_id}`,
      customerId: ev.app_user_id,
      productId: ev.product_id ?? null,
      tier: tierFromEntitlements(entitlements),
      status: statusFor(ev.type),
      currentPeriodEnd: ev.expiration_at_ms ? new Date(ev.expiration_at_ms).toISOString() : null,
      raw: ev,
    });
  } catch (e) {
    console.error("revenuecat-webhook", ev.type, ev.id, e);
    return errorResponse(500, "processing failed"); // RevenueCat retries
  }
  return json({ received: true });
});
