"use client";

import { ArrowLeft, ArrowRight, Check, GripVertical, Maximize2, Minimize2, Minus, SlidersHorizontal, X } from "lucide-react";
import React, { useMemo, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  FTL_LIMITS,
  WIDGETS,
  closestBadge,
  cumulativeLevel,
  dashboardValue,
  dashboardWidgets,
  discoveryBadges,
  hoursByOperator,
  hoursByType,
  licenseStatus,
  moveWidget,
  nextLayover,
  placesVisited,
  widgetLabel,
  widgetSpec,
  type DashboardPeriods,
  type Flight,
  type FtlReport,
  type License,
  type Pilot,
  type RecencyStatus,
  type WidgetId,
  type WidgetPlacement,
} from "@cielo/core";
import { Link } from "@/i18n/navigation";
import { Meter, type Level } from "@/components/app/ui";
import { useAirports } from "@/lib/airports";
import { useDuration, useFormatDate, useTable } from "@/lib/hooks";
import { updatePilot } from "@/lib/repo";

const LEVEL_TEXT: Record<Level, string> = { neutral: "text-muted", ok: "text-ok", info: "text-accent", caution: "text-caution", warning: "text-warning" };

/**
 * The Overview as widgets the pilot picks, orders and sizes (the same layout as in the app, kept on the pilot
 * record). The glass cockpit is the large form of "Total time"; the others are compact cards.
 */
export function OverviewWidgets({
  pilot,
  flights,
  licenses,
  today,
  periods,
  recency,
  ftl,
  canMax,
  cockpit,
}: {
  pilot?: Pilot;
  flights: Flight[];
  licenses: License[];
  today: string;
  periods: DashboardPeriods;
  recency: RecencyStatus;
  ftl: FtlReport;
  canMax: boolean;
  cockpit: ReactNode;
}) {
  const t = useTranslations("app.dashboard.widgets");
  const tb = useTranslations("app.badges.d");
  const locale = useLocale();
  const d = useDuration();
  const fd = useFormatDate();
  const airports = useAirports();
  const roster = useTable("roster_events");
  const layovers = useTable("layovers");
  const saved = useMemo(() => dashboardWidgets(pilot), [pilot]);
  const [draft, setDraft] = useState<WidgetPlacement[] | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const widgets = draft ?? saved;
  const editing = draft !== null;

  const nowIso = new Date().toISOString();
  const byType = useMemo(() => hoursByType(flights), [flights]);
  const byOperator = useMemo(() => hoursByOperator(flights), [flights]);
  const places = useMemo(() => placesVisited(flights, (i) => airports?.get(i)?.country), [flights, airports]);
  const badge = useMemo(() => (airports ? closestBadge(discoveryBadges(flights, (i) => airports.get(i))) : undefined), [flights, airports]);
  const layover = useMemo(() => nextLayover(layovers ?? [], nowIso), [layovers, nowIso]);
  const nextDuty = useMemo(
    () => (roster ?? []).filter((e) => e.startUtc > nowIso && ["FLIGHT", "DEADHEAD", "STANDBY", "SIM", "GROUND"].includes(e.kind)).sort((a, b) => a.startUtc.localeCompare(b.startUtc))[0],
    [roster, nowIso],
  );
  const last = flights.filter((f) => !f.isFstd)[0];
  const expiries = useMemo(
    () => licenses.map((l) => ({ l, s: licenseStatus(l, today) })).filter((x) => x.s.state !== "no_expiry").sort((a, b) => (a.s.daysLeft ?? 0) - (b.s.daysLeft ?? 0)),
    [licenses, today],
  );
  const lvl = (s: string): Level => (s === "expired" ? "warning" : s === "expiring" ? "caution" : "ok");
  const ftl28 = { actual: ftl.cumulative.flight28d, limit: FTL_LIMITS.flight28d };
  const ftlLevel = cumulativeLevel(ftl28.actual, ftl28.limit) as Level;
  const fr = locale === "fr";

  // each widget: a figure for the compact card, and a list for the large one
  type Href = React.ComponentProps<typeof Link>["href"];
  type Body = { value: ReactNode; sub?: ReactNode; level?: Level; href?: Href; list?: ReactNode };
  const rows = (items: { key: string; label: ReactNode; value: string; ratio?: number; level?: Level }[]) => (
    <ul className="mt-3 space-y-2.5">
      {items.map((x) => (
        <li key={x.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-semibold">{x.label}</span>
            <span className={`num shrink-0 ${x.level ? LEVEL_TEXT[x.level] : "text-muted"}`}>{x.value}</span>
          </div>
          {x.ratio !== undefined && <Meter value={x.ratio} max={1} level={x.level ?? "ok"} />}
        </li>
      ))}
    </ul>
  );
  const body: Record<WidgetId, Body | null> = {
    hero: { value: d(periods.all.totalMin), sub: t("flights", { n: periods.all.flights }), href: "/app/statistiques" },
    periods: {
      value: d(periods.d28.totalMin),
      sub: t("d28"),
      list: rows([
        { key: "d28", label: t("d28"), value: `${d(periods.d28.totalMin)} · ${t("flights", { n: periods.d28.flights })}` },
        { key: "d90", label: t("d90"), value: `${d(periods.d90.totalMin)} · ${t("flights", { n: periods.d90.flights })}` },
        { key: "m12", label: t("m12"), value: `${d(periods.m12.totalMin)} · ${t("flights", { n: periods.m12.flights })}` },
      ]),
    },
    nextDuty: nextDuty
      ? { value: nextDuty.depIcao && nextDuty.arrIcao ? `${nextDuty.depIcao} → ${nextDuty.arrIcao}` : nextDuty.title || nextDuty.kind, sub: `${fd(nextDuty.startUtc.slice(0, 10), { day: "numeric", month: "short" })} · ${nextDuty.startUtc.slice(11, 16)} UTC`, href: "/app/roster" }
      : { value: "—", sub: t("nothing"), href: "/app/roster" },
    lastFlight: last ? { value: `${last.depIcao} → ${last.arrIcao}`, sub: `${d(last.totalMin)} · ${fd(last.date, { day: "numeric", month: "short", year: "numeric" })}${last.registration ? ` · ${last.registration}` : ""}`, href: { pathname: "/app/carnet/[id]", params: { id: last.id } } } : null,
    recency: {
      value: recency.passengers.valid ? t("current") : t("notCurrent"),
      level: recency.passengers.valid ? (recency.night.valid ? "ok" : "caution") : "warning",
      sub: recency.passengers.validUntil ? t("until", { date: fd(recency.passengers.validUntil, { day: "numeric", month: "short" }) }) : undefined,
      list: rows([
        { key: "pax", label: t("pax"), value: recency.passengers.valid && recency.passengers.validUntil ? t("until", { date: fd(recency.passengers.validUntil, { day: "numeric", month: "short" }) }) : t("notCurrent"), level: recency.passengers.valid ? "ok" : "warning" },
        { key: "night", label: t("night"), value: recency.night.valid && recency.night.validUntil ? t("until", { date: fd(recency.night.validUntil, { day: "numeric", month: "short" }) }) : t("notCurrent"), level: recency.night.valid ? "ok" : "caution" },
      ]),
    },
    expiries: expiries[0]
      ? {
          value: expiries[0].l.code,
          level: lvl(expiries[0].s.state),
          sub: expiries[0].l.validUntil ? fd(expiries[0].l.validUntil, { day: "numeric", month: "short", year: "numeric" }) : undefined,
          href: "/app/documents",
          list: rows(expiries.slice(0, 5).map(({ l, s }) => ({ key: l.id, label: l.code, value: l.validUntil ? fd(l.validUntil, { day: "numeric", month: "short", year: "numeric" }) : "—", level: lvl(s.state) }))),
        }
      : { value: "—", sub: t("nothing"), href: "/app/documents" },
    ftl: {
      value: `${d(ftl28.actual)} / ${d(ftl28.limit)}`,
      sub: t("ftl28"),
      level: ftlLevel,
      href: "/app/ftl",
      list: rows(
        (["flight28d", "flightYear", "flight12m", "duty28d"] as const).map((k) => ({
          key: k,
          label: t(`ftl.${k}`),
          value: `${d(ftl.cumulative[k])} / ${d(FTL_LIMITS[k])}`,
          ratio: Math.min(1, FTL_LIMITS[k] ? ftl.cumulative[k] / FTL_LIMITS[k] : 0),
          level: cumulativeLevel(ftl.cumulative[k], FTL_LIMITS[k]) as Level,
        })),
      ),
    },
    byType: byType[0]
      ? { value: byType[0].key, sub: d(byType[0].minutes), href: "/app/statistiques", list: rows(byType.map((x) => ({ key: x.key, label: x.key, value: d(x.minutes), ratio: x.minutes / (byType[0]?.minutes || 1) }))) }
      : null,
    countries: { value: String(places.countries.length), sub: t("places", { a: places.airports }), href: "/app/carte" },
    byOperator: byOperator[0]
      ? {
          value: byOperator[0].key === "—" ? t("noOperator") : byOperator[0].key,
          sub: d(byOperator[0].minutes),
          href: "/app/carnet",
          list: rows(byOperator.map((x) => ({ key: x.key, label: x.key === "—" ? t("noOperator") : x.key, value: d(x.minutes), ratio: x.minutes / (byOperator[0]?.minutes || 1) }))),
        }
      : null,
    nextLayover: layover ? { value: layover.airportIcao, sub: layover.hotelName || (layover.arrivalUtc ? fd(layover.arrivalUtc.slice(0, 10), { day: "numeric", month: "short" }) : undefined), href: "/app/escales" } : { value: "—", sub: t("noLayover"), href: "/app/escales" },
    nextBadge: badge ? { value: tb(badge.id), sub: `${badge.value.toLocaleString(locale)} / ${badge.target.toLocaleString(locale)}`, href: "/app/statistiques" } : null,
    jobs: { value: t("jobsValue"), sub: t("jobsSub"), href: "/app/emplois" },
  };

  const locked = (id: WidgetId) => !!widgetSpec(id).max && !canMax && (id === "jobs" || id === "nextLayover");
  const card = (w: WidgetPlacement) => {
    // the full cockpit needs the whole width: while customising, a compact preview stands in for it
    if (w.id === "hero" && w.size === "l" && !editing) return cockpit;
    if (w.id === "hero" && w.size === "l")
      return (
        <section className="card flex min-h-40 items-center justify-between gap-6 p-6">
          <div>
            <p className="mono-label !text-[10px]">{widgetLabel("hero", locale)}</p>
            <p className="num mt-1.5 text-4xl font-bold">{d(periods.all.totalMin)}</p>
            <p className="text-sm text-muted">{t("cockpitPreview")}</p>
          </div>
          <div className="hidden h-16 flex-1 items-end gap-1.5 sm:flex" aria-hidden>
            {[40, 55, 70, 62, 80, 90, 75, 66, 58, 72, 60, 35].map((h, i) => (
              <span key={i} className="flex-1 rounded-sm bg-accent/70" style={{ height: `${h}%` }} />
            ))}
          </div>
        </section>
      );
    const b = body[w.id];
    const inner = (
      <section className="card h-full min-w-0 p-5">
        <p className="mono-label !text-[10px]">{widgetLabel(w.id, locale)}</p>
        {!b ? (
          <p className="mt-2 text-sm text-muted">{t("nothing")}</p>
        ) : locked(w.id) ? (
          <p className="mt-2 text-lg font-bold text-muted">Max</p>
        ) : (
          <>
            <p className={`mt-1.5 truncate text-2xl font-bold ${b.level ? LEVEL_TEXT[b.level] : ""}`}>{b.value}</p>
            {b.sub && <p className="truncate text-sm text-muted">{b.sub}</p>}
            {w.size === "l" && b.list}
          </>
        )}
      </section>
    );
    const href: Href | undefined = locked(w.id) ? "/app/parametres" : b?.href;
    return href && !editing ? (
      <Link href={href} className="block h-full transition hover:-translate-y-0.5">
        {inner}
      </Link>
    ) : (
      inner
    );
  };
  const span = (w: WidgetPlacement) => (w.id === "hero" && w.size === "l" ? "md:col-span-4" : w.size === "l" ? "md:col-span-2" : "md:col-span-1");

  const save = async () => {
    if (draft) await updatePilot({ dashboard: dashboardValue(draft) });
    setDraft(null);
  };
  const toggle = (id: WidgetId) =>
    setDraft(widgets.some((w) => w.id === id) ? widgets.filter((w) => w.id !== id) : [...widgets, { id, size: widgetSpec(id).sizes[0]! }]);
  const tool = "grid h-7 w-7 place-items-center rounded-full bg-surface-2 text-muted transition hover:text-text disabled:opacity-30";

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        {editing && (
          <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>
            <X size={15} /> {t("cancel")}
          </button>
        )}
        <button type="button" className={editing ? "btn btn-primary" : "btn btn-secondary"} onClick={() => (editing ? void save() : setDraft(saved))}>
          {editing ? <Check size={15} /> : <SlidersHorizontal size={15} />} {editing ? t("done") : t("customize")}
        </button>
      </div>

      <div className={editing ? "grid gap-4 lg:grid-cols-[1fr_260px]" : ""}>
        <div className="grid gap-4 md:grid-cols-4">
          {widgets.map((w, i) => (
            <div
              key={w.id}
              className={`${span(w)} ${editing ? `relative rounded-2xl border-2 border-dashed p-1 ${dragging === i ? "border-accent opacity-60" : "border-accent/40"}` : ""}`}
              draggable={editing}
              onDragStart={() => setDragging(i)}
              onDragOver={(e) => editing && e.preventDefault()}
              onDrop={() => {
                if (dragging !== null) setDraft(moveWidget(widgets, dragging, i));
                setDragging(null);
              }}
              onDragEnd={() => setDragging(null)}
            >
              {editing && (
                <div className="mb-1 flex items-center justify-between gap-2 px-1">
                  <span className="flex min-w-0 items-center gap-1 text-xs font-semibold text-muted">
                    <GripVertical size={14} className="shrink-0 cursor-grab" /> <span className="truncate">{widgetLabel(w.id, locale)}</span>
                  </span>
                  <span className="flex shrink-0 gap-1">
                    <button type="button" className={tool} aria-label={t("left")} disabled={i === 0} onClick={() => setDraft(moveWidget(widgets, i, i - 1))}>
                      <ArrowLeft size={13} />
                    </button>
                    <button type="button" className={tool} aria-label={t("right")} disabled={i === widgets.length - 1} onClick={() => setDraft(moveWidget(widgets, i, i + 1))}>
                      <ArrowRight size={13} />
                    </button>
                    {widgetSpec(w.id).sizes.length > 1 && (
                      <button type="button" className={tool} aria-label={t("resize")} onClick={() => setDraft(widgets.map((x, j) => (j === i ? { ...x, size: x.size === "l" ? "s" : "l" } : x)))}>
                        {w.size === "l" ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                      </button>
                    )}
                    <button type="button" className="grid h-7 w-7 place-items-center rounded-full bg-warning text-white" aria-label={t("remove")} onClick={() => setDraft(widgets.filter((_, j) => j !== i))}>
                      <Minus size={13} />
                    </button>
                  </span>
                </div>
              )}
              <div className={editing ? "pointer-events-none" : "h-full"}>{card(w)}</div>
            </div>
          ))}
        </div>

        {editing && (
          <aside className="card h-fit p-4 lg:sticky lg:top-4">
            <p className="text-sm font-semibold">{t("panel")}</p>
            <p className="mt-1 text-xs text-muted">{t("panelHint")}</p>
            <ul className="mt-3 divide-y divide-border">
              {WIDGETS.map((w) => {
                const on = widgets.some((x) => x.id === w.id);
                return (
                  <li key={w.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 truncate">{fr ? w.label.fr : w.label.en}</span>
                    <button type="button" role="switch" aria-checked={on} onClick={() => toggle(w.id)} className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? "bg-accent" : "bg-surface-2"}`}>
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${on ? "left-[18px]" : "left-0.5"}`} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}
