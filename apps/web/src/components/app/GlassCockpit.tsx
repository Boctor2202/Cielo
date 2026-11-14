"use client";

import { Plane, Plus } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useLocale, useMessages } from "next-intl";
import { addDays, computeRecency, licenseStatus, type Flight, type License, type OpeningBalance, type Pilot } from "@cielo/core";
import GlassWorkspace, {
  type GlassSettings,
  type WorkspaceCashFlowPeriod,
  type WorkspaceGoal,
  type WorkspaceLabels,
  type WorkspaceTransaction,
} from "@/components/ui/adjustable-glass-dashboard";
import { Link } from "@/i18n/navigation";
import { useDuration, useFormatDate, useTypes } from "@/lib/hooks";

const GLASS_KEY = "strato-glass";
const TOTAL_MILESTONES = [100, 200, 500, 1000, 1500, 3000, 5000, 10000, 15000, 20000];
const PIC_MILESTONES = [50, 100, 250, 500, 1000, 1500, 3000, 5000, 10000];
const next = (list: number[], h: number) => list.find((m) => m > h) ?? Math.ceil((h + 1) / 5000) * 5000;

/** Map the app's theme tokens onto the tokens the glass workspace reads (it follows our light/dark switch). */
const HOST_TOKENS = {
  "--color-background": "var(--bg)",
  "--color-foreground": "var(--text)",
  "--color-muted-foreground": "var(--muted)",
  "--color-primary": "var(--accent)",
  "--color-primary-foreground": "var(--accent-contrast)",
  "--color-card": "var(--surface)",
  "--color-secondary": "var(--surface-2)",
  "--color-secondary-foreground": "var(--text)",
  "--color-muted": "var(--surface-2)",
  "--color-border": "var(--border)",
  "--color-input": "var(--bg)",
  "--color-popover": "var(--bg)",
  fontFamily: "var(--font-sans)",
  minHeight: "calc(100svh - 7rem)",
  borderRadius: 28,
} as CSSProperties;

/**
 * The pilot dashboard in the adjustable glass workspace: total time instead of a balance, flight and night
 * hours instead of cash flow, recent flights instead of transactions, and career and recency targets as goals.
 */
export function GlassCockpit({ flights, opening, licenses, pilot, today }: { flights: Flight[]; opening: OpeningBalance[]; licenses: License[]; pilot?: Pilot; today: string }) {
  const locale = useLocale();
  const m = useMessages() as unknown as { app: { dashboard: { glass: Partial<WorkspaceLabels> & Record<string, string> } } };
  const g = m.app.dashboard.glass;
  const dur = useDuration();
  const fd = useFormatDate();
  const types = useTypes();
  const [glass, setGlass] = useState<Partial<GlassSettings> | undefined>(undefined);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(GLASS_KEY);
      if (raw) setGlass(JSON.parse(raw));
    } catch {}
  }, []);

  const data = useMemo(() => {
    const live = flights.filter((f) => !f.deletedAt);
    const realFlights = live.filter((f) => !f.isFstd);
    const sum = (list: Flight[], k: "totalMin" | "nightMin" | "picMin") => list.reduce((s, f) => s + (f[k] ?? 0), 0);
    const inRange = (from: string, to: string) => realFlights.filter((f) => f.date >= from && f.date <= to);
    const openingTotal = opening.filter((o) => !o.deletedAt).reduce((s, o) => s + o.totalMin, 0);
    const openingPic = opening.filter((o) => !o.deletedAt).reduce((s, o) => s + o.picMin, 0);
    const total = sum(realFlights, "totalMin") + openingTotal;
    const pic = realFlights.reduce((s, f) => s + f.picMin + f.picusMin, 0) + openingPic;

    // last 28 days compared with the 28 before
    const cur = sum(inRange(addDays(today, -27), today), "totalMin");
    const prev = sum(inRange(addDays(today, -55), addDays(today, -28)), "totalMin");
    const change = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : undefined;

    const dl = locale === "fr" ? "fr-FR" : "en-GB";
    const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(dl, { timeZone: "UTC", ...o }).format(new Date(`${iso}T12:00:00Z`)).replace(".", "");
    const week = Array.from({ length: 7 }, (_, i) => {
      const day = addDays(today, i - 6);
      const l = inRange(day, day);
      return { label: fmt(day, { weekday: "short" }), income: sum(l, "totalMin"), expenses: sum(l, "nightMin") };
    });
    const month = Array.from({ length: 10 }, (_, i) => {
      const from = addDays(today, -29 + i * 3);
      const l = inRange(from, addDays(from, 2));
      return { label: fmt(from, { day: "numeric", month: "short" }), income: sum(l, "totalMin"), expenses: sum(l, "nightMin") };
    });
    const year = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 12 + i, 1));
      const key = d.toISOString().slice(0, 7);
      const l = realFlights.filter((f) => f.date.startsWith(key));
      return { label: fmt(`${key}-01`, { month: "short" }), income: sum(l, "totalMin"), expenses: sum(l, "nightMin") };
    });
    const periods: WorkspaceCashFlowPeriod[] = [
      { id: "week", label: g.periodWeek ?? "7 d", points: week, description: g.chartNote },
      { id: "month", label: g.periodMonth ?? "30 d", points: month, description: g.chartNote },
      { id: "year", label: g.periodYear ?? "12 m", points: year, description: g.chartNote },
    ];

    const sorted = [...live].sort((a, b) => (a.date === b.date ? (b.outUtc ?? "").localeCompare(a.outUtc ?? "") : a.date < b.date ? 1 : -1));
    const transactions: WorkspaceTransaction[] = sorted.slice(0, 40).map((f) => ({
      id: f.id,
      name: f.isFstd ? `${g.simulator ?? "FSTD"} · ${f.fstdType ?? ""}`.trim() : `${f.depIcao} → ${f.arrIcao}`,
      category: f.isFstd ? "FSTD" : f.aircraftTypeIcao ?? "—",
      date: fd(f.date),
      amount: f.totalMin || f.fstdMin || 0,
      status: f.date > today ? "Pending" : "Completed",
    }));

    const last = realFlights.sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    const typeName = last?.aircraftTypeIcao ? types?.find((x) => x.icao === last.aircraftTypeIcao) : undefined;

    const rec = computeRecency(live, today);
    const tH = Math.floor(total / 60);
    const pH = Math.floor(pic / 60);
    const tGoal = next(TOTAL_MILESTONES, tH);
    const pGoal = next(PIC_MILESTONES, pH);
    const goals: WorkspaceGoal[] = [
      { id: "total", name: (g.goalTotal ?? "{h} h total").replace("{h}", tGoal.toLocaleString(locale)), saved: total, target: tGoal * 60 },
      { id: "pic", name: (g.goalPic ?? "{h} h PIC").replace("{h}", pGoal.toLocaleString(locale)), saved: pic, target: pGoal * 60 },
      {
        id: "recency",
        name: g.goalRecency ?? "Passenger recency (90 days)",
        saved: Math.min(rec.passengers.landings, 3),
        target: 3,
        savedLabel: String(rec.passengers.landings),
        targetLabel: g.goalRecencyTarget ?? "3 landings",
      },
      {
        id: "night",
        name: g.goalNight ?? "Night recency (90 days)",
        saved: Math.min(rec.night.landings, 1),
        target: 1,
        savedLabel: String(rec.night.landings),
        targetLabel: g.goalNightTarget ?? "1 night landing",
      },
    ];

    const notifications = licenses
      .filter((l) => !l.deletedAt)
      .map((l) => ({ l, s: licenseStatus(l, today) }))
      .filter(({ s }) => s.state === "expired" || (s.state === "expiring" && (s.daysLeft ?? 99) <= 60))
      .sort((a, b) => (a.s.daysLeft ?? 0) - (b.s.daysLeft ?? 0))
      .map(({ l, s }) => ({
        id: l.id,
        title: l.code,
        detail: s.state === "expired" ? g.expired ?? "expired" : (g.daysLeft ?? "{n} days left").replace("{n}", String(s.daysLeft ?? 0)),
      }));

    return {
      total,
      change,
      periods,
      transactions,
      goals,
      notifications,
      account: last ? { name: typeName ? `${typeName.manufacturer} ${typeName.model}` : last.aircraftTypeIcao ?? "—", detail: [last.registration, fd(last.date)].filter(Boolean).join(" · ") } : undefined,
    };
  }, [flights, opening, licenses, today, locale, fd, types, g]);

  const first = pilot?.displayName || pilot?.fullName?.split(" ")[0] || undefined;

  return (
    <GlassWorkspace
      brand="Strato"
      brandMark={
        <svg viewBox="0 0 40 40" width="18" height="18" fill="none" aria-hidden="true">
          <circle cx="20" cy="20" r="14" stroke="currentColor" strokeWidth="4.5" />
          <path d="M7 23.2 33 16.8" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" opacity=".75" />
        </svg>
      }
      userName={first}
      avatarUrl={pilot?.photoDataUrl}
      backgroundImage="/immersive/film/c68a/takeoff-poster-1920.webp"
      balance={data.total}
      balanceChange={data.change !== undefined ? { percent: data.change, label: g.changeLabel ?? "" } : undefined}
      account={data.account}
      periodLabel={fd(today, { weekday: "long", day: "numeric", month: "long" })}
      headingAction={
        <Link href="/app/carnet/nouveau" className="gw-button" style={{ textDecoration: "none" }}>
          <Plus size={14} aria-hidden="true" /> {g.newFlight}
        </Link>
      }
      cashFlowPeriods={data.periods}
      initialPeriodId="year"
      footerNote={g.footerNote}
      savingsNote={g.savingsNote}
      transactions={data.transactions}
      goals={data.goals}
      notifications={data.notifications}
      glass={glass}
      onGlassChange={(s) => {
        try {
          localStorage.setItem(GLASS_KEY, JSON.stringify(s));
        } catch {}
      }}
      formatValue={(v) => dur(Math.round(v))}
      showSign={false}
      categoryIcon={() => Plane}
      labels={g}
      useHostTheme
      style={HOST_TOKENS}
    />
  );
}
