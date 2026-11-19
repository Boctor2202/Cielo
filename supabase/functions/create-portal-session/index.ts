// Opens the Stripe customer portal for the signed-in pilot: change plan, update the card, see invoices, cancel.
// Body: { returnPath?: "/fr/app/parametres" }
// Response: { url } | 404 { error: "no_customer" } when the pilot never subscribed through Stripe (App Store, Google
// Play or no subscription) | 503 { error: "not_configured" } without STRIPE_SECRET_KEY.
// Secrets: STRIPE_SECRET_KEY, APP_URL (e.g. https://geardown.app).
import { errorResponse, json, preflight, readJson, requireEnv } from "../_shared/http.ts";
import { adminClient, getUser } from "../_shared/supabase.ts";
import { stripeRequest } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return errorResponse(405, "method not allowed");
  if (!Deno.env.get("STRIPE_SECRET_KEY")) return json({ error: "not_configured" }, 503);

  const auth = await getUser(req);
  if (!auth) return errorResponse(401, "unauthorized");
  const { user } = auth;

  const body = (await readJson<{ returnPath?: string }>(req)) ?? {};
  // Only same-site relative paths: never redirect to an arbitrary URL from the body.
  const returnPath = body.returnPath && /^\/[A-Za-z0-9\-_/]*$/.test(body.returnPath) ? body.returnPath : "/app/parametres";
  const appUrl = requireEnv("APP_URL").replace(/\/$/, "");

  const { data: sub } = await adminClient()
    .from("subscriptions")
    .select("customer_id")
    .eq("pilot_id", user.id)
    .eq("source", "stripe")
    .not("customer_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sub?.customer_id) return json({ error: "no_customer" }, 404);

  try {
    const session = await stripeRequest<{ url: string }>("POST", "/billing_portal/sessions", { customer: sub.customer_id, return_url: `${appUrl}${returnPath}` });
    return json({ url: session.url });
  } catch (e) {
    console.error("create-portal-session", e);
    return errorResponse(502, "could not open the billing portal");
  }
});
