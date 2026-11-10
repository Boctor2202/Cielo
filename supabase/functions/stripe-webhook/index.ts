// Stripe webhook: keeps subscriptions + pilots.subscription_* in sync with Stripe.
// Events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted.
// Secrets: STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY, STRIPE_PRICE_{BASIC,PREMIUM}_{MONTHLY,YEARLY}.
import { errorResponse, json, requireEnv } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";
import { stripeRequest, type StripeSubscription, subscriptionPeriodEnd, tierForPrice, verifyStripeSignature } from "../_shared/stripe.ts";
import { isUuid, upsertSubscription } from "../_shared/subscriptions.ts";

interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

interface CheckoutSession {
  id: string;
  mode: string;
  client_reference_id: string | null;
  customer: string | null;
  subscription: string | null;
  metadata?: Record<string, string>;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return errorResponse(405, "method not allowed");

  const rawBody = await req.text();
  const ok = await verifyStripeSignature(rawBody, req.headers.get("Stripe-Signature"), requireEnv("STRIPE_WEBHOOK_SECRET"));
  if (!ok) return errorResponse(400, "invalid signature");

  const event = JSON.parse(rawBody) as StripeEvent;
  const admin = adminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as unknown as CheckoutSession;
        if (session.mode !== "subscription" || !session.subscription) break;
        const pilotId = session.client_reference_id ?? session.metadata?.pilot_id;
        if (!isUuid(pilotId)) return errorResponse(400, "missing client_reference_id");
        // The session only carries the subscription id: fetch it for price + period.
        const sub = await stripeRequest<StripeSubscription>("GET", `/subscriptions/${session.subscription}`);
        await saveSubscription(admin, pilotId, sub);
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as unknown as StripeSubscription;
        const pilotId = sub.metadata?.pilot_id ?? (await pilotForSubscription(admin, sub.id));
        if (!isUuid(pilotId)) {
          // Not (yet) linked to a pilot, e.g. updated before checkout.session.completed arrived.
          // Returning 500 makes Stripe retry later.
          return errorResponse(500, `unknown pilot for subscription ${sub.id}`);
        }
        if (!(await pilotExists(admin, pilotId))) break; // account deleted (gdpr-delete): nothing to update
        await saveSubscription(admin, pilotId, event.type === "customer.subscription.deleted" ? { ...sub, status: "canceled" } : sub);
        break;
      }
      default:
        // Other events are acknowledged and ignored.
        break;
    }
  } catch (e) {
    console.error("stripe-webhook", event.type, event.id, e);
    return errorResponse(500, "processing failed");
  }

  return json({ received: true });
});

async function saveSubscription(admin: ReturnType<typeof adminClient>, pilotId: string, sub: StripeSubscription) {
  const priceId = sub.items.data[0]?.price.id ?? null;
  const tier = tierForPrice(priceId);
  if (!tier) console.warn(`stripe-webhook: unknown price ${priceId}, treated as free`);
  // A subscription set to cancel at period end still grants access until then.
  const status = sub.status === "active" && sub.cancel_at_period_end ? "canceling" : sub.status;
  await upsertSubscription(admin, {
    pilotId,
    source: "stripe",
    externalId: sub.id,
    customerId: sub.customer,
    productId: priceId,
    tier: tier ?? "free",
    status,
    currentPeriodEnd: subscriptionPeriodEnd(sub),
    raw: sub,
  });
}

async function pilotForSubscription(admin: ReturnType<typeof adminClient>, subscriptionId: string): Promise<string | undefined> {
  const { data } = await admin
    .from("subscriptions")
    .select("pilot_id")
    .eq("source", "stripe")
    .eq("external_id", subscriptionId)
    .maybeSingle();
  return (data?.pilot_id as string | undefined) ?? undefined;
}

async function pilotExists(admin: ReturnType<typeof adminClient>, pilotId: string): Promise<boolean> {
  const { data } = await admin.from("pilots").select("id").eq("id", pilotId).maybeSingle();
  return !!data;
}
