"use client";

import { Lock, Sparkles } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { accessFor, type Access, type MaxFeature } from "@cielo/core";
import { Link } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import { useCloud } from "./cloud";
import { usePilot } from "./hooks";

import { setWriteAllowed } from "./write-guard";

export function useAccess(): Access {
  const pilot = usePilot();
  const cloud = useCloud();
  const a = accessFor(pilot, { signedIn: !!cloud.session });
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

/** After sign-up from the pricing page: open the Stripe checkout (7-day trial, card required) once. */
export function usePendingCheckout() {
  const cloud = useCloud();
  const pilot = usePilot();
  const locale = useLocale();
  useEffect(() => {
    if (!cloud.session || !pilot || pilot.subscriptionTier !== "free") return;
    let plan: string | null = null;
    try {
      plan = localStorage.getItem("geardown-plan");
      localStorage.removeItem("geardown-plan");
    } catch {}
    if (plan !== "basic" && plan !== "premium") return;
    cloud
      .invoke<{ url: string }>("create-checkout-session", { plan, interval: "monthly", returnPath: `/${locale}/app` })
      .then(({ url }) => window.location.assign(url))
      .catch(() => {});
  }, [cloud, pilot, locale]);
}
