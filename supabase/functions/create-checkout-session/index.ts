// Creates a Stripe Checkout session for the signed-in pilot.
// Body: { plan: "basic" | "premium" (Max), interval?: "monthly", returnPath?: "/settings" }
// The 30-day trial needs no card: it runs on the account from its creation. The card is asked only here, when
// the pilot chooses to subscribe; the days of trial left are kept (nothing is charged before the trial ends).
// Response: { url }
// Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_*, APP_URL (e.g. https://geardown.app).
import { errorResponse, json, preflight, readJson, requireEnv } from "../_shared/http.ts";
import { adminClient, getUser } from "../_shared/supabase.ts";
import { type Interval, type Plan, priceIdFor, stripeRequest } from "../_shared/stripe.ts";

/** Same as TRIAL_DAYS in packages/core/src/access.ts (functions cannot import the workspace packages). */
const TRIAL_DAYS = 30;

interface Body {
  plan?: Plan;
  interval?: Interval;
  returnPath?: string;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return errorResponse(405, "method not allowed");

  const auth = await getUser(req);
  if (!auth) return errorResponse(401, "unauthorized");
  const { user } = auth;

  const body = await readJson<Body>(req);
  if (!body || (body.plan !== "basic" && body.plan !== "premium")) return errorResponse(400, "plan must be basic or premium");
  const interval: Interval = body.interval ?? "monthly";
  if (interval !== "monthly" && interval !== "yearly") return errorResponse(400, "interval must be monthly or yearly");

  // Only same-site relative paths: never redirect to an arbitrary URL from the body.
  const returnPath = body.returnPath && /^\/[A-Za-z0-9\-_/]*$/.test(body.returnPath) ? body.returnPath : "/settings/subscription";
  const appUrl = requireEnv("APP_URL").replace(/\/$/, "");

  try {
    // A subscription still running: a change of plan goes through the customer portal, never a second subscription.
    const { count: running } = await adminClient()
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("pilot_id", user.id)
      .eq("source", "stripe")
      .in("status", ["trialing", "active", "past_due"]);
    if (running) return json({ error: "already_subscribed" }, 409);

    // Reuse the Stripe customer of a previous subscription, if any.
    const { data: previous } = await adminClient()
      .from("subscriptions")
      .select("customer_id")
      .eq("pilot_id", user.id)
      .eq("source", "stripe")
      .not("customer_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    // one trial per pilot, whatever the store (Stripe, Apple, Google)
    const { count: pastSubscriptions } = await adminClient()
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("pilot_id", user.id);
    // what is left of the account's 30-day trial (Stripe needs a trial end at least 48 h ahead)
    const { data: pilotRow } = await adminClient().from("pilots").select("created_at").eq("id", user.id).maybeSingle();
    const trialEnd = pilotRow?.created_at ? Math.floor(Date.parse(pilotRow.created_at as string) / 1000) + TRIAL_DAYS * 86_400 : 0;
    const keepTrial = !pastSubscriptions && trialEnd - Date.now() / 1000 > 48 * 3600;

    const session = await stripeRequest<{ id: string; url: string }>("POST", "/checkout/sessions", {
      mode: "subscription",
      line_items: { 0: { price: priceIdFor(body.plan, interval), quantity: 1 } },
      payment_method_collection: "always",
      client_reference_id: user.id,
      ...(previous?.customer_id ? { customer: previous.customer_id } : { customer_email: user.email }),
      metadata: { pilot_id: user.id },
      subscription_data: {
        metadata: { pilot_id: user.id },
        ...(keepTrial ? { trial_end: trialEnd, trial_settings: { end_behavior: { missing_payment_method: "cancel" } } } : {}),
      },
      allow_promotion_codes: true,
      success_url: `${appUrl}${returnPath}?checkout=success`,
      cancel_url: `${appUrl}${returnPath}?checkout=cancel`,
    });
    return json({ url: session.url, id: session.id });
  } catch (e) {
    console.error("create-checkout-session", e);
    return errorResponse(502, "could not create checkout session");
  }
});
