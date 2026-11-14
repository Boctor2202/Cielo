// Daily licence / medical expiry alerts (e-mail via Resend + Expo push).
// Triggered once a day by pg_cron (see docs/backend.md) with header
//   Authorization: Bearer <CRON_SECRET>
// Secrets: CRON_SECRET, RESEND_API_KEY, ALERTS_FROM_EMAIL (e.g. "Sillage <alertes@sillage.aero>"),
// optional APP_URL (link in the e-mail).
// Idempotent: license_alert_log records (license, day) so a re-run never sends twice.
import { errorResponse, json, requireEnv, safeEqual } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";
import { alertsDueToday, DEFAULT_ALERT_DAYS } from "../_shared/licenses.ts";
import { escapeHtml, licenseAlertText, type Locale } from "../_shared/i18n.ts";

interface LicenseRow {
  id: string;
  pilot_id: string;
  code: string;
  valid_until: string | null;
  alert_days: number[] | null;
  deleted_at: string | null;
}

interface Alert {
  licenseId: string;
  code: string;
  validUntil: string;
  daysLeft: number;
}

Deno.serve(async (req) => {
  const auth = req.headers.get("Authorization") ?? "";
  if (!safeEqual(auth, `Bearer ${requireEnv("CRON_SECRET")}`)) return errorResponse(401, "unauthorized");

  // Optional ?date=YYYY-MM-DD to replay a day (still idempotent).
  const qDate = new URL(req.url).searchParams.get("date");
  const today = qDate && /^\d{4}-\d{2}-\d{2}$/.test(qDate) ? qDate : new Date().toISOString().slice(0, 10);
  const admin = adminClient();

  // 1. Candidate licences: valid_until within [today, today + largest threshold].
  const maxDays = 730;
  const horizon = new Date(Date.parse(`${today}T00:00:00Z`) + maxDays * 86_400_000).toISOString().slice(0, 10);
  const rows: LicenseRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("licenses")
      .select("id, pilot_id, code, valid_until, alert_days, deleted_at")
      .is("deleted_at", null)
      .gte("valid_until", today)
      .lte("valid_until", horizon)
      .order("id")
      .range(from, from + 999);
    if (error) return errorResponse(500, `licenses: ${error.message}`);
    rows.push(...(data as LicenseRow[]));
    if (!data || data.length < 1000) break;
  }

  const due = alertsDueToday(
    rows.map((r) => ({ ...r, validUntil: r.valid_until, alertDays: r.alert_days ?? DEFAULT_ALERT_DAYS, deletedAt: r.deleted_at })),
    today,
  );
  if (due.length === 0) return json({ date: today, alerts: 0 });

  // 2. Claim each alert in the log; only alerts inserted now are sent (no duplicates on re-runs).
  const { data: claimed, error: claimErr } = await admin
    .from("license_alert_log")
    .upsert(
      due.map(({ license, daysLeft }) => ({ license_id: license.id, pilot_id: license.pilot_id, alert_date: today, days_left: daysLeft })),
      { onConflict: "license_id,alert_date", ignoreDuplicates: true },
    )
    .select("license_id");
  if (claimErr) return errorResponse(500, `license_alert_log: ${claimErr.message}`);
  const claimedIds = new Set((claimed ?? []).map((c) => c.license_id as string));

  const byPilot = new Map<string, Alert[]>();
  for (const { license, daysLeft } of due) {
    if (!claimedIds.has(license.id)) continue;
    const list = byPilot.get(license.pilot_id) ?? [];
    list.push({ licenseId: license.id, code: license.code, validUntil: license.valid_until!, daysLeft });
    byPilot.set(license.pilot_id, list);
  }

  // 3. Send, pilot by pilot.
  let emails = 0;
  let pushes = 0;
  const failures: string[] = [];
  for (const [pilotId, alerts] of byPilot) {
    const { data: pilot } = await admin
      .from("pilots")
      .select("email, full_name, locale, deleted_at")
      .eq("id", pilotId)
      .maybeSingle();
    if (!pilot || pilot.deleted_at) continue;
    const locale: Locale = pilot.locale === "en" ? "en" : "fr";

    const mailOk = pilot.email ? await sendEmail(pilot.email as string, locale, alerts) : false;
    if (mailOk) emails++;
    const pushCount = await sendPush(admin, pilotId, locale, alerts);
    pushes += pushCount;

    if (!mailOk && pushCount === 0) {
      // Nothing reached the pilot: release the claim so a manual replay (?date=YYYY-MM-DD) can retry.
      failures.push(pilotId);
      await admin.from("license_alert_log").delete().eq("alert_date", today).in("license_id", alerts.map((a) => a.licenseId));
    }
  }

  return json({ date: today, alerts: claimedIds.size, pilots: byPilot.size, emails, pushes, failures: failures.length });
});

async function sendEmail(to: string, locale: Locale, alerts: Alert[]): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("ALERTS_FROM_EMAIL");
  if (!apiKey || !from) {
    console.warn("license-alerts: RESEND_API_KEY / ALERTS_FROM_EMAIL not set, e-mail skipped");
    return false;
  }
  const lines = alerts.map((a) => licenseAlertText(locale, a.code, a.daysLeft, a.validUntil));
  const subject = alerts.length === 1
    ? lines[0]!.title
    : locale === "en" ? `${alerts.length} documents are about to expire` : `${alerts.length} documents arrivent à échéance`;
  const appUrl = Deno.env.get("APP_URL");
  const cta = appUrl
    ? `<p><a href="${escapeHtml(appUrl)}/licenses">${locale === "en" ? "Open Sillage" : "Ouvrir Sillage"}</a></p>`
    : "";
  const html = `<p>${lines.map((l) => escapeHtml(l.body)).join("<br>")}</p>${cta}`;
  const text = lines.map((l) => l.body).join("\n");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    });
    if (!res.ok) console.error("resend", res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error("resend", e);
    return false;
  }
}

/** Sends one Expo push per alert to every device of the pilot. Returns the number of accepted messages. */
async function sendPush(admin: ReturnType<typeof adminClient>, pilotId: string, locale: Locale, alerts: Alert[]): Promise<number> {
  const { data: tokens } = await admin.from("push_tokens").select("token").eq("pilot_id", pilotId);
  if (!tokens?.length) return 0;

  const messages = tokens.flatMap(({ token }) =>
    alerts.map((a) => {
      const { title, body } = licenseAlertText(locale, a.code, a.daysLeft, a.validUntil);
      return { to: token as string, title, body, sound: "default", data: { type: "license_alert", licenseId: a.licenseId } };
    })
  );

  let accepted = 0;
  const stale: string[] = [];
  for (let i = 0; i < messages.length; i += 100) { // Expo accepts up to 100 messages per request
    const chunk = messages.slice(i, i + 100);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
      const expoToken = Deno.env.get("EXPO_ACCESS_TOKEN"); // only if "enhanced push security" is enabled
      if (expoToken) headers.Authorization = `Bearer ${expoToken}`;
      const res = await fetch("https://exp.host/--/api/v2/push/send", { method: "POST", headers, body: JSON.stringify(chunk) });
      const out = await res.json() as { data?: { status: string; details?: { error?: string } }[] };
      out.data?.forEach((ticket, j) => {
        if (ticket.status === "ok") accepted++;
        else if (ticket.details?.error === "DeviceNotRegistered") stale.push(chunk[j]!.to);
      });
    } catch (e) {
      console.error("expo push", e);
    }
  }
  if (stale.length) await admin.from("push_tokens").delete().in("token", [...new Set(stale)]);
  return accepted;
}
