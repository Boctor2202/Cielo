"use client";

import { Check, Minus } from "lucide-react";
import { useState } from "react";
import { useLocale, useMessages, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SITE } from "@/config/site";

type Plan = "basic" | "premium";
type Cell = boolean | string;

/** Feature matrix — keep in sync with MAX_FEATURES in @cielo/core (the entitlements enforced by the app). */
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
  { row: "roster", basic: false, premium: true },
  { row: "ftl", basic: false, premium: true },
  { row: "layovers", basic: false, premium: true },
  { row: "radar", basic: false, premium: true },
  { row: "audit", basic: false, premium: true },
  { row: "signature", basic: false, premium: true },
  { row: "scan", basic: false, premium: true },
  { row: "jobs", basic: false, premium: true },
];

export function Pricing({ showCompare = true }: { showCompare?: boolean }) {
  const t = useTranslations("pricing");
  const locale = useLocale();
  const messages = useMessages() as { pricing: { highlights: Record<Plan, string[]> } };
  const money = (v: number) => new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-IE", { style: "currency", currency: SITE.pricing.currency }).format(v);
  const plans: Plan[] = ["basic", "premium"];
  const [yearly, setYearly] = useState(true);

  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h2>
        <p className="mt-4 text-lg text-muted">{t("subtitle")}</p>
        {/* monthly or yearly: the year is ten months paid */}
        <div className="mt-8 inline-flex rounded-full border border-border bg-surface p-1" role="group">
          {([false, true] as const).map((y) => (
            <button
              key={String(y)}
              type="button"
              aria-pressed={yearly === y}
              onClick={() => setYearly(y)}
              className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition ${yearly === y ? "bg-accent text-accent-contrast" : "text-muted hover:text-text"}`}
            >
              {y ? t("yearly") : t("monthly")}
              {y && <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${yearly ? "bg-white/25" : "bg-accent/15 text-accent"}`}>{t("twoMonthsFree")}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
        {plans.map((p) => {
          const price = yearly ? SITE.pricing[p].yearly : SITE.pricing[p].monthly;
          const full = SITE.pricing[p].monthly * 12;
          const popular = p === "premium";
          return (
            <div key={p} className={`relative flex flex-col rounded-2xl border p-7 ${popular ? "border-accent bg-surface shadow-[0_0_0_1px_var(--accent)]" : "border-border bg-bg"}`}>
              {popular && <span className="absolute -top-3 left-7 rounded-full bg-accent px-3 py-0.5 text-xs font-bold text-accent-contrast">{t("popular")}</span>}
              <h3 className="text-lg font-bold">{t(`plans.${p}.name`)}</h3>
              <p className="mt-1 min-h-10 text-sm text-muted">{t(`plans.${p}.desc`)}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="num text-4xl font-semibold tracking-tight">{money(price)}</span>
                <span className="text-muted">{yearly ? t("perYear") : t("perMonth")}</span>
              </div>
              {yearly ? (
                <p className="mt-1 text-sm text-muted">
                  <span className="num line-through">{money(full)}</span> · <span className="num font-semibold text-accent">{t("perMonthEquiv", { price: money(Math.floor((price / 12) * 100) / 100) })}</span>
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted">{t("orYearly", { price: money(SITE.pricing[p].yearly) })}</p>
              )}
              <ul className="mt-6 flex-1 space-y-2.5 text-[15px]">
                {messages.pricing.highlights[p].map((h) => (
                  <li key={h} className="flex gap-2.5">
                    <Check size={18} className="mt-0.5 shrink-0 text-accent" />
                    {h}
                  </li>
                ))}
              </ul>
              <Link
                href={{ pathname: "/inscription", query: { plan: p, interval: yearly ? "yearly" : "monthly" } }}
                className={`btn mt-8 w-full ${popular ? "btn-primary" : "btn-secondary"}`}
              >
                {t("cta")}
              </Link>
            </div>
          );
        })}
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
                  {plans.map((p) => (
                    <th key={p} className={`px-4 py-3 text-center font-semibold ${p === "premium" ? "text-accent" : ""}`}>
                      {t(`plans.${p}.name`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {MATRIX.map((r) => (
                  <tr key={r.row} className="hover:bg-surface/60">
                    <td className="px-4 py-3">{t(`rows.${r.row}`)}</td>
                    {plans.map((p) => {
                      const v = r[p];
                      return (
                        <td key={p} className="px-4 py-3 text-center">
                          {v === true ? (
                            <Check size={18} className="mx-auto text-accent" aria-label="✓" />
                          ) : v === false ? (
                            <Minus size={16} className="mx-auto text-muted/50" aria-label="—" />
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
