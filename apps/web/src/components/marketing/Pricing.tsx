"use client";

import { Check, Minus } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocale, useMessages, useTranslations } from "next-intl";
import { FOUNDER_SEATS, REFUND_DAYS, yearlySaving } from "@cielo/core";
import { Link } from "@/i18n/navigation";
import { SITE } from "@/config/site";

type Plan = "student" | "basic" | "premium";
type Cell = boolean | string;

/** Feature matrix — keep in sync with MAX_FEATURES in @cielo/core (the entitlements enforced by the app). Student = Basic. */
const MATRIX: { row: string; basic: Cell; premium: Cell }[] = [
  { row: "flights", basic: "unlimited", premium: "unlimited" },
  { row: "night", basic: true, premium: true },
  { row: "airports", basic: true, premium: true },
  { row: "csv", basic: true, premium: true },
  { row: "pdf", basic: true, premium: true },
  { row: "carry", basic: true, premium: true },
  { row: "licenses", basic: true, premium: true },
  { row: "recency", basic: true, premium: true },
  { row: "sync", basic: true, premium: true },
  { row: "stats", basic: true, premium: true },
  { row: "signature", basic: true, premium: true },
  { row: "roster", basic: false, premium: true },
  { row: "ftl", basic: false, premium: true },
  { row: "layovers", basic: false, premium: true },
  { row: "radar", basic: false, premium: true },
  { row: "audit", basic: false, premium: true },
  { row: "scan", basic: false, premium: true },
  { row: "jobs", basic: false, premium: true },
];

/** Seats left at the founder price, from the real subscriber count (null: not shown). */
function useFounderSeats() {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/founder-seats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { left: number | null } | null) => setLeft(d?.left ?? null))
      .catch(() => setLeft(null));
  }, []);
  return left;
}

export function Pricing({ showCompare = true }: { showCompare?: boolean }) {
  const t = useTranslations("pricing");
  const locale = useLocale();
  const messages = useMessages() as { pricing: { highlights: Record<Plan, string[]> } };
  const money = (v: number) => new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-IE", { style: "currency", currency: SITE.pricing.currency }).format(v);
  const plans: Plan[] = ["student", "basic", "premium"];
  const seats = useFounderSeats();
  const [yearly, setYearly] = useState(true);

  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h2>
        <p className="mt-4 text-lg text-muted">{t("subtitle")}</p>
        {/* yearly or monthly: every plan shows its price for the chosen period, and the other one beneath */}
        <div className="mt-8 inline-flex rounded-full border border-border bg-surface p-1" role="group">
          {([true, false] as const).map((y) => (
            <button
              key={String(y)}
              type="button"
              aria-pressed={yearly === y}
              onClick={() => setYearly(y)}
              className={`rounded-full px-5 py-1.5 text-sm font-semibold transition ${yearly === y ? "bg-accent text-accent-contrast" : "text-muted hover:text-text"}`}
            >
              {y ? t("yearly") : t("monthly")}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-12 grid max-w-5xl gap-5 md:grid-cols-3">
        {plans.map((p) => {
          const { monthly } = SITE.pricing[p];
          const saving = yearlySaving(monthly, SITE.pricing[p].yearly);
          const popular = p === "premium";
          return (
            <div key={p} className={`relative flex flex-col rounded-2xl border p-7 ${popular ? "border-accent bg-surface shadow-[0_0_0_1px_var(--accent)]" : "border-border bg-bg"}`}>
              {popular && <span className="absolute -top-3 left-7 rounded-full bg-accent px-3 py-0.5 text-xs font-bold text-accent-contrast">{t("popular")}</span>}
              <h3 className="text-lg font-bold">{t(`plans.${p}.name`)}</h3>
              <p className="mt-1 min-h-10 text-sm text-muted">{t(`plans.${p}.desc`)}</p>
              {/* the price of the chosen period, then the other one and what paying yearly really saves */}
              {yearly || !monthly ? (
                <>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="num text-4xl font-semibold tracking-tight">{money(SITE.pricing[p].yearly)}</span>
                    <span className="text-muted">{t("perYear")}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{t("billedOncePerYear")}</p>
                  {monthly ? (
                    <p className="mt-2 text-sm">
                      {t("orMonthly", { price: money(monthly) })}
                      {saving > 0 && <span className="mt-0.5 block font-semibold text-accent">{t("saving", { pct: saving, full: money(monthly * 12), yearly: money(SITE.pricing[p].yearly) })}</span>}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-muted">{t("yearlyOnly")}</p>
                  )}
                </>
              ) : (
                <>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="num text-4xl font-semibold tracking-tight">{money(monthly)}</span>
                    <span className="text-muted">{t("perMonth")}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{t("billedMonthly")}</p>
                  <p className="mt-2 text-sm">
                    {t("orYearly", { price: money(SITE.pricing[p].yearly) })}
                    {saving > 0 && <span className="mt-0.5 block font-semibold text-accent">{t("saving", { pct: saving, full: money(monthly * 12), yearly: money(SITE.pricing[p].yearly) })}</span>}
                  </p>
                </>
              )}
              <ul className="mt-6 flex-1 space-y-2.5 text-[15px]">
                {messages.pricing.highlights[p].map((h) => (
                  <li key={h} className="flex gap-2.5">
                    <Check size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                    {h}
                  </li>
                ))}
              </ul>
              <Link href={{ pathname: "/inscription", query: { plan: p, interval: yearly || !monthly ? "yearly" : "monthly" } }} className={`btn mt-8 w-full ${popular ? "btn-primary" : "btn-secondary"}`}>
                {t("cta")}
              </Link>
            </div>
          );
        })}
      </div>

      <div className="mx-auto mt-8 grid max-w-5xl gap-3 text-sm sm:grid-cols-2">
        <p className="rounded-xl border border-border bg-surface px-4 py-3">
          <strong>{t("founderTitle")}</strong> {seats !== null ? t("founderSeats", { seats: FOUNDER_SEATS, left: seats }) : t("founder", { seats: FOUNDER_SEATS })}
        </p>
        <p className="rounded-xl border border-border bg-surface px-4 py-3">
          <strong>{t("refundTitle", { days: REFUND_DAYS })}</strong> {t("refund", { days: REFUND_DAYS })}
        </p>
      </div>
      <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-muted">{t("trialNote")}</p>
      <p className="mt-2 text-center text-xs text-muted">{t("vat")}</p>

      {showCompare && (
        <div className="mt-20">
          <h3 className="text-center text-2xl font-bold tracking-tight">{t("compareTitle")}</h3>
          <div className="mt-8 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-surface">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">{t("feature")}</th>
                  <th className="px-4 py-3 text-center font-semibold">{t("basicAndStudent")}</th>
                  <th className="px-4 py-3 text-center font-semibold text-accent">{t("plans.premium.name")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {MATRIX.map((r) => (
                  <tr key={r.row} className="hover:bg-surface/60">
                    <td className="px-4 py-3">{t(`rows.${r.row}`)}</td>
                    {(["basic", "premium"] as const).map((p) => {
                      const v = r[p];
                      return (
                        <td key={p} className="px-4 py-3 text-center">
                          {v === true ? (
                            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent" aria-label={t("included")}>
                              <Check size={16} aria-hidden /> {t("included")}
                            </span>
                          ) : v === false ? (
                            <span className="inline-flex items-center gap-1.5 text-[13px] text-muted" aria-label={t("notIncluded")}>
                              <Minus size={14} aria-hidden /> {t("notIncluded")}
                            </span>
                          ) : (
                            <span className="text-[13px] font-medium">{t(`values.${v}`)}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
