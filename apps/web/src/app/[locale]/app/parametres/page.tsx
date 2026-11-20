"use client";

import { CalendarX, CreditCard, Download, ExternalLink, LogOut, RefreshCw, Trash2, Upload } from "lucide-react";
import { AccountCard } from "@/components/app/AccountCard";
import { useSubscriptionStatus } from "@/lib/subscriptionStatus";
import { AirportInput } from "@/components/app/AirportInput";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { REGULATORS, regulatorById, PILOT_FUNCTIONS, studentEligible, type Pilot } from "@cielo/core";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Card, Field, Modal, PageTitle, Segmented, useToast } from "@/components/app/ui";
import { useFlights, usePilot, useTable } from "@/lib/hooks";
import { exportEverything } from "@/lib/exportEverything";
import { useAccess } from "@/lib/access";
import { Link } from "@/i18n/navigation";
import { useAirports } from "@/lib/airports";
import { deleteAllLocal, exportAll, importAll, updatePilot } from "@/lib/repo";
import { downloadBlob } from "@/lib/download";
import { useCloud } from "@/lib/cloud";
import { SITE } from "@/config/site";

/** The Student plan is offered once its column (migration 0026) and its Stripe price exist. */
const STUDENT_PLAN = process.env.NEXT_PUBLIC_STUDENT_PLAN === "1";

export default function SettingsPage() {
  const t = useTranslations("app.settings");
  const tc = useTranslations("common");
  const tfn = useTranslations("app.functions");
  const tfw = useTranslations("app.frameworks");
  const tp = useTranslations("app.plans");
  const tpr = useTranslations("pricing");
  const tn = useTranslations("app.nav");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const pilot = usePilot();
  const access = useAccess();
  const airports = useAirports();
  const cloud = useCloud();
  const { toast, toastNode } = useToast();
  const [interval, setInterval] = useState<"monthly" | "yearly">("yearly");
  const subStatus = useSubscriptionStatus();
  const [v, setV] = useState<Pilot | null>(null);
  const [delOpen, setDelOpen] = useState(false);
  const [word, setWord] = useState("");
  const [exportingAll, setExportingAll] = useState(false);
  const allFlights = useFlights();
  const allBalances = useTable("opening_balances");
  useEffect(() => {
    if (pilot && !v) setV(pilot);
  }, [pilot, v]);
  if (!v) return <p className="text-muted">…</p>;

  const patch = async (p: Partial<Pilot>) => {
    setV({ ...v, ...p });
    await updatePilot(p);
  };

  // a card subscription running: another plan is a change in the Stripe space, never a second subscription
  const stripeActive = !!pilot && pilot.subscriptionSource === "stripe" && !!pilot.subscriptionTier && pilot.subscriptionTier !== "free" && (!pilot.subscriptionExpiresAt || pilot.subscriptionExpiresAt > new Date().toISOString());
  /** The Stripe customer portal: change plan, update the card, invoices, cancel. */
  async function manage() {
    try {
      const { url } = await cloud.invoke<{ url: string }>("create-portal-session", { returnPath: `/${locale}/app/parametres` });
      window.location.href = url;
    } catch (e) {
      // the function answers 404 when the pilot has no card subscription (App Store, Google Play or none)
      const status = (e as { context?: { status?: number } })?.context?.status;
      toast(status === 404 ? t("manageNone") : t("manageUnavailable"));
    }
  }

  async function checkout(plan: "basic" | "premium" | "student", interval: "monthly" | "yearly" = "monthly") {
    try {
      const { url } = await cloud.invoke<{ url: string }>("create-checkout-session", { plan, interval, returnPath: `/${locale}/app/parametres` });
      window.location.assign(url);
    } catch (e) {
      // payments not open yet (Stripe not configured) or temporarily unreachable
      console.warn("checkout", e);
      toast(t("checkoutUnavailable"));
    }
  }

  return (
    <>
      <PageTitle title={t("title")} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={t("profile")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("fullName")}><input className="input" value={v.fullName} onChange={(e) => setV({ ...v, fullName: e.target.value })} onBlur={() => patch({ fullName: v.fullName })} /></Field>
            <Field label={t("email")}><input className="input" type="email" value={cloud.session?.user.email ?? v.email} disabled={!!cloud.session} onChange={(e) => setV({ ...v, email: e.target.value })} onBlur={() => patch({ email: v.email })} /></Field>
            <Field label={t("licenceNumber")}><input className="input num" value={v.licenceNumber ?? ""} onChange={(e) => setV({ ...v, licenceNumber: e.target.value })} onBlur={() => patch({ licenceNumber: v.licenceNumber })} /></Field>
            <AirportInput
              label={t("homeBase")}
              value={v.homeBaseIcao ?? ""}
              onChange={(x) => {
                setV({ ...v, homeBaseIcao: x });
                // saved once it is a known aerodrome (picked from the list or typed in full), or cleared
                if (!x || airports?.get(x)?.icao === x) patch({ homeBaseIcao: x || undefined });
              }}
            />
          </div>
        </Card>

        <Card title={t("preferences")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("authority")} hint={regulatorById(v.authority)?.basis ?? tfw(v.regulatoryFramework)}>
              {/* the authority sets the rule family (logbook layout, recency rules) the app applies */}
              <select
                className="input"
                value={v.authority ?? v.regulatoryFramework}
                onChange={(e) => {
                  const r = regulatorById(e.target.value);
                  if (r) void patch({ authority: r.id, regulatoryFramework: r.framework });
                }}
              >
                {(["europe", "americas", "mena", "apac"] as const).map((g) => (
                  <optgroup key={g} label={t(`regions.${g}`)}>
                    {REGULATORS.filter((r) => r.region === g).map((r) => (
                      <option key={r.id} value={r.id}>{`${r.short} · ${r.name}`}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>
            <Field label={t("defaultFunction")}>
              <select className="input" value={v.defaultFunction} onChange={(e) => patch({ defaultFunction: e.target.value as Pilot["defaultFunction"] })}>
                {PILOT_FUNCTIONS.map((f) => <option key={f} value={f}>{tfn(f)}</option>)}
              </select>
            </Field>
            <Field label={t("defaultIfr")}>
              <select className="input" value={v.defaultIfr} onChange={(e) => patch({ defaultIfr: e.target.value as Pilot["defaultIfr"] })}>
                {(["ask", "always", "never"] as const).map((o) => <option key={o} value={o}>{t(`ifrOptions.${o}`)}</option>)}
              </select>
            </Field>
            <Field label={t("pilotFlying")}>
              <select className="input" value={v.defaultPilotFlying} onChange={(e) => patch({ defaultPilotFlying: e.target.value as Pilot["defaultPilotFlying"] })}>
                {(["always", "alternate", "never"] as const).map((o) => <option key={o} value={o}>{t(`pfOptions.${o}`)}</option>)}
              </select>
            </Field>
            <Field label={t("timeDisplay")}>
              <Segmented value={v.timeDisplay} onChange={(x) => patch({ timeDisplay: x })} options={[{ value: "hhmm", label: t("hhmm") }, { value: "decimal", label: t("decimal") }]} />
            </Field>
            <Field label={t("language")}>
              <Segmented
                value={locale}
                onChange={(l) => {
                  patch({ locale: l as Pilot["locale"] });
                  router.replace(pathname as "/app/parametres", { locale: l });
                }}
                options={[{ value: "fr", label: "Français" }, { value: "en", label: "English" }]}
              />
            </Field>
          </div>
        </Card>

        <AccountCard />

        <Card title={t("subscription")}>
          {/* the plan actually granted now (server tier once signed in, demo or nothing otherwise) */}
          <p className="text-sm">
            {t("currentPlan", { plan: access.demo ? t("demoPlan", { days: access.daysLeft ?? 0 }) : access.trial ? t("trialPlan", { days: access.daysLeft ?? 0 }) : access.plan ? tp(access.plan) : tp("free") })}
            {!access.demo && access.plan && v.subscriptionExpiresAt && <span className="text-muted"> · {t("until", { date: new Date(v.subscriptionExpiresAt).toLocaleDateString(locale) })}</span>}
          </p>
          {!cloud.enabled ? (
            <p className="mt-3 text-sm text-muted">{t("cloudOff")}</p>
          ) : !cloud.session ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-muted">{t("signedOut")}</p>
              <Link href="/connexion" className="btn btn-primary btn-sm">{tn("signIn")}</Link>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {/* an active subscription: change plan, card or cancel where it was taken */}
              {subStatus?.cancelled && subStatus.endsAt && (
                <div className="flex items-start gap-2.5 rounded-xl border border-caution/40 bg-caution/10 p-3 text-sm">
                  <CalendarX size={16} className="mt-0.5 shrink-0 text-caution" />
                  <span>
                    <span className="block font-semibold">{t("cancelledTitle", { date: new Date(subStatus.endsAt).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }) })}</span>
                    <span className="block text-muted">{t("cancelledHint")}</span>
                  </span>
                </div>
              )}
              {v.subscriptionTier && v.subscriptionTier !== "free" && v.subscriptionSource ? (
                <div className="rounded-xl border border-border bg-surface-2/50 p-3">
                  {v.subscriptionSource === "stripe" ? (
                    <>
                      <p className="text-sm">{t("manageStripe")}</p>
                      <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={() => void manage()}>
                        <CreditCard size={14} /> {t("manageButton")}
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm">{v.subscriptionSource === "apple" ? t("manageApple") : t("manageGoogle")}</p>
                      <a
                        className="btn btn-secondary btn-sm mt-2"
                        href={v.subscriptionSource === "apple" ? "https://apps.apple.com/account/subscriptions" : "https://play.google.com/store/account/subscriptions"}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink size={14} /> {t("manageStore")}
                      </a>
                    </>
                  )}
                </div>
              ) : null}
              <p className="text-xs text-muted">{tpr("trialNote")}</p>
              <Segmented
                value={interval}
                onChange={(x) => setInterval(x)}
                options={[
                  { value: "monthly", label: tpr("monthly") },
                  { value: "yearly", label: `${tpr("yearly")} · ${tpr("twoMonthsFree")}` },
                ]}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                {(["basic", "premium"] as const).map((p) => (
                  <button key={p} type="button" className={`btn ${p === "premium" ? "btn-primary" : "btn-secondary"}`} disabled={v.subscriptionTier === p} onClick={() => (stripeActive ? void manage() : checkout(p, interval))}>
                    {tp(p)} · {(SITE.pricing[p][interval] ?? SITE.pricing[p].yearly).toLocaleString(locale, { minimumFractionDigits: 2 })} €{interval === "yearly" || !SITE.pricing[p].monthly ? tpr("perYear") : tpr("perMonth")}
                  </button>
                ))}
              </div>
              {STUDENT_PLAN && (
                <div className="rounded-xl border border-border p-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={!!v.studentUntil} onChange={(e) => {
                      const studentUntil = e.target.checked ? new Date(Date.now() + 365 * 86400_000).toISOString().slice(0, 10) : null;
                      setV({ ...v, studentUntil });
                      void patch({ studentUntil });
                    }} />
                    {t("studentDeclare")}
                  </label>
                  {v.studentUntil && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-muted">{t("studentUntil")}</span>
                      <input type="date" className="input num !w-auto" value={v.studentUntil} onChange={(e) => {
                        setV({ ...v, studentUntil: e.target.value });
                        void patch({ studentUntil: e.target.value });
                      }} />
                      <button type="button" className="btn btn-secondary btn-sm" disabled={!studentEligible(v.studentUntil) || stripeActive} onClick={() => checkout("student", "yearly")}>
                        {tpr("plans.student.name")} · {SITE.pricing.student.yearly.toLocaleString(locale, { minimumFractionDigits: 2 })} €{tpr("perYear")}
                      </button>
                    </div>
                  )}
                  <p className="mt-2 text-xs text-muted">{t("studentHint")}</p>
                </div>
              )}
            </div>
          )}
        </Card>

        <Card title={t("storage")}>
          <p className="text-sm text-muted">{cloud.session ? t("storageCloud", { email: cloud.session.user.email ?? "" }) : cloud.enabled ? t("storageSignedOut") : t("storageLocal")}</p>
          {cloud.session && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn btn-secondary btn-sm" onClick={cloud.syncNow} disabled={cloud.syncing}><RefreshCw size={14} className={cloud.syncing ? "animate-spin" : ""} /> {t("syncNow")}</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={cloud.signOut}><LogOut size={14} /> {tn("signOut")}</button>
              {cloud.lastSync && <p className="w-full text-xs text-muted">{cloud.lastSync.finishedAt.slice(0, 16).replace("T", " ")} UTC {cloud.lastSync.ok ? "✓" : `· ${cloud.lastSync.errors.length} erreur(s)`}</p>}
            </div>
          )}
        </Card>

        <Card title={t("data")} className="lg:col-span-2">
          <p className="mb-3 text-sm text-muted">{t("exportEverythingHint")}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" disabled={exportingAll} onClick={async () => {
              setExportingAll(true);
              try {
                await exportEverything(allFlights ?? [], allBalances ?? [], v ?? undefined);
              } finally {
                setExportingAll(false);
              }
            }}>
              <Download size={16} /> {t("exportEverything")}
            </button>
            <button type="button" className="btn btn-secondary" onClick={async () => downloadBlob(JSON.stringify(await exportAll(), null, 2), `geardown-export-${new Date().toISOString().slice(0, 10)}.json`, "application/json")}>
              <Download size={16} /> {t("exportJson")}
            </button>
            <label className="btn btn-secondary">
              <Upload size={16} /> {t("importJson")}
              <input type="file" accept="application/json,.json" className="sr-only" onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  await importAll(JSON.parse(await f.text()));
                  toast(t("restored"));
                } catch (err) {
                  toast(String((err as Error).message));
                }
              }} />
            </label>
            <button type="button" className="btn btn-danger" onClick={() => setDelOpen(true)}><Trash2 size={16} /> {t("deleteAll")}</button>
          </div>
        </Card>
      </div>

      <Modal open={delOpen} onClose={() => setDelOpen(false)} title={t("deleteAll")}>
        <p className="text-sm">{t("deleteConfirm")}</p>
        <input className="input mt-4" value={word} onChange={(e) => setWord(e.target.value)} placeholder={t("deleteWord")} />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => setDelOpen(false)}>{tc("cancel")}</button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={word.trim().toUpperCase() !== t("deleteWord")}
            onClick={async () => {
              if (cloud.session) {
                await cloud.invoke("gdpr-delete", { confirm: "DELETE" });
                await cloud.signOut();
              }
              await deleteAllLocal();
              window.location.assign(`/${locale}`);
            }}
          >
            {tc("delete")}
          </button>
        </div>
      </Modal>
      {toastNode}
    </>
  );
}
