"use client";

import { Check, Minus } from "lucide-react";
import { useState } from "react";
import { useLocale, useMessages, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SITE } from "@/config/site";

type Plan = "free" | "basic" | "premium";
type Cell = boolean | string;

/** Feature matrix — keep in sync with the entitlements enforced by the app. */
const MATRIX: { row: string; free: Cell; basic: Cell; premium: Cell }[] = [
  { row: "flights", free: "fifty", basic: "unlimited", premium: "unlimited" },
  { row: "night", free: true, basic: true, premium: true },
  { row: "airports", free: true, basic: true, premium: true },
  { row: "csv", free: true, basic: true, premium: true },
  { row: "pdf", free: false, basic: true, premium: true },
  { row: "carry", free: true, basic: true, premium: true },
  { row: "licenses", free: false, basic: true, premium: true },
  { row: "recency", free: true, basic: true, premium: true },
  { row: "sync", free: "oneDevice", basic: true, premium: true },
  { row: "stats", free: false, basic: true, premium: true },
  { row: "roster", free: false, basic: false, premium: true },
  { row: "ftl", free: false, basic: false, premium: true },
  { row: "audit", free: false, basic: false, premium: true },
  { row: "signature", free: false, basic: false, premium: true },
  { row: "scan", free: false, basic: false, premium: true },
  { row: "support", free: false, basic: false, premium: true },
];

export function Pricing({ showCompare = true }: { showCompare?: boolean }) {
  const t = useTranslations("pricing");
  const locale = useLocale();
  const messages = useMessages() as { pricing: { highlights: Record<Plan, string[]> } };
  const [yearly, setYearly] = useState(true);
  const money = (v: number) => new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-IE", { style: "currency", currency: SITE.pricing.currency }).format(v);

  const plans: Plan[] = ["free", "basic", "premium"];
  const priceOf = (p: Plan) => (p === "free" ? null : yearly ? SITE.pricing[p].yearly : SITE.pricing[p].monthly);

  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h2>
        <p className="mt-4 text-lg text-muted">{t("subtitle")}</p>
        <div className="mt-8 inline-flex rounded-lg border border-border bg-surface p-1" role="group">
          {[false, true].map((y) => (
            <button
              key={String(y)}
              type="button"
              aria-pressed={yearly === y}
              onClick={() => setYearly(y)}
              className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${yearly === y ? "bg-bg text-text shadow-sm" : "text-muted"}`}
            >
              {y ? t("yearly") : t("monthly")}
              {y && <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-xs text-accent">{SITE.pricing.yearlyDiscountLabel}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {plans.map((p) => {
          const price = priceOf(p);
          const popular = p === "premium";
          return (
            <div key={p} className={`relative flex flex-col rounded-2xl border p-7 ${popular ? "border-accent bg-surface shadow-[0_0_0_1px_var(--accent)]" : "border-border bg-bg"}`}>
              {popular && <span className="absolute -top-3 left-7 rounded-full bg-accent px-3 py-0.5 text-xs font-bold text-accent-contrast">{t("popular")}</span>}
              <h3 className="text-lg font-bold">{t(`plans.${p}.name`)}</h3>
              <p className="mt-1 min-h-10 text-sm text-muted">{t(`plans.${p}.desc`)}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="num text-4xl font-semibold tracking-tight">{price === null ? t("plans.free.price") : money(price)}</span>
                {price !== null && <span className="text-muted">{yearly ? t("perYear") : t("perMonth")}</span>}
              </div>
              <p className="mt-1 h-5 text-xs text-muted">{price !== null && yearly ? t("billedYearly", { price: money(price / 12) }) : ""}</p>
              <ul className="mt-6 flex-1 space-y-2.5 text-[15px]">
                {messages.pricing.highlights[p].map((h) => (
                  <li key={h} className="flex gap-2.5">
                    <Check size={18} className="mt-0.5 shrink-0 text-accent" />
                    {h}
                  </li>
                ))}
              </ul>
              <Link
                href={{ pathname: "/inscription", query: p === "free" ? {} : { plan: p, interval: yearly ? "year" : "month" } }}
                className={`btn mt-8 w-full ${popular ? "btn-primary" : "btn-secondary"}`}
              >
                {p === "free" ? t("ctaFree") : t("cta")}
              </Link>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-center text-xs text-muted">{t("vat")}</p>

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
