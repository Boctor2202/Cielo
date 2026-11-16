"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";

/** Two-way switch shown on the maps: light map / dark map. */
export function MapThemeToggle({ dark, onChange }: { dark: boolean; onChange: (dark: boolean) => void }) {
  const t = useTranslations("app.mapTheme");
  const btn = (on: boolean) => `flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-semibold transition-colors ${on ? "bg-bg text-text shadow-sm ring-1 ring-border" : "text-muted hover:text-text"}`;
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface p-0.5" role="group" aria-label={t("label")}>
      <button type="button" aria-pressed={!dark} className={btn(!dark)} onClick={() => onChange(false)}><Sun size={14} /> {t("light")}</button>
      <button type="button" aria-pressed={dark} className={btn(dark)} onClick={() => onChange(true)}><Moon size={14} /> {t("dark")}</button>
    </div>
  );
}
