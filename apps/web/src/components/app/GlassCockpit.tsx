"use client";

import { Moon, Plane, Plus, SlidersHorizontal, Sun } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useLocale, useMessages } from "next-intl";
import { addDays, computeRecency, defaultGoals, goalProgress, isHourGoal, licenseStatus, type Flight, type License, type OpeningBalance, type Pilot } from "@cielo/core";
import GlassWorkspace, {
  type GlassSettings,
  type WorkspaceCashFlowPeriod,
  type WorkspaceGoal,
  type WorkspaceLabels,
  type WorkspaceTransaction,
} from "@/components/ui/adjustable-glass-dashboard";
import { Link } from "@/i18n/navigation";
import { useDuration, useFormatDate, useTypes } from "@/lib/hooks";
import { LogbookReport } from "./LogbookReport";
import { GoalsEditor } from "./GoalsEditor";

const GLASS_KEY = "geardown-glass";

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
  // the app shell draws the photo behind every page; the dashboard shows it through
  background: "transparent",
  "--gw-shade": "transparent",
  // the brand tile is the Geardown mark: green dots on the dark navy tile, never the accent colour
  "--gw-brand": "#0B1A2E",
  "--gw-brand-ink": "#22C55E",
  minHeight: "calc(100svh - 7rem)",
  borderRadius: 28,
} as CSSProperties;

/**
 * The pilot dashboard in the adjustable glass workspace: total time instead of a balance, flight and night
 * hours instead of cash flow, recent flights instead of transactions, and career and recency targets as goals.
 */
export function GlassCockpit({ flights, opening, licenses, pilot, today, auditIssues = 0, auditHref }: { flights: Flight[]; opening: OpeningBalance[]; licenses: License[]; pilot?: Pilot; today: string; auditIssues?: number; auditHref?: string }) {
  const locale = useLocale();
  const m = useMessages() as unknown as { app: { dashboard: { glass: Partial<WorkspaceLabels> & Record<string, string> } } };
  const g = m.app.dashboard.glass;
  const dur = useDuration();
  const fd = useFormatDate();
  const types = useTypes();
  const [editGoals, setEditGoals] = useState(false);
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
    // the last 365 days, as everywhere else in the logbook, split by calendar month (first and last partial)
    const start = addDays(today, -364);
    const year: { label: string; income: number; expenses: number }[] = [];
    for (let d = new Date(`${start.slice(0, 7)}-01T12:00:00Z`); d.toISOString().slice(0, 7) <= today.slice(0, 7); d.setUTCMonth(d.getUTCMonth() + 1)) {
      const key = d.toISOString().slice(0, 7);
      const l = realFlights.filter((f) => f.date.startsWith(key) && f.date >= start && f.date <= today);
      year.push({ label: fmt(`${key}-01`, { month: "short" }), income: sum(l, "totalMin"), expenses: sum(l, "nightMin") });
    }
    // 90 days in weekly steps
    const d90 = Array.from({ length: 13 }, (_, i) => {
      const from = addDays(today, -90 + i * 7);
      const to = i === 12 ? today : addDays(from, 6);
      const l = inRange(from, to);
      return { label: fmt(from, { day: "numeric", month: "short" }), income: sum(l, "totalMin"), expenses: sum(l, "nightMin") };
    });
    // the current calendar year, month by month up to now
    const ytd = Array.from({ length: Number(today.slice(5, 7)) }, (_, i) => {
      const key = `${today.slice(0, 4)}-${String(i + 1).padStart(2, "0")}`;
      const l = realFlights.filter((f) => f.date.startsWith(key) && f.date <= today);
      return { label: fmt(`${key}-01`, { month: "short" }), income: sum(l, "totalMin"), expenses: sum(l, "nightMin") };
    });
    // the whole logbook: by year (by month when it covers less than three years)
    const firstDate = realFlights.reduce((m, f) => (f.date < m ? f.date : m), today);
    const byMonth = Number(today.slice(0, 4)) - Number(firstDate.slice(0, 4)) < 2;
    const all: { label: string; income: number; expenses: number }[] = [];
    if (byMonth) {
      for (let d = new Date(`${firstDate.slice(0, 7)}-01T12:00:00Z`); d.toISOString().slice(0, 7) <= today.slice(0, 7); d.setUTCMonth(d.getUTCMonth() + 1)) {
        const key = d.toISOString().slice(0, 7);
        const l = realFlights.filter((f) => f.date.startsWith(key) && f.date <= today);
        all.push({ label: fmt(`${key}-01`, { month: "short", year: "2-digit" }), income: sum(l, "totalMin"), expenses: sum(l, "nightMin") });
      }
    } else {
      for (let y = Number(firstDate.slice(0, 4)); y <= Number(today.slice(0, 4)); y++) {
        const l = realFlights.filter((f) => f.date.startsWith(String(y)) && f.date <= today);
        all.push({ label: String(y), income: sum(l, "totalMin"), expenses: sum(l, "nightMin") });
      }
    }
    const periods: WorkspaceCashFlowPeriod[] = [
      { id: "week", label: g.periodWeek ?? "7 d", points: week, description: g.chartNote },
      { id: "month", label: g.periodMonth ?? "30 d", points: month, description: g.chartNote },
      { id: "d90", label: g.period90 ?? "90 d", points: d90, description: g.chartNote },
      { id: "ytd", label: today.slice(0, 4), points: ytd, description: g.chartNote },
      { id: "year", label: g.periodYear ?? "12 m", points: year, description: g.chartNote },
      { id: "all", label: g.periodAll ?? "All", points: all, description: g.chartNote },
    ];

    const sorted = [...live].sort((a, b) => (a.date === b.date ? (b.outUtc ?? "").localeCompare(a.outUtc ?? "") : a.date < b.date ? 1 : -1));
    const transactions: WorkspaceTransaction[] = sorted.slice(0, 1000).map((f) => ({
      id: f.id,
      name: f.isFstd ? `${g.simulator ?? "FSTD"} · ${f.fstdType ?? ""}`.trim() : `${f.depIcao} → ${f.arrIcao}`,
      category: f.isFstd ? "FSTD" : f.aircraftTypeIcao ?? "—",
      date: fd(f.date),
      amount: f.totalMin || f.fstdMin || 0,
      status: f.date > today ? "Pending" : "Completed",
    }));

    // hours by aircraft type since the start of the logbook (carried-forward totals included)
    const byType = new Map<string, number>();
    for (const f of realFlights) byType.set(f.aircraftTypeIcao ?? "—", (byType.get(f.aircraftTypeIcao ?? "—") ?? 0) + f.totalMin);
    const CARRIED = "\u0000carried";
    for (const o of opening) if (!o.deletedAt && o.totalMin) byType.set(o.aircraftTypeIcao ?? CARRIED, (byType.get(o.aircraftTypeIcao ?? CARRIED) ?? 0) + o.totalMin);
    const ranked = [...byType.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const nameOf = (icao: string) => {
      if (icao === CARRIED) return g.carried ?? "Carried forward";
      const ty = types?.find((x) => x.icao === icao);
      return ty ? `${ty.manufacturer} ${ty.model}` : icao;
    };
    const breakdown = [
      ...ranked.slice(0, 7).map(([k, v]) => ({ label: nameOf(k), value: v })),
      ...(ranked.length > 7 ? [{ label: g.otherTypes ?? "Other", value: ranked.slice(7).reduce((s, [, v]) => s + v, 0) }] : []),
    ];

    const last = realFlights.sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    const typeName = last?.aircraftTypeIcao ? types?.find((x) => x.icao === last.aircraftTypeIcao) : undefined;

    const rec = computeRecency(live, today);
    // goals the pilot set (or the next milestones), then the FCL.060 recency checks
    const jet = (icao: string) => types?.find((x) => x.icao === icao)?.engineType === "jet";
    const mine = pilot?.goals?.length ? pilot.goals : defaultGoals(live, opening);
    const fmtH = (min: number) => `${Math.floor(min / 60).toLocaleString(locale)} h`;
    const goals: WorkspaceGoal[] = [
      ...mine.map((goal): WorkspaceGoal => {
        const p = goalProgress(goal, live, opening, today, jet);
        const hours = isHourGoal(goal.kind);
        const name = (g[`goalKind_${goal.kind}`] ?? `{n} ${goal.kind}`)
          .replace("{n}", hours ? Math.round(goal.target / 60).toLocaleString(locale) : goal.target.toLocaleString(locale))
          .replace("{icao}", goal.icao ?? "");
        const deadline = goal.by
          ? ` · ${(g.goalBy ?? "by {date}").replace("{date}", fd(goal.by, { day: "numeric", month: "short", year: "numeric" }))}${p.perMonth ? ` · ${(g.goalPace ?? "{n}/month").replace("{n}", hours ? fmtH(p.perMonth) : String(p.perMonth))}` : ""}`
          : "";
        // when it will be reached at the pace of the last 12 months
        const eta = p.reached
          ? ""
          : p.eta
            ? ` · ${(g.goalEta ?? "≈ {date} at your pace").replace("{date}", fd(p.eta, { month: "short", year: "numeric" }))}${p.onTrack === false ? ` ${g.goalLate ?? "(after the deadline)"}` : ""}`
            : ` · ${g.goalNoPace ?? "no flying in the last 12 months"}`;
        return {
          id: goal.id,
          name,
          saved: Math.min(p.done, goal.target),
          target: goal.target,
          savedLabel: hours ? dur(p.done) : String(p.done),
          targetLabel: `${(g.goalOf ?? "of {v}").replace("{v}", hours ? dur(goal.target) : goal.target.toLocaleString(locale))}${deadline}${eta}`,
        };
      }),
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

    const audit = auditIssues > 0 ? [{ id: "audit", title: (g.auditIssues ?? "{n} items to check").replace("{n}", String(auditIssues)), href: auditHref }] : [];
    const notifications = [...audit, ...licenses
      .filter((l) => !l.deletedAt)
      .map((l) => ({ l, s: licenseStatus(l, today) }))
      .filter(({ s }) => s.state === "expired" || (s.state === "expiring" && (s.daysLeft ?? 99) <= 60))
      .sort((a, b) => (a.s.daysLeft ?? 0) - (b.s.daysLeft ?? 0))
      .map(({ l, s }) => ({
        id: l.id,
        title: l.code,
        detail: s.state === "expired" ? g.expired ?? "expired" : (g.daysLeft ?? "{n} days left").replace("{n}", String(s.daysLeft ?? 0)),
      }))];

    return {
      total,
      change,
      periods,
      transactions,
      goals,
      notifications,
      breakdown,
      account: last ? { name: typeName ? `${typeName.manufacturer} ${typeName.model}` : last.aircraftTypeIcao ?? "—", detail: [last.registration, fd(last.date)].filter(Boolean).join(" · ") } : undefined,
    };
  }, [flights, opening, licenses, today, locale, fd, types, g, auditIssues, auditHref]);

  const first = pilot?.displayName || pilot?.fullName?.split(" ")[0] || undefined;

  return (
    <>
    {editGoals && <GoalsEditor goals={pilot?.goals} flights={flights} today={today} onClose={() => setEditGoals(false)} />}
    <GlassWorkspace
      brand="Geardown"
      brandMark={
        <svg viewBox="0 0 40 40" width="18" height="18" fill="none" aria-hidden="true">
          <circle cx="20" cy="13.5" r="5" fill="#22C55E" />
          <circle cx="11.5" cy="26.5" r="5" fill="#22C55E" />
          <circle cx="28.5" cy="26.5" r="5" fill="#22C55E" />
        </svg>
      }
      userName={first}
      avatarUrl={pilot?.photoDataUrl}
      balance={data.total}
      balanceChange={data.change !== undefined ? { percent: data.change, label: g.changeLabel ?? "" } : undefined}
      account={data.account}
      periodLabel={fd(today, { weekday: "long", day: "numeric", month: "long" })}
      headingAction={
        <Link href="/app/carnet/nouveau" className="gw-button" style={{ textDecoration: "none" }}>
          <Plus size={14} aria-hidden="true" /> {g.newFlight}
        </Link>
      }
      savingsAction={
        <button type="button" className="gw-button" onClick={() => setEditGoals(true)}>
          <SlidersHorizontal size={14} aria-hidden="true" /> {g.setGoals ?? "Set my goals"}
        </button>
      }
      reportsContent={<LogbookReport flights={flights} today={today} />}
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
      breakdown={data.breakdown}
      reportIcons={[Plane, Moon, Sun]}
      labels={g}
      useHostTheme
      style={HOST_TOKENS}
    />
    </>
  );
}
