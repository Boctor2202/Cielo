"use client";

import {
  BadgeCheck, BarChart3, UserRound, Briefcase, FileUser, CalendarDays, Gauge, Map as MapIcon, NotebookPen, Plane, Plus, Settings, Timer, Wifi, WifiOff, MoreHorizontal,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import type { StaticPathname as AppPathname } from "@/i18n/routing";
import { AirportsProvider } from "@/lib/airports";
import { CloudProvider, useCloud } from "@/lib/cloud";
import { usePilot } from "@/lib/hooks";
import { Logo } from "../Logo";
import { ThemeToggle } from "../ThemeToggle";
import { LocaleSwitch } from "../LocaleSwitch";
import { MobileTabBar } from "./MobileTabBar";

const NAV: { href: AppPathname; key: string; icon: typeof Gauge }[] = [
  { href: "/app", key: "dashboard", icon: Gauge },
  { href: "/app/carnet", key: "logbook", icon: NotebookPen },
  { href: "/app/roster", key: "roster", icon: CalendarDays },
  { href: "/app/ftl", key: "ftl", icon: Timer },
  { href: "/app/documents", key: "documents", icon: BadgeCheck },
  { href: "/app/statistiques", key: "stats", icon: BarChart3 },
  { href: "/app/carte", key: "map", icon: MapIcon },
  { href: "/app/emplois", key: "jobs", icon: Briefcase },
  { href: "/app/cv", key: "cv", icon: FileUser },
  { href: "/app/appareils", key: "aircraft", icon: Plane },
  { href: "/app/profil", key: "profile", icon: UserRound },
  { href: "/app/parametres", key: "settings", icon: Settings },
];

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const up = () => setOnline(navigator.onLine);
    up();
    window.addEventListener("online", up);
    window.addEventListener("offline", up);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", up);
    };
  }, []);
  return online;
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <CloudProvider>
      <Shell>{children}</Shell>
    </CloudProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const cloud = useCloud();
  const t = useTranslations("app.nav");
  const pathname = usePathname();
  const pilot = usePilot();
  const online = useOnline();
  const [more, setMore] = useState(false);
  const isActive = (href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));
  const status = !online ? t("offline") : cloud.session ? t("synced") : t("localMode");

  return (
    <AirportsProvider>
      <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface lg:flex">
          <div className="flex h-16 items-center px-5">
            <Link href="/" aria-label="Strato">
              <Logo />
            </Link>
          </div>
          <div className="px-3">
            <Link href="/app/carnet/nouveau" className="btn btn-primary w-full">
              <Plus size={18} /> {t("newFlight")}
            </Link>
          </div>
          <nav className="mt-4 flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="App">
            {NAV.map(({ href, key, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[14.5px] font-medium transition-colors ${
                  isActive(href) ? "bg-accent/12 text-accent" : "text-muted hover:bg-surface-2 hover:text-text"
                }`}
              >
                <Icon size={18} /> {t(key)}
              </Link>
            ))}
          </nav>
          <div className="border-t border-border p-3">
            <div className="flex items-center justify-between gap-2 px-2">
              <Link href="/app/profil" className="min-w-0 rounded-md hover:text-accent">
                <p className="truncate text-sm font-semibold">{pilot?.fullName || "—"}</p>
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  {online ? <Wifi size={12} className="text-success" /> : <WifiOff size={12} className="text-caution" />}
                  {status}
                </p>
              </Link>
              <div className="flex">
                <LocaleSwitch />
                <ThemeToggle />
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-bg/90 px-4 backdrop-blur lg:hidden">
            <Link href="/app" aria-label="Strato">
              <Logo />
            </Link>
            <div className="flex items-center gap-1">
              <span className="mr-1 flex items-center gap-1 text-xs text-muted">
                {online ? <Wifi size={12} className="text-success" /> : <WifiOff size={12} className="text-caution" />}
              </span>
              <LocaleSwitch />
              <ThemeToggle />
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:pb-12 lg:pt-8">{children}</main>
        </div>

        {/* Mobile tab bar (liquid-glass pill) */}
        <MobileTabBar moreOpen={more} onToggleMore={() => setMore(!more)} moreActive={NAV.slice(2).some(({ href }) => href !== "/app/roster" && href !== "/app/documents" && isActive(href))} />
        {more && (
          <div className="fixed inset-x-0 bottom-[88px] z-40 mx-3 mb-[env(safe-area-inset-bottom)] grid grid-cols-3 gap-1 rounded-2xl border border-border bg-bg p-2 shadow-2xl lg:hidden" onClick={() => setMore(false)}>
            {NAV.slice(2).filter(({ href }) => href !== "/app/roster" && href !== "/app/documents").map(({ href, key, icon: Icon }) => (
              <Link key={href} href={href} className={`flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-xs font-medium ${isActive(href) ? "bg-accent/12 text-accent" : "text-muted"}`}>
                <Icon size={20} /> {t(key)}
              </Link>
            ))}
          </div>
        )}
      </div>
    </AirportsProvider>
  );
}
