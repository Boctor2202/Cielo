"use client";

import {
  BadgeCheck, BarChart3, FileDown, ScanSearch, Upload, UserRound, Hotel, Briefcase, FileUser, CalendarDays, Gauge, Map as MapIcon, NotebookPen, Plane, Plus, Settings, Timer, Globe2, Wifi, WifiOff, Radar, Lock, ShieldCheck, Bug,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import type { StaticPathname as AppPathname } from "@/i18n/routing";
import { AirportsProvider } from "@/lib/airports";
import { CloudProvider, useCloud } from "@/lib/cloud";
import { usePilot } from "@/lib/hooks";
import { isDemoAccount } from "@cielo/core";
import { DEMO_META, localStore } from "@/lib/db";
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

export type NavGroup = "home" | "logbook" | "activity" | "career" | "account" | "admin";
/**
 * The app's sections, in groups: Home; Logbook (flights, import, export, audit, aircraft); Activity (roster, FTL,
 * layovers, time zones, radar, map); Career (experience, jobs, CV); Account (licences, profile, settings).
 */
export const NAV: { href: AppPathname; key: string; icon: typeof Gauge; group: NavGroup; max?: MaxFeature; flag?: keyof Flags; admin?: boolean }[] = [
  { href: "/app", key: "home", icon: Gauge, group: "home" },
  { href: "/app/carnet", key: "flights", icon: NotebookPen, group: "logbook" },
  { href: "/app/carnet/import", key: "import", icon: Upload, group: "logbook" },
  { href: "/app/carnet/export", key: "export", icon: FileDown, group: "logbook" },
  { href: "/app/carnet/audit", key: "audit", icon: ScanSearch, group: "logbook", max: "audit" },
  { href: "/app/appareils", key: "aircraft", icon: Plane, group: "logbook" },
  { href: "/app/roster", key: "roster", icon: CalendarDays, group: "activity", max: "roster" },
  { href: "/app/ftl", key: "ftl", icon: Timer, group: "activity", max: "ftl" },
  { href: "/app/escales", key: "layovers", icon: Hotel, group: "activity", max: "layovers", flag: "layovers" },
  { href: "/app/fuseaux", key: "timezones", icon: Globe2, group: "activity" },
  { href: "/app/radar", key: "radar", icon: Radar, group: "activity", max: "radar", flag: "radar" },
  { href: "/app/carte", key: "map", icon: MapIcon, group: "activity" },
  { href: "/app/statistiques", key: "experience", icon: BarChart3, group: "career" },
  { href: "/app/emplois", key: "jobs", icon: Briefcase, group: "career", max: "jobs", flag: "jobs" },
  { href: "/app/cv", key: "cvFile", icon: FileUser, group: "career", max: "cv" },
  { href: "/app/documents", key: "documents", icon: BadgeCheck, group: "account" },
  { href: "/app/profil", key: "profile", icon: UserRound, group: "account" },
  { href: "/app/parametres", key: "settings", icon: Settings, group: "account" },
  { href: "/app/admin", key: "admin", icon: ShieldCheck, group: "admin", admin: true },
];
const GROUPS: NavGroup[] = ["home", "logbook", "activity", "career", "account", "admin"];

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
  // the mobile sheet: one group of sections (Activity, Career) or everything else ("more")
  const [sheet, setSheet] = useState<NavGroup | "more" | null>(null);
  // the most specific section wins (/app/carnet/import is Import, not Flights)
  const current = nav
    .filter(({ href }) => (href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(`${href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0];
  const isActive = (href: string) => current?.href === href;
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
          <nav className="mt-3 flex-1 overflow-y-auto px-3" aria-label="App">
            {GROUPS.map((g) => {
              const items = nav.filter((i) => i.group === g);
              if (!items.length) return null;
              return (
                <div key={g} className={g === "home" ? "" : "pt-2"}>
                  {g !== "home" && <p className="px-3 pb-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted/80">{t(`groups.${g}`)}</p>}
                  {items.map(({ href, key, icon: Icon, max }) => (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-3 rounded-xl px-3 py-[5px] text-[13.5px] font-medium transition-colors ${
                        isActive(href) ? "bg-bg/60 text-accent shadow-[inset_0_1px_0_var(--glass-hi)]" : "text-muted hover:bg-bg/40 hover:text-text"
                      }`}
                    >
                      <Icon size={17} /> <span className="flex-1">{t(key)}</span>
                      {max && !access.has(max) && <Lock size={13} className="opacity-60" aria-label="Max" />}
                    </Link>
                  ))}
                </div>
              );
            })}
          </nav>
          <div className="p-3">
            <div className="flex items-center justify-between gap-2 px-2">
              <Link href="/app/profil" className="min-w-0 rounded-md hover:text-accent">
                <p className="truncate text-sm font-semibold">{pilot?.fullName || "—"}</p>
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  {online ? <Wifi size={12} className="text-success" /> : <WifiOff size={12} className="text-caution" />}
                  {status}
                </p>
              </Link>
              <div className="flex">
                <button type="button" onClick={() => setReport(true)} className="btn btn-ghost btn-sm !px-2" aria-label={t("report")} title={t("report")}>
                  <Bug size={15} />
                </button>
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
                <DemoAccountBanner email={pilot?.email} />
                {children}
              </>
            ) : (
              <div className="app-glass min-h-[calc(100dvh-1.5rem)] rounded-[28px] px-4 py-6 sm:px-8 sm:py-8">
                <AccessBanner />
                <DemoAccountBanner email={pilot?.email} />
                {children}
              </div>
            )}
          </main>
        </div>

        {/* Mobile tab bar (liquid-glass pill): Home, Logbook, Activity, Career, More; the last three open a sheet */}
        <MobileTabBar
          active={sheet ?? (current?.group === "home" ? "home" : current?.group === "logbook" ? "logbook" : current?.group === "activity" || current?.group === "career" ? current.group : "more")}
          onSheet={(g) => setSheet(sheet === g ? null : g)}
          onClose={() => setSheet(null)}
        />
        {sheet && (
          // the glass skin sets its own position: it goes on an inner box, the outer one stays fixed above the tab bar
          <div className="fixed inset-x-0 bottom-[88px] z-40 mx-3 mb-[env(safe-area-inset-bottom)] lg:hidden" onClick={() => setSheet(null)}>
            <div className="app-glass rounded-2xl p-2">
            {(sheet === "more" ? (["logbook", "account", "admin"] as NavGroup[]) : [sheet]).map((g) => {
              const items = nav.filter((i) => i.group === g);
              if (!items.length) return null;
              return (
                <div key={g}>
                  <p className="px-2 pb-1 pt-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">{t(`groups.${g}`)}</p>
                  <div className="grid grid-cols-3 gap-1">
                    {items.map(({ href, key, icon: Icon }) => (
                      <Link key={href} href={href} className={`flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center text-xs font-medium ${isActive(href) ? "bg-accent/12 text-accent" : "text-muted"}`}>
                        <Icon size={20} /> {t(key)}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
            {sheet === "more" && (
              <button type="button" onClick={() => setReport(true)} className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-xs font-medium text-muted">
                <Bug size={16} /> {t("report")}
              </button>
            )}
            </div>
          </div>
        )}
        <ReportDialog open={report} onClose={() => setReport(false)} />
      </div>
    </AirportsProvider>
  );
}

/** On the public demo account: the data is fictional (so nobody takes it for a real pilot's logbook). */
function DemoAccountBanner({ email }: { email?: string | null }) {
  const t = useTranslations("app.access");
  // the fictional logbook loaded in this browser ("See the demo")
  const [localDemo, setLocalDemo] = useState(false);
  useEffect(() => {
    void localStore.getMeta(DEMO_META).then((v) => setLocalDemo(v === "1"));
  }, []);
  if (isDemoAccount(email)) return <p className="mb-3 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-sm">{t("demoAccount")}</p>;
  if (localDemo) return <p className="mb-3 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-sm">{t("demoLocal")}</p>;
  return null;
}
