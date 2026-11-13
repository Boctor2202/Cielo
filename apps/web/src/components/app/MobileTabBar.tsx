"use client";

import { BadgeCheck, CalendarDays, Gauge, LayoutGrid, Plane, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import type { StaticPathname } from "@/i18n/routing";
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

const ROUTES: StaticPathname[] = ["/app", "/app/carnet", "/app/roster", "/app/documents"];

/**
 * Mobile bottom navigation: liquid-glass pill (4 sections + "More") and the "new flight" action beside it.
 * "More" opens the secondary sections sheet rendered by AppShell.
 */
export function MobileTabBar({ moreOpen, onToggleMore, moreActive }: { moreOpen: boolean; onToggleMore: () => void; moreActive: boolean }) {
  const t = useTranslations("app.nav");
  const pathname = usePathname();
  const router = useRouter();
  const tone = useDocumentTheme();

  const routeIndex = ROUTES.findIndex((r) => (r === "/app" ? pathname === "/app" : pathname.startsWith(r)));
  const active = moreOpen || moreActive || routeIndex === -1 ? 4 : routeIndex;

  const items: LiquidNavItem[] = [
    { label: t("dashboard"), icon: <Gauge {...ico} />, fx: "glow" },
    { label: t("logbook"), icon: <Plane {...ico} />, fx: "plane" },
    { label: t("roster"), icon: <CalendarDays {...ico} />, fx: "pop" },
    { label: t("documents"), icon: <BadgeCheck {...ico} />, fx: "spin" },
    { label: "Plus", icon: <LayoutGrid {...ico} />, fx: "wave" },
  ];

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-center gap-2.5 px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2 lg:hidden">
      <div
        // "More" toggles the sheet on every tap, including when it is already the active item
        onClick={(e) => {
          const item = (e.target as HTMLElement).closest(".nimbus-item");
          if (item && item.parentElement && Array.prototype.indexOf.call(item.parentElement.querySelectorAll(".nimbus-item"), item) === 4) onToggleMore();
        }}
      >
        <LiquidNavbar
          items={items}
          active={active}
          tone={tone}
          compact
          style={{ fontFamily: "var(--font-sans)" }}
          onChange={(i) => {
            if (i < 4) {
              if (moreOpen) onToggleMore();
              router.push(ROUTES[i]!);
            }
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
