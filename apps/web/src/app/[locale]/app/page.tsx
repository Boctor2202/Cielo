"use client";

import { AlertTriangle, ArrowRight, NotebookPen, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  addDays, analyseFtl, auditLogbook, buildDutyPeriods, computeRecency, cumulativeLevel, dashboardPeriods, FTL_LIMITS, licenseStatus,
} from "@cielo/core";
import { Link, useRouter } from "@/i18n/navigation";
import { Badge, Card, Empty, Meter, PageTitle, Readout, type Level } from "@/components/app/ui";
import { HoursBars } from "@/components/app/Charts";
import { useAirports } from "@/lib/airports";
import { useDuration, useFlights, useFormatDate, usePilot, useTable, useToday } from "@/lib/hooks";
import { loadDemo } from "@/lib/demo";

export default function Dashboard() {
  const t = useTranslations("app.dashboard");
  const tl = useTranslations("app.documents");
  const tf = useTranslations("app.ftl");
  const tn = useTranslations("app.nav");
  const locale = useLocale() as "fr" | "en";
  const router = useRouter();
  const flights = useFlights();
  const balances = useTable("opening_balances");
  const licenses = useTable("licenses");
  const pilot = usePilot();
  const airports = useAirports();
  const today = useToday();
  const d = useDuration();
  const fd = useFormatDate();
  const [busy, setBusy] = useState(false);

  const data = useMemo(() => {
    if (!flights || !balances) return null;
    const periods = dashboardPeriods(flights, balances, today);
    const recency = computeRecency(flights, today);
    const months: { label: string; minutes: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const dt = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1 - i, 1));
      const key = dt.toISOString().slice(0, 7);
      months.push({
        label: new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(dt).replace(".", ""),
        minutes: flights.filter((f) => f.date.startsWith(key)).reduce((s, f) => s + f.totalMin, 0),
      });
    }
    const ftl = analyseFtl(buildDutyPeriods(flights), new Date().toISOString());
    const issues = airports ? auditLogbook(flights, { today, airports: (c) => airports.get(c) }).filter((i) => i.severity === "error").length : 0;
    return { periods, recency, months, ftl, issues };
  }, [flights, balances, today, locale, airports]);

  const expiries = useMemo(
    () =>
      (licenses ?? [])
        .map((l) => ({ l, s: licenseStatus(l, today) }))
        .filter((x) => x.s.state !== "no_expiry")
        .sort((a, b) => (a.s.daysLeft ?? 0) - (b.s.daysLeft ?? 0))
        .slice(0, 5),
    [licenses, today],
  );

  if (!flights || !data) return <p className="text-muted">…</p>;

  const name = pilot?.displayName || pilot?.fullName?.split(" ")[0] || "";
  const { periods: p, recency } = data;

  if (flights.length === 0 && (balances?.length ?? 0) === 0) {
    return (
      <>
        <PageTitle title={name ? t("hello", { name }) : t("empty")} subtitle={t("today", { date: fd(today, { dateStyle: "full" }) })} />
        <Card>
          <Empty
            icon={<NotebookPen size={40} />}
            text={t("empty")}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/app/carnet/nouveau" className="btn btn-primary">
                  <Plus size={18} /> {t("emptyCta")}
                </Link>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={!airports || busy}
                  onClick={async () => {
                    setBusy(true);
                    await loadDemo(airports!, locale);
                    setBusy(false);
                    router.refresh();
                  }}
                >
                  {t("loadDemo")}
                </button>
              </div>
            }
          />
        </Card>
      </>
    );
  }

  const ftlRows = [
    { k: "duty7d", v: data.ftl.cumulative.duty7d, max: FTL_LIMITS.duty7d },
    { k: "duty28d", v: data.ftl.cumulative.duty28d, max: FTL_LIMITS.duty28d },
    { k: "flight28d", v: data.ftl.cumulative.flight28d, max: FTL_LIMITS.flight28d },
    { k: "flight12m", v: data.ftl.cumulative.flight12m, max: FTL_LIMITS.flight12m },
  ] as const;

  return (
    <>
      <PageTitle
        title={name ? t("hello", { name }) : t("totalTime")}
        subtitle={t("today", { date: fd(today, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) })}
        actions={
          <Link href="/app/carnet/nouveau" className="btn btn-primary">
            <Plus size={18} /> {tn("newFlight")}
          </Link>
        }
      />

      {data.issues > 0 && (
        <Link href="/app/carnet/audit" className="mb-5 flex items-center gap-3 rounded-xl border border-caution/40 bg-caution/10 px-4 py-3 text-sm font-medium text-caution">
          <AlertTriangle size={18} /> {t("auditIssues", { count: data.issues })} <ArrowRight size={16} className="ml-auto" />
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="col-span-2 lg:col-span-1">
          <Readout label={t("totalTime")} value={d(p.all.totalMin)} sub={`${t("pic")} ${d(p.all.picMin + p.all.picusMin)} · ${t("night")} ${d(p.all.nightMin)}`} level="info" />
        </div>
        <Readout label={t("d28")} value={d(p.d28.totalMin)} sub={t("flights", { count: p.d28.flights })} level="neutral" />
        <Readout label={t("d90")} value={d(p.d90.totalMin)} sub={t("flights", { count: p.d90.flights })} level="neutral" />
        <Readout label={t("m12")} value={d(p.m12.totalMin)} sub={t("flights", { count: p.m12.flights })} level="neutral" />
        <Readout label={t("year", { year: today.slice(0, 4) })} value={d(p.year.totalMin)} sub={`${t("ifr")} ${d(p.year.ifrMin)}`} level="neutral" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card title={t("recency")}>
          <RecencyRow label={t("recencyPax")} ok={recency.passengers.valid} text={recency.passengers.valid ? t("recencyOk", { date: fd(recency.passengers.validUntil) }) : t("recencyKo", { landings: recency.passengers.landings, takeoffs: recency.passengers.takeoffs })} warn={recency.passengers.valid && !!recency.passengers.validUntil && recency.passengers.validUntil < addDays(today, 15)} />
          <div className="my-4 h-px bg-border" />
          <RecencyRow label={t("recencyNight")} ok={recency.night.valid} text={recency.night.valid ? t("recencyOk", { date: fd(recency.night.validUntil) }) : t("recencyNightKo")} />
          {recency.lastFlightDate && (
            <p className="mt-4 text-xs text-muted">
              {t("lastFlight")} : {fd(recency.lastFlightDate)} · {t("daysAgo", { count: recency.daysSinceLastFlight ?? 0 })}
            </p>
          )}
        </Card>

        <Card title={t("expiries")} action={<Link href="/app/documents" className="text-xs font-semibold text-accent">→</Link>}>
          {expiries.length === 0 ? (
            <p className="text-sm text-muted">{t("noExpiries")}</p>
          ) : (
            <ul className="space-y-3">
              {expiries.map(({ l, s }) => {
                const level: Level = s.state === "expired" ? "warning" : s.state === "expiring" ? ((s.daysLeft ?? 99) <= 30 ? "caution" : "info") : "ok";
                return (
                  <li key={l.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-medium">{l.code}</span>
                    <Badge level={level}>{s.state === "expired" ? tl("expiredSince", { count: -(s.daysLeft ?? 0) }) : tl("daysLeft", { count: s.daysLeft ?? 0 })}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title={t("ftl")} action={<Link href="/app/ftl" className="text-xs font-semibold text-accent">→</Link>}>
          <ul className="space-y-3.5">
            {ftlRows.map((r) => (
              <li key={r.k}>
                <div className="mb-1.5 flex justify-between text-[13px]">
                  <span className="text-muted">{tf(r.k)}</span>
                  <span className="num font-semibold">
                    {d(r.v)} <span className="text-muted">/ {Math.round(r.max / 60)}h</span>
                  </span>
                </div>
                <Meter value={r.v} max={r.max} level={cumulativeLevel(r.v, r.max) === "ok" ? "ok" : cumulativeLevel(r.v, r.max) === "warning" ? "caution" : "warning"} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card title={t("monthly")}>
          <HoursBars data={data.months} format={(m) => d(m)} />
        </Card>
        <Card title={t("lastFlights")} pad={false} action={<Link href="/app/carnet" className="text-xs font-semibold text-accent">→</Link>}>
          <ul className="divide-y divide-border">
            {flights.slice(0, 6).map((f) => (
              <li key={f.id}>
                <Link href={{ pathname: "/app/carnet/[id]", params: { id: f.id } }} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-2">
                  <div className="min-w-0">
                    <p className="num text-sm font-semibold">{f.isFstd ? `FSTD · ${f.fstdType ?? ""}` : `${f.depIcao} → ${f.arrIcao}`}</p>
                    <p className="truncate text-xs text-muted">
                      {fd(f.date)} · {f.registration ?? ""} {f.aircraftTypeIcao ?? ""}
                    </p>
                  </div>
                  <span className="num text-sm font-semibold">{d(f.isFstd ? f.fstdMin : f.totalMin)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

function RecencyRow({ label, ok, text, warn }: { label: string; ok: boolean; text: string; warn?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-0.5 text-sm text-muted">{text}</p>
      </div>
      <Badge level={!ok ? "warning" : warn ? "caution" : "ok"}>{ok ? "OK" : "—"}</Badge>
    </div>
  );
}
