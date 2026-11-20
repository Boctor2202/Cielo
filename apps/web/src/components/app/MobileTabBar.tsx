"use client";

import { Briefcase, CalendarDays, Gauge, LayoutGrid, Plane, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { LiquidNavbar, type LiquidNavItem } from "@/components/ui/liquid-glass-navbar";

const ico = { size: 18, strokeWidth: 1.8, "aria-hidden": true } as const;

/** Follows the app theme (data-theme on <html>) so the water matches light/dark. */
function useDocumentTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const read = () => setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  return theme;
}

type Tab = "home" | "logbook" | "activity" | "career" | "more";
const TABS: Tab[] = ["home", "logbook", "activity", "career", "more"];

/**
 * Mobile bottom navigation: liquid-glass pill (Home, Logbook, Activity, Career, More) and the "new flight" action
 * beside it. Home and Logbook open their page; Activity, Career and More open the sheet of their sections (AppShell).
 */
export function MobileTabBar({ active, onSheet, onClose }: { active: string; onSheet: (g: "activity" | "career" | "more") => void; onClose: () => void }) {
  const t = useTranslations("app.nav");
  const router = useRouter();
  const tone = useDocumentTheme();
  const index = Math.max(0, TABS.indexOf(active as Tab));
  const handled = useRef(0);

  const items: LiquidNavItem[] = [
    { label: t("home"), icon: <Gauge {...ico} />, fx: "glow" },
    { label: t("groups.logbook"), icon: <Plane {...ico} />, fx: "plane" },
    { label: t("groups.activity"), icon: <CalendarDays {...ico} />, fx: "pop" },
    { label: t("groups.career"), icon: <Briefcase {...ico} />, fx: "spin" },
    { label: t("more"), icon: <LayoutGrid {...ico} />, fx: "wave" },
  ];
  const open = (i: number) => {
    const tab = TABS[i]!;
    if (tab === "home" || tab === "logbook") {
      onClose();
      router.push(tab === "home" ? "/app" : "/app/carnet");
    } else onSheet(tab);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-center gap-2.5 px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2 lg:hidden">
      <div
        // a tap on the tab already active (the navbar does not report it) toggles its sheet; any other tap goes
        // through onChange only, so a tap is never handled twice (that opened and closed the sheet at once)
        onClick={(e) => {
          if (Date.now() - handled.current < 400) return;
          const item = (e.target as HTMLElement).closest(".nimbus-item");
          if (!item || !item.parentElement) return;
          const i = Array.prototype.indexOf.call(item.parentElement.querySelectorAll(".nimbus-item"), item);
          if (i >= 2 && i === index) open(i);
        }}
      >
        <LiquidNavbar
          items={items}
          active={index}
          tone={tone}
          compact
          style={{ fontFamily: "var(--font-sans)" }}
          onChange={(i) => {
            handled.current = Date.now();
            open(i);
          }}
        />
      </div>
      <Link
        href="/app/carnet/nouveau"
        aria-label={t("newFlight")}
        className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-full bg-accent text-accent-contrast shadow-[0_12px_28px_-10px_var(--accent)] transition-transform active:scale-95"
      >
        <Plus size={24} aria-hidden />
      </Link>
    </div>
  );
}
