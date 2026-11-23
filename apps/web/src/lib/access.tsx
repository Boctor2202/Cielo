"use client";

import { Hourglass, Lock, Sparkles } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { accessFor, noCardTrialDays, type Access, type MaxFeature } from "@cielo/core";
import { Link } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import { useCloud } from "./cloud";
import { usePilot } from "./hooks";

import { setWriteAllowed } from "./write-guard";

export function useAccess(): Access {
  const pilot = usePilot();
  const cloud = useCloud();
  // the trial runs from the account's trial start (server), else its creation, never from this browser's first visit
  const a = accessFor(pilot, { signedIn: !!cloud.session, accountCreatedAt: pilot?.trialStartedAt ?? cloud.session?.user.created_at, noCardTrialDays: noCardTrialDays(process.env.NEXT_PUBLIC_NO_CARD_TRIAL_DAYS) });
  setWriteAllowed(a.canWrite);
  return a;
}

/** Shown instead of a page or a section the pilot's plan does not include. */
export function Paywall({ feature }: { feature?: MaxFeature }) {
  const t = useTranslations("app.access");
  const a = useAccess();
  const needsMax = !!feature && a.plan === "basic";
  return (
    <div className="card mx-auto mt-6 max-w-xl p-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/12 text-accent">
        {needsMax ? <Sparkles size={22} /> : <Lock size={22} />}
      </span>
      <h2 className="mt-4 text-xl font-medium tracking-tight">{needsMax ? t("maxTitle") : t("readOnlyTitle")}</h2>
      <p className="mt-2 text-sm text-muted">{needsMax ? t("maxText") : t("readOnlyText")}</p>
      <Link href="/app/parametres" className="btn btn-primary mt-6">
        {needsMax ? t("upgrade") : t("subscribe")}
      </Link>
    </div>
  );
}

/** Renders children only when the plan includes the feature (Max) and, if `write`, when writing is allowed. */
export function Requires({ feature, write, children }: { feature?: MaxFeature; write?: boolean; children: ReactNode }) {
  const a = useAccess();
  if ((feature && !a.has(feature)) || (write && !a.canWrite)) return <Paywall feature={feature && !a.has(feature) ? feature : undefined} />;
  return <>{children}</>;
}

/** Thin bar at the top of the app: demo days left, or read-only. */
/** Days left of the free trial (or of the demo), at the top of every page: a click opens the plans. */
/** `compact`: only the days left (the narrow sidebar); the full label stays in the tooltip. */
export function TrialPill({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("app.access");
  const a = useAccess();
  if (!(a.trial || a.demo) || !a.daysLeft) return null;
  const n = a.daysLeft;
  const tone = n <= 3 ? "border-[var(--warning)] text-[var(--warning)]" : n <= 7 ? "border-[var(--caution)] text-[var(--caution)]" : "border-accent/60 text-accent";
  return (
    <Link href={a.trial ? "/app/parametres" : "/inscription"} title={t("pillLabel", { days: n })} aria-label={t("pillLabel", { days: n })} className={`num inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11.5px] font-semibold ${tone}`}>
      <Hourglass size={12} aria-hidden /> {compact ? t("pillShort", { days: n }) : t(a.trial ? "pill" : "pillDemo", { days: n })}
    </Link>
  );
}

export function AccessBanner() {
  const t = useTranslations("app.access");
  const a = useAccess();
  if (a.demo && a.daysLeft) {
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-accent/12 px-4 py-2.5 text-sm">
        <span>{t("demo", { days: a.daysLeft })}</span>
        <span className="flex flex-wrap items-center gap-2">
          {/* a subscriber on a new browser or device lands here until they sign in */}
          <Link href="/connexion" className="btn btn-secondary btn-sm">{t("haveAccount")}</Link>
          <Link href="/inscription" className="btn btn-primary btn-sm">{t("startTrial")}</Link>
        </span>
      </div>
    );
  }
  if (a.trial && a.daysLeft) {
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-accent/12 px-4 py-2.5 text-sm">
        <span>{t("trial", { days: a.daysLeft })}</span>
        <Link href="/app/parametres" className="btn btn-secondary btn-sm">{t("subscribe")}</Link>
      </div>
    );
  }
  if (!a.canWrite) {
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--caution)]/15 px-4 py-2.5 text-sm">
        <span>{t("readOnlyBanner")}</span>
        <Link href="/app/parametres" className="btn btn-primary btn-sm">{t("subscribe")}</Link>
      </div>
    );
  }
  return null;
}

/**
 * After sign-up from the pricing page. With the trial without a card (the default), nothing opens: the pilot starts
 * the trial and subscribes later from the settings. Only when that trial is turned off does the checkout open.
 */
export function usePendingCheckout() {
  const cloud = useCloud();
  const pilot = usePilot();
  const locale = useLocale();
  useEffect(() => {
    if (!cloud.session || !pilot || pilot.subscriptionTier !== "free") return;
    if (noCardTrialDays(process.env.NEXT_PUBLIC_NO_CARD_TRIAL_DAYS) > 0) return;
    let plan: string | null = null;
    let interval = "monthly";
    try {
      plan = localStorage.getItem("geardown-plan");
      interval = localStorage.getItem("geardown-interval") === "yearly" ? "yearly" : "monthly";
      localStorage.removeItem("geardown-plan");
      localStorage.removeItem("geardown-interval");
    } catch {}
    if (plan !== "basic" && plan !== "premium") return;
    cloud
      .invoke<{ url: string }>("create-checkout-session", { plan, interval, returnPath: `/${locale}/app` })
      .then(({ url }) => window.location.assign(url))
      .catch(() => {});
  }, [cloud, pilot, locale]);
}
