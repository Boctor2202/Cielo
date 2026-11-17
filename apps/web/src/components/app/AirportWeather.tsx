"use client";

import { CloudSun, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ageMin, ceilingFt, tafLines, visibilityText, windText, type FlightCategory, type Metar, type RunwayEstimate, type Taf } from "@cielo/core";
import { Card } from "./ui";

/** Flight category colours, the convention of aviation weather maps (not the brand palette). */
export const CATEGORY_COLOR: Record<FlightCategory, string> = { VFR: "#16a34a", MVFR: "#2563eb", IFR: "#dc2626", LIFR: "#c026d3" };

type Wx = { metars: Record<string, Metar>; tafs: Record<string, Taf>; runways?: Record<string, RunwayEstimate> };
const cache = new Map<string, { at: number; p: Promise<Wx | null> }>();

/** METAR + TAF for a few aerodromes, shared between components and kept 5 minutes. */
export function fetchWeather(ids: string[], opts: { taf?: boolean; fresh?: boolean } = {}): Promise<Wx | null> {
  const key = [...ids].sort().join(",") + (opts.taf === false ? "|m" : "");
  const hit = cache.get(key);
  if (!opts.fresh && hit && Date.now() - hit.at < 5 * 60_000) return hit.p;
  const p = fetch(`/api/weather?ids=${encodeURIComponent([...ids].sort().join(","))}${opts.taf === false ? "&taf=0" : ""}${opts.fresh ? "&fresh=1" : ""}`, opts.fresh ? { cache: "no-store" } : undefined)
    .then((r) => (r.ok ? (r.json() as Promise<Wx>) : null))
    .catch(() => null);
  cache.set(key, { at: Date.now(), p });
  return p;
}

export function useWeather(icao: string | undefined) {
  const [wx, setWx] = useState<{ metar?: Metar; taf?: Taf; runway?: RunwayEstimate } | null | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!icao || icao.length < 3) return setWx(null);
    let alive = true;
    const fresh = tick > 0;
    if (fresh) setRefreshing(true);
    else setWx(undefined);
    fetchWeather([icao], { fresh }).then((d) => {
      if (!alive) return;
      setWx(d ? { metar: d.metars[icao], taf: d.tafs[icao], runway: d.runways?.[icao] } : null);
      setRefreshing(false);
    });
    return () => {
      alive = false;
    };
  }, [icao, tick]);
  return { wx, refreshing, refresh: () => setTick((x) => x + 1) };
}

/** Decoded METAR line + raw METAR and TAF. Used in a card (layover) or bare (radar panel). */
export function WeatherBody({ icao, compact }: { icao: string; compact?: boolean }) {
  const t = useTranslations("app.weather");
  const { wx, refreshing, refresh } = useWeather(icao);
  const button = (
    <button type="button" onClick={refresh} disabled={refreshing} className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink disabled:opacity-60" title={t("refresh")}>
      <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} /> {t("refresh")}
    </button>
  );
  if (wx === undefined) return <p className="flex items-center gap-2 text-sm text-muted"><Loader2 size={14} className="animate-spin" /> {t("loading")}</p>;
  if (!wx || (!wx.metar && !wx.taf)) return <div className="flex items-center justify-between gap-2 text-sm text-muted"><p>{t("none", { icao })}</p>{button}</div>;
  const m = wx.metar;
  const age = ageMin(m?.obsTime);
  const ceil = m ? ceilingFt(m.clouds) : null;
  return (
    <div className="space-y-3 text-sm">
      {m && (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {m.category && <span className="rounded-md px-2 py-0.5 text-xs font-bold text-white" style={{ background: CATEGORY_COLOR[m.category] }}>{m.category}</span>}
            <span><span className="text-muted">{t("wind")}</span> <b className="num">{windText(m, t("calm"))}</b></span>
            <span><span className="text-muted">{t("visibility")}</span> <b className="num">{visibilityText(m.visibSm)}</b></span>
            <span><span className="text-muted">{t("ceiling")}</span> <b className="num">{ceil != null ? `${ceil.toLocaleString()} ft` : t("noCeiling")}</b></span>
            {m.tempC != null && <span><span className="text-muted">{t("temp")}</span> <b className="num">{m.tempC}° / {m.dewpC ?? "—"}°</b></span>}
            {m.qnhHpa != null && <span><span className="text-muted">QNH</span> <b className="num">{Math.round(m.qnhHpa)}</b></span>}
          </div>
          {wx.runway && (
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-muted">{t("runway")}</span>
              {wx.runway.calm ? (
                <b>{t("runwayCalm")}</b>
              ) : (
                <>
                  <b className="num text-base">{wx.runway.ident}</b>
                  <span className="num text-xs text-muted">{t("components", { head: wx.runway.headwindKt, cross: wx.runway.crosswindKt })}</span>
                </>
              )}
              <span className="w-full text-[11px] text-muted">{t("runwayNote")}</span>
            </p>
          )}
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="label-caps">METAR{age != null ? ` · ${t("ago", { min: age })}` : ""}</p>
              {button}
            </div>
            <p className={`num rounded-lg bg-surface-2 px-3 py-2 text-[13px] ${age != null && age > 90 ? "text-[var(--warning)]" : ""}`}>{m.raw}</p>
          </div>
        </>
      )}
      {wx.taf && (
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="label-caps">TAF</p>
            {!m ? button : null}
          </div>
          <div className="num space-y-0.5 rounded-lg bg-surface-2 px-3 py-2 text-[13px]">
            {tafLines(wx.taf.raw).map((l, i) => <p key={i} className={i ? "pl-4" : ""}>{l}</p>)}
          </div>
        </div>
      )}
      {!compact && <p className="text-[11px] text-muted">{t("source")}</p>}
    </div>
  );
}

export function AirportWeather({ icao, className }: { icao: string; className?: string }) {
  const t = useTranslations("app.weather");
  return (
    <Card title={<span className="flex items-center gap-2"><CloudSun size={16} /> {t("title", { icao })}</span>} className={className}>
      <WeatherBody icao={icao} />
    </Card>
  );
}
