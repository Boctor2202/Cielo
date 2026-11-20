// Daily reminders before the end of the 30-day trial without a card: 7 days and 1 day before (e-mail via Resend).
// Triggered once a day by pg_cron, like license-alerts, with header Authorization: Bearer <CRON_SECRET>.
// Secrets: CRON_SECRET, RESEND_API_KEY, ALERTS_FROM_EMAIL, optional APP_URL.
// Only pilots without a live subscription; idempotent through trial_reminder_log (migration 0025).
import { errorResponse, json, requireEnv, safeEqual } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";
import { escapeHtml } from "../_shared/i18n.ts";

/** Same as TRIAL_DAYS in packages/core/src/access.ts. */
const TRIAL_DAYS = 30;
const DAY = 86_400_000;

Deno.serve(async (req) => {
  const auth = req.headers.get("Authorization") ?? "";
  if (!safeEqual(auth, `Bearer ${requireEnv("CRON_SECRET")}`)) return errorResponse(401, "unauthorized");
  const admin = adminClient();
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  let sent = 0;
  for (const daysLeft of [7, 1] as const) {
    // accounts whose trial ends in `daysLeft` days: created on that day, TRIAL_DAYS - daysLeft days ago
    const from = new Date(today - (TRIAL_DAYS - daysLeft) * DAY).toISOString();
    const to = new Date(today - (TRIAL_DAYS - daysLeft - 1) * DAY).toISOString();
    const { data, error } = await admin
      .from("pilots")
      .select("id, email, locale, subscription_tier, subscription_expires_at, deleted_at")
      .gte("created_at", from)
      .lt("created_at", to)
      .is("deleted_at", null);
    if (error) return errorResponse(500, `pilots: ${error.message}`);
    for (const p of data ?? []) {
      const live = (p.subscription_tier === "basic" || p.subscription_tier === "premium") && (!p.subscription_expires_at || Date.parse(p.subscription_expires_at) > Date.now());
      if (live || !p.email) continue;
      const { data: claimed } = await admin
        .from("trial_reminder_log")
        .upsert({ pilot_id: p.id, days_left: daysLeft }, { onConflict: "pilot_id,days_left", ignoreDuplicates: true })
        .select("pilot_id");
      if (!claimed?.length) continue;
      const ok = await sendEmail(p.email as string, p.locale === "en" ? "en" : "fr", daysLeft);
      if (ok) sent++;
      else await admin.from("trial_reminder_log").delete().eq("pilot_id", p.id).eq("days_left", daysLeft);
    }
  }
  return json({ sent });
});

async function sendEmail(to: string, locale: "fr" | "en", daysLeft: 7 | 1): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("ALERTS_FROM_EMAIL");
  if (!apiKey || !from) return false;
  const appUrl = Deno.env.get("APP_URL") ?? "https://geardown.app";
  const fr = locale === "fr";
  const subject = fr
    ? daysLeft === 7 ? "Votre essai Geardown se termine dans 7 jours" : "Votre essai Geardown se termine demain"
    : daysLeft === 7 ? "Your Geardown trial ends in 7 days" : "Your Geardown trial ends tomorrow";
  const body = fr
    ? `À la fin de l'essai, votre carnet reste consultable et exportable, et rien n'est supprimé. Pour continuer à saisir des vols, choisissez une formule (Basic ou Max).`
    : `When the trial ends, your logbook stays readable and exportable, and nothing is deleted. To keep logging flights, choose a plan (Basic or Max).`;
  const link = `${appUrl}/${locale}/app/${fr ? "parametres" : "settings"}`;
  const html = `<p>${escapeHtml(body)}</p><p><a href="${escapeHtml(link)}">${fr ? "Choisir une formule" : "Choose a plan"}</a></p>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html, text: `${body}\n${link}` }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
