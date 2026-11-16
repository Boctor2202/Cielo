// Stripe webhook: keeps subscriptions + pilots.subscription_* in sync with Stripe.
// Events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted,
// invoice.paid and charge.refunded (money received, for the admin's tax thresholds).
// Secrets: STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY, STRIPE_PRICE_{BASIC,PREMIUM}_{MONTHLY,YEARLY}.
import { errorResponse, json, requireEnv } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";
import { stripeRequest, type StripeSubscription, subscriptionPeriodEnd, tierForPrice, verifyStripeSignature } from "../_shared/stripe.ts";
import { isUuid, upsertSubscription } from "../_shared/subscriptions.ts";
import { recordRevenue } from "../_shared/revenue.ts";

interface StripeInvoice {
  id: string;
  amount_paid: number;
  currency: string;
  status_transitions?: { paid_at?: number | null };
  created: number;
  livemode: boolean;
  charge?: string | null;
  customer_address?: { country?: string | null } | null;
  subscription_details?: { metadata?: Record<string, string> } | null;
  parent?: { subscription_details?: { metadata?: Record<string, string> } | null } | null;
}
interface StripeCharge {
  id: string;
  amount_refunded: number;
  currency: string;
  livemode: boolean;
  created: number;
  payment_method_details?: { card?: { country?: string | null } | null } | null;
  billing_details?: { address?: { country?: string | null } | null } | null;
  metadata?: Record<string, string>;
  refunds?: { data?: { id: string; amount: number; created: number }[] };
}

/** Customer country: billing address, else the card's issuing country. */
async function countryOf(invoice: StripeInvoice): Promise<string | null> {
  if (invoice.customer_address?.country) return invoice.customer_address.country;
  if (!invoice.charge) return null;
  const ch = await stripeRequest<StripeCharge>("GET", `/charges/${invoice.charge}`);
  return ch.billing_details?.address?.country ?? ch.payment_method_details?.card?.country ?? null;
}

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
      case "invoice.paid": {
        const inv = event.data.object as unknown as StripeInvoice;
        if (!inv.amount_paid) break; // the 7-day trial's 0 € invoice
        if (inv.currency.toLowerCase() !== "eur") console.warn("stripe-webhook: non-EUR invoice", inv.id, inv.currency);
        const meta = inv.parent?.subscription_details?.metadata ?? inv.subscription_details?.metadata;
        await recordRevenue(admin, {
          occurredAt: new Date(((inv.status_transitions?.paid_at ?? inv.created) as number) * 1000).toISOString(),
          source: "stripe",
          externalId: inv.id,
          pilotId: isUuid(meta?.pilot_id) ? meta!.pilot_id : null,
          kind: "payment",
          amountCents: inv.amount_paid,
          currency: inv.currency,
          amountEurCents: inv.amount_paid, // prices are in EUR
          country: await countryOf(inv),
          environment: inv.livemode ? "production" : "test",
        });
        break;
      }
      case "charge.refunded": {
        const ch = event.data.object as unknown as StripeCharge;
        for (const r of ch.refunds?.data ?? []) {
          await recordRevenue(admin, {
            occurredAt: new Date(r.created * 1000).toISOString(),
            source: "stripe",
            externalId: r.id,
            kind: "refund",
            amountCents: -r.amount,
            currency: ch.currency,
            amountEurCents: -r.amount,
            country: ch.billing_details?.address?.country ?? ch.payment_method_details?.card?.country ?? null,
            environment: ch.livemode ? "production" : "test",
          });
        }
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
