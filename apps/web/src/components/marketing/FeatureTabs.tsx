"use client";

import { BadgeCheck, Briefcase, CalendarClock, Check, CloudOff, FileDown, FileUser, Map, PenLine, ScanSearch, Upload } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { useMessages, useTranslations } from "next-intl";
import { BrowserFrame, Shot } from "./Shot";

export const FEATURE_KEYS = ["logbook", "import", "audit", "licenses", "ftl", "stats", "signature", "offline", "jobs", "cv"] as const;
const ICONS = { logbook: FileDown, import: Upload, audit: ScanSearch, licenses: BadgeCheck, ftl: CalendarClock, stats: Map, signature: PenLine, offline: CloudOff, jobs: Briefcase, cv: FileUser };

/** Accessible tabs (WAI-ARIA pattern: arrow keys, Home/End): one screenshot per feature. */
export function FeatureTabs() {
  const t = useTranslations("features");
  const ts = useTranslations("showcase");
  const m = useMessages() as { features: { items: Record<string, { points: string[] }> } };
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const key = FEATURE_KEYS[active]!;

  const onKey = (e: KeyboardEvent) => {
    const n = FEATURE_KEYS.length;
    let next = active;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (active + 1) % n;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (active - 1 + n) % n;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    else return;
    e.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,340px)_1fr] lg:gap-12">
      <div role="tablist" aria-orientation="vertical" aria-label={ts("label")} onKeyDown={onKey} className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
        {FEATURE_KEYS.map((k, i) => {
          const Icon = ICONS[k];
          const selected = i === active;
          return (
            <button
              key={k}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              role="tab"
              id={`tab-${k}`}
              aria-selected={selected}
              aria-controls={`panel-${k}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(i)}
              className={`group flex min-h-11 shrink-0 cursor-pointer snap-start items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors duration-200 lg:w-full ${
                selected ? "border-accent bg-accent/10" : "border-border hover:border-accent/50 hover:bg-surface"
              }`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${selected ? "bg-accent text-accent-contrast" : "bg-surface-2 text-muted group-hover:text-accent"}`}>
                <Icon size={18} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="num block text-[11px] text-muted">{String(i + 1).padStart(2, "0")}</span>
                <span className={`block whitespace-nowrap text-[15px] font-semibold lg:whitespace-normal ${selected ? "text-text" : "text-text/85"}`}>{t(`items.${k}.title`)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`panel-${key}`} aria-labelledby={`tab-${key}`} tabIndex={0} className="min-w-0 focus-visible:outline-offset-8">
        <div className="hud-frame">
          <BrowserFrame>
            {/* reserve space: screenshots are 1280×800 (CLS) */}
            <div className="aspect-[16/10] bg-surface">
              <Shot key={key} name={key} alt={t(`items.${key}.title`)} className="h-full w-full object-cover object-top" />
            </div>
          </BrowserFrame>
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-[1.1fr_1fr]">
          <div>
            <h3 className="text-xl font-semibold tracking-tight">{t(`items.${key}.title`)}</h3>
            <p className="mt-2 leading-relaxed text-muted">{t(`items.${key}.text`)}</p>
          </div>
          <ul className="space-y-2.5">
            {(m.features.items[key]?.points ?? []).map((p) => (
              <li key={p} className="flex gap-2.5 text-[15px]">
                <Check size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
