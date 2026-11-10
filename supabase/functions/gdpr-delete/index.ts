// GDPR art. 17: deletes the signed-in pilot's account.
// Body must be { "confirm": "DELETE" }. Storage objects are removed first, then the
// auth user; every table cascades from auth.users -> pilots -> pilot_id.
// Store subscriptions (Apple/Google) cannot be cancelled server-side: the app must
// tell the user to cancel them in their store account.
import { errorResponse, json, preflight, readJson } from "../_shared/http.ts";
import { adminClient, getUser, listAllObjects } from "../_shared/supabase.ts";
import { stripeRequest } from "../_shared/stripe.ts";

const BUCKET = "attachments";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return errorResponse(405, "method not allowed");

  const auth = await getUser(req);
  if (!auth) return errorResponse(401, "unauthorized");
  const body = await readJson<{ confirm?: string }>(req);
  if (body?.confirm !== "DELETE") return errorResponse(400, 'confirmation required: {"confirm":"DELETE"}');

  const uid = auth.user.id;
  const admin = adminClient();

  try {
    // 1. Stop Stripe billing (best effort: the account is deleted even if Stripe is unreachable).
    if (Deno.env.get("STRIPE_SECRET_KEY")) {
      const { data: subs } = await admin
        .from("subscriptions")
        .select("external_id, status")
        .eq("pilot_id", uid)
        .eq("source", "stripe");
      for (const s of subs ?? []) {
        if (s.status === "canceled") continue;
        try {
          await stripeRequest("POST", `/subscriptions/${s.external_id}/cancel`);
        } catch (e) {
          console.error("gdpr-delete: stripe cancel", s.external_id, e);
        }
      }
    }

    // 2. Storage objects under "<uid>/".
    const paths = await listAllObjects(admin, BUCKET, uid);
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await admin.storage.from(BUCKET).remove(paths.slice(i, i + 100));
      if (error) throw new Error(`storage remove: ${error.message}`);
    }

    // 3. Auth user (cascades to pilots and all pilot-owned rows).
    const { error } = await admin.auth.admin.deleteUser(uid);
    if (error) throw new Error(`delete user: ${error.message}`);

    return json({ deleted: true, attachmentsRemoved: paths.length });
  } catch (e) {
    console.error("gdpr-delete", uid, e);
    return errorResponse(500, "deletion failed, please retry");
  }
});
