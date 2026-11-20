"use client";

import {
  BadgeCheck, BarChart3, UserRound, Hotel, Briefcase, FileUser, CalendarDays, Gauge, Map as MapIcon, NotebookPen, Plane, Plus, Settings, Timer, Globe2, Wifi, WifiOff, MoreHorizontal, Radar, Lock, ShieldCheck, Bug,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import type { StaticPathname as AppPathname } from "@/i18n/routing";
import { AirportsProvider } from "@/lib/airports";
import { CloudProvider, useCloud } from "@/lib/cloud";
import { usePilot } from "@/lib/hooks";
import { useTrackAutoFetch } from "@/lib/tracks";
import { AccessBanner, useAccess, usePendingCheckout } from "@/lib/access";
import { useFlags, type Flags } from "@/lib/flags";
import { apiFetch, installErrorReporter } from "@/lib/report";
import { ReportDialog } from "./ReportDialog";
import { GainsToast } from "./GainsToast";
import { loadAirlineDirectory } from "@/lib/airlines";
import { backfillOperators } from "@/lib/repo";
import type { MaxFeature } from "@cielo/core";
import { Logo } from "../Logo";
import { ThemeToggle } from "../ThemeToggle";
import { LocaleSwitch } from "../LocaleSwitch";
import { MobileTabBar } from "./MobileTabBar";

const NAV: { href: AppPathname; key: string; icon: typeof Gauge; max?: MaxFeature; flag?: keyof Flags; admin?: boolean }[] = [
  { href: "/app", key: "dashboard", icon: Gauge },
  { href: "/app/carnet", key: "logbook", icon: NotebookPen },
  { href: "/app/roster", key: "roster", icon: CalendarDays , max: "roster" },
  { href: "/app/escales", key: "layovers", icon: Hotel, max: "layovers", flag: "layovers" },
  { href: "/app/ftl", key: "ftl", icon: Timer , max: "ftl" },
  { href: "/app/fuseaux", key: "timezones", icon: Globe2 },
  { href: "/app/documents", key: "documents", icon: BadgeCheck },
  { href: "/app/statistiques", key: "stats", icon: BarChart3 },
  { href: "/app/carte", key: "map", icon: MapIcon },
  { href: "/app/radar", key: "radar", icon: Radar, max: "radar", flag: "radar" },
  { href: "/app/emplois", key: "jobs", icon: Briefcase, max: "jobs", flag: "jobs" },
  { href: "/app/cv", key: "cv", icon: FileUser, max: "cv" },
  { href: "/app/appareils", key: "aircraft", icon: Plane },
  { href: "/app/profil", key: "profile", icon: UserRound },
  { href: "/app/parametres", key: "settings", icon: Settings },
  { href: "/app/admin", key: "admin", icon: ShieldCheck, admin: true },
];

/** True when the signed-in account is an admin (checked by the server). */
function useIsAdmin(signedIn: boolean) {
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    if (!signedIn) return setAdmin(false);
    apiFetch("/api/admin/me")
      .then((r) => setAdmin(r.ok))
      .catch(() => setAdmin(false));
  }, [signedIn]);
  return admin;
}

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
  const access = useAccess();
  const flags = useFlags();
  const isAdmin = useIsAdmin(!!cloud.session);
  const [report, setReport] = useState(false);
  usePendingCheckout();
  useTrackAutoFetch(access.has("tracks") && access.canWrite && flags.flightTracks);
  useEffect(installErrorReporter, []);
  const nav = NAV.filter((i) => (!i.flag || flags[i.flag]) && (!i.admin || isAdmin));
  const pilot = usePilot();
  // once per device: old flights get their recognised operator (after the first sync has brought them)
  useEffect(() => {
    if (!pilot || !access.canWrite) return;
    const id = setTimeout(() => void loadAirlineDirectory().then((d) => backfillOperators(d)).catch(() => undefined), 8000);
    return () => clearTimeout(id);
  }, [pilot?.id, access.canWrite]); // eslint-disable-line react-hooks/exhaustive-deps
  const online = useOnline();
  const [more, setMore] = useState(false);
  const isActive = (href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));
  const status = !online ? t("offline") : cloud.session ? t("synced") : t("localMode");

  return (
    <AirportsProvider>
      <GainsToast />
      <div className="app-skin min-h-dvh lg:grid lg:grid-cols-[256px_1fr]">
        <div className="app-room" aria-hidden="true" />
        <div className="sticky top-0 hidden h-dvh p-3 pr-0 lg:block">
        <aside className="app-glass app-glass-strong flex h-full flex-col rounded-[28px]">
          <div className="flex h-16 items-center px-5">
            <Link href="/" aria-label="Geardown">
              <Logo />
            </Link>
          </div>
          <div className="px-3">
            <Link href="/app/carnet/nouveau" className="btn btn-primary w-full">
              <Plus size={18} /> {t("newFlight")}
            </Link>
          </div>
          <nav className="mt-4 flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="App">
            {nav.map(({ href, key, icon: Icon, max }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[14.5px] font-medium transition-colors ${
                  isActive(href) ? "bg-bg/60 text-accent shadow-[inset_0_1px_0_var(--glass-hi)]" : "text-muted hover:bg-bg/40 hover:text-text"
                }`}
              >
                <Icon size={18} /> <span className="flex-1">{t(key)}</span>
                {max && !access.has(max) && <Lock size={13} className="opacity-60" aria-label="Max" />}
              </Link>
            ))}
          </nav>
          <div className="p-3">
            <button type="button" onClick={() => setReport(true)} className="mb-2 flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-[13px] text-muted hover:bg-bg/40 hover:text-text">
              <Bug size={15} /> {t("report")}
            </button>
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
        </div>

        <div className="min-w-0">
          <header className="app-glass sticky top-0 z-30 flex h-14 items-center justify-between px-4 lg:hidden">
            <Link href="/app" aria-label="Geardown">
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
          <main className="mx-auto max-w-[1340px] px-3 pb-28 pt-3 sm:px-4 lg:pb-3 lg:pt-3">
            {/* the dashboard draws its own glass workspace; every other page sits in the same pane */}
            {pathname === "/app" ? (
              <>
                <AccessBanner />
                {children}
              </>
            ) : (
              <div className="app-glass min-h-[calc(100dvh-1.5rem)] rounded-[28px] px-4 py-6 sm:px-8 sm:py-8">
                <AccessBanner />
                {children}
              </div>
            )}
          </main>
        </div>

        {/* Mobile tab bar (liquid-glass pill) */}
        <MobileTabBar moreOpen={more} onToggleMore={() => setMore(!more)} moreActive={nav.slice(2).some(({ href }) => href !== "/app/roster" && href !== "/app/documents" && isActive(href))} />
        {more && (
          <div className="fixed inset-x-0 bottom-[88px] z-40 mx-3 mb-[env(safe-area-inset-bottom)] grid grid-cols-3 gap-1 app-glass rounded-2xl p-2 lg:hidden" onClick={() => setMore(false)}>
            {nav.slice(2).filter(({ href }) => href !== "/app/roster" && href !== "/app/documents").map(({ href, key, icon: Icon }) => (
              <Link key={href} href={href} className={`flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-xs font-medium ${isActive(href) ? "bg-accent/12 text-accent" : "text-muted"}`}>
                <Icon size={20} /> {t(key)}
              </Link>
            ))}
            <button type="button" onClick={() => setReport(true)} className="flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-xs font-medium text-muted">
              <Bug size={20} /> {t("report")}
            </button>
          </div>
        )}
        <ReportDialog open={report} onClose={() => setReport(false)} />
      </div>
    </AirportsProvider>
  );
}
