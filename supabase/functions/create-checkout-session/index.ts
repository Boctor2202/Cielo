// Creates a Stripe Checkout session for the signed-in pilot.
// Body: { plan: "basic" | "premium", interval: "monthly" | "yearly", returnPath?: "/settings" }
// Response: { url }
// Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_*, APP_URL (e.g. https://app.cielo.aero).
import { errorResponse, json, preflight, readJson, requireEnv } from "../_shared/http.ts";
import { adminClient, getUser } from "../_shared/supabase.ts";
import { type Interval, type Plan, priceIdFor, stripeRequest } from "../_shared/stripe.ts";

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
  if (body.interval !== "monthly" && body.interval !== "yearly") return errorResponse(400, "interval must be monthly or yearly");

  // Only same-site relative paths: never redirect to an arbitrary URL from the body.
  const returnPath = body.returnPath && /^\/[A-Za-z0-9\-_/]*$/.test(body.returnPath) ? body.returnPath : "/settings/subscription";
  const appUrl = requireEnv("APP_URL").replace(/\/$/, "");

  try {
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

    const session = await stripeRequest<{ id: string; url: string }>("POST", "/checkout/sessions", {
      mode: "subscription",
      line_items: { 0: { price: priceIdFor(body.plan, body.interval), quantity: 1 } },
      client_reference_id: user.id,
      ...(previous?.customer_id ? { customer: previous.customer_id } : { customer_email: user.email }),
      metadata: { pilot_id: user.id },
      subscription_data: { metadata: { pilot_id: user.id } },
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
