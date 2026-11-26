"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BookCopy, X } from "lucide-react";
import type { Flight, OpeningBalance } from "@cielo/core";
import { Link } from "@/i18n/navigation";
import { localStore } from "@/lib/db";

const KEY = "openingPromptDismissed";

/**
 * "Already have hours?": a new logbook (few flights, no carried-forward totals) is offered to carry the totals
 * of the old logbooks over instead of typing or photographing every page. Hidden for good once dismissed.
 */
export function OpeningPrompt({ flights, balances, className = "" }: { flights: Flight[] | undefined; balances: OpeningBalance[] | undefined; className?: string }) {
  const t = useTranslations("app.openingPrompt");
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    void localStore.getMeta(KEY).then((v) => setDismissed(!!v));
  }, []);
  if (dismissed || !flights || !balances) return null;
  if (balances.some((b) => !b.deletedAt) || flights.length >= 50) return null;
  const hide = () => {
    setDismissed(true);
    void localStore.setMeta(KEY, new Date().toISOString());
  };
  return (
    <div className={`relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-[color:var(--accent)]/35 bg-[color:var(--accent)]/[0.07] p-4 pr-10 sm:flex-row sm:items-center ${className}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color:var(--accent)]/15 text-[color:var(--accent)]"><BookCopy size={20} /></span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{t("title")}</p>
        <p className="mt-0.5 text-sm text-muted">{t("text")}</p>
      </div>
      <Link href="/app/carnet/report" className="btn btn-primary btn-sm shrink-0 self-start sm:self-center">{t("cta")}</Link>
      <button type="button" onClick={hide} aria-label={t("later")} title={t("later")} className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-[color:var(--text)]/10"><X size={15} /></button>
    </div>
  );
}
