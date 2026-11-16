"use client";

import { AlertOctagon, Info } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  analyseFtl, buildDutyPeriods, cumulativeLevel, DEFAULT_FTL_SETTINGS, dutyPeriodsFromRoster, formatDuration, FTL_LIMITS, type FtlSettings,
} from "@cielo/core";
import { Card, Field, Meter, PageTitle, Toggle } from "@/components/app/ui";
import { useAirports } from "@/lib/airports";
import { useFlights, useFormatDate, usePilot, useTable } from "@/lib/hooks";
import { localStore } from "@/lib/db";

export default function FtlPage() {
  const t = useTranslations("app.ftl");
  const flights = useFlights();
  const roster = useTable("roster_events");
  const pilot = usePilot();
  const airports = useAirports();
  const fd = useFormatDate();
  const [settings, setSettings] = useState<FtlSettings>(DEFAULT_FTL_SETTINGS);
  const [includeRoster, setIncludeRoster] = useState(true);

  useEffect(() => {
    localStore.getMeta("ftlSettings").then((s) => s && setSettings({ ...DEFAULT_FTL_SETTINGS, ...JSON.parse(s) }));
  }, []);
  useEffect(() => {
    if (pilot?.homeBaseIcao && !settings.homeBaseIcao) {
      const tz = airports?.get(pilot.homeBaseIcao)?.timezone;
      setSettings((s) => ({ ...s, homeBaseIcao: pilot.homeBaseIcao, homeTimezone: tz ?? s.homeTimezone }));
    }
  }, [pilot, airports, settings.homeBaseIcao]);
  const update = (s: FtlSettings) => {
    setSettings(s);
    localStore.setMeta("ftlSettings", JSON.stringify(s));
  };

  const report = useMemo(() => {
    if (!flights) return null;
    const now = new Date().toISOString();
    const past = buildDutyPeriods(flights, settings);
    const future = includeRoster ? dutyPeriodsFromRoster((roster ?? []).filter((e) => e.startUtc > now && !e.flightId), settings) : [];
    return analyseFtl([...past, ...future], now, settings);
  }, [flights, roster, settings, includeRoster]);

  if (!report) return <p className="text-muted">…</p>;
  const f = (m: number) => formatDuration(m);
  const cumul = [
    ["duty7d", report.cumulative.duty7d, FTL_LIMITS.duty7d],
    ["duty14d", report.cumulative.duty14d, FTL_LIMITS.duty14d],
    ["duty28d", report.cumulative.duty28d, FTL_LIMITS.duty28d],
    ["flight28d", report.cumulative.flight28d, FTL_LIMITS.flight28d],
    ["flightYear", report.cumulative.flightYear, FTL_LIMITS.flightYear],
    ["flight12m", report.cumulative.flight12m, FTL_LIMITS.flight12m],
  ] as const;
  const recent = report.duties.slice(-25).reverse();
  const now = new Date().toISOString();

  return (
    <>
      <PageTitle title={t("title")} subtitle={t("subtitle")} />
      <p className="mb-5 flex gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted"><Info size={16} className="mt-0.5 shrink-0 text-accent" /> {t("disclaimer")}</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cumul.map(([k, v, max]) => {
          const lvl = cumulativeLevel(v, max);
          return (
            <div key={k} className="card p-4">
              <p className="label-caps">{t(k)}</p>
              <p className="num mt-1.5 text-2xl font-semibold">{f(v)} <span className="text-base text-muted">/ {max / 60} h</span></p>
              <div className="mt-3"><Meter value={v} max={max} level={lvl === "ok" ? "ok" : lvl === "warning" ? "caution" : "warning"} /></div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          <Card title={`${t("violations")} · ${report.violations.length}`} pad={false}>
            {report.violations.length === 0 ? (
              <p className="px-5 py-4 text-sm text-success">{t("noViolation")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {report.violations.slice(0, 30).map((v, i) => (
                  <li key={i} className="flex gap-3 px-5 py-3 text-sm">
                    <AlertOctagon size={16} className={`mt-0.5 shrink-0 ${v.severity === "warning" ? "text-caution" : "text-warning"}`} />
                    <div>
                      <p className="font-medium">{t(`codes.${v.code}`, { actual: f(v.actualMin), limit: f(v.limitMin) })}</p>
                      <p className="num text-xs text-muted">{fd(v.atUtc, { dateStyle: "medium", timeStyle: "short" })} UTC{v.atUtc > now ? " · roster" : ""}{v.severity === "warning" && v.code === "fdpExceeded" ? ` · ${t("withinExtension")}` : ""}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={t("duties")} pad={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left">
                  <tr className="[&>th]:label-caps [&>th]:px-3 [&>th]:py-2.5">
                    <th>{t("report")}</th><th>{t("sectors")}</th><th className="!text-right">{t("fdp")}</th><th className="!text-right">{t("maxFdp")}</th><th className="!text-right">{t("rest")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recent.map((a) => {
                    const over = a.fdpMin > a.maxFdpMin;
                    const restShort = a.restBeforeMin !== undefined && a.minRestBeforeMin !== undefined && a.restBeforeMin < a.minRestBeforeMin;
                    return (
                      <tr key={a.duty.id} className={`num [&>td]:px-3 [&>td]:py-2 ${a.duty.reportUtc > now ? "text-muted" : ""}`}>
                        <td className="whitespace-nowrap">{fd(a.duty.reportUtc, { day: "2-digit", month: "short" })} {a.duty.reportUtc.slice(11, 16)} <span className="text-muted">{a.duty.startIcao}→{a.duty.endIcao}</span></td>
                        <td>{a.duty.sectors}</td>
                        <td className={`text-right font-semibold ${over ? "text-warning" : ""}`}>{f(a.fdpMin)}</td>
                        <td className="text-right text-muted">{Number.isFinite(a.maxFdpMin) ? f(a.maxFdpMin) : "—"}</td>
                        <td className={`text-right ${restShort ? "font-semibold text-warning" : "text-muted"}`}>{a.restBeforeMin !== undefined ? `${f(a.restBeforeMin)} (${t("minRest")} ${f(a.minRestBeforeMin ?? 0)})` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
        <Card title={t("settings")} className="self-start">
          <div className="space-y-4">
            <Field label={t("reportBefore")}><input type="number" min={0} max={180} className="input num" value={settings.reportBeforeMin} onChange={(e) => update({ ...settings, reportBeforeMin: +e.target.value || 0 })} /></Field>
            <Field label={t("releaseAfter")}><input type="number" min={0} max={120} className="input num" value={settings.releaseAfterMin} onChange={(e) => update({ ...settings, releaseAfterMin: +e.target.value || 0 })} /></Field>
            <Field label={t("homeBase")}>
              <input className="input num uppercase" value={settings.homeBaseIcao ?? ""} onChange={(e) => { const icao = e.target.value.toUpperCase(); update({ ...settings, homeBaseIcao: icao || undefined, homeTimezone: airports?.get(icao)?.timezone ?? settings.homeTimezone }); }} />
            </Field>
            <Field label={t("timezone")}><input className="input num" value={settings.homeTimezone} onChange={(e) => update({ ...settings, homeTimezone: e.target.value })} /></Field>
            <Toggle checked={includeRoster} onChange={setIncludeRoster} label={t("includeRoster")} />
          </div>
        </Card>
      </div>
    </>
  );
}
