"use client";

import { EXPORT_EN, exportMonth } from "@cielo/export";
import { Roll } from "@/components/ui/Roll";
import { Download, FileSpreadsheet, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PILOT_FUNCTIONS, sumFlights, type Flight, type Totals } from "@cielo/core";
import { downloadBlob } from "@/lib/download";
import { Meter } from "./ui";
import { useDuration, useFormatDate } from "@/lib/hooks";

type Preset = "month" | "m3" | "year" | "lastYear" | "m12" | "all" | "custom";
type GroupBy = "month" | "year" | "type" | "registration" | "function" | "route" | "airport";
type Condition = "all" | "night" | "ifr" | "pic" | "multiPilot";

const iso = (d: Date) => d.toISOString().slice(0, 10);

function range(p: Preset, today: string, from: string, to: string): [string, string] {
  const t = new Date(`${today}T12:00:00Z`);
  const y = t.getUTCFullYear();
  switch (p) {
    case "month": return [`${today.slice(0, 7)}-01`, today];
    case "m3": return [iso(new Date(Date.UTC(y, t.getUTCMonth() - 2, 1))), today];
    case "year": return [`${y}-01-01`, today];
    case "lastYear": return [`${y - 1}-01-01`, `${y - 1}-12-31`];
    case "m12": return [iso(new Date(t.getTime() - 365 * 86_400_000)), today];
    case "custom": return [from || "0000-01-01", to || "9999-12-31"];
    default: return ["0000-01-01", "9999-12-31"];
  }
}

/** Keys a flight falls under for a grouping (an airport groups both ends). */
function keysOf(f: Flight, g: GroupBy): string[] {
  switch (g) {
    case "month": return [f.date.slice(0, 7)];
    case "year": return [f.date.slice(0, 4)];
    case "type": return [f.aircraftTypeIcao || (f.isFstd ? "FSTD" : "—")];
    case "registration": return [f.registration || (f.isFstd ? "FSTD" : "—")];
    case "function": return [f.function];
    case "route": return [f.isFstd ? "FSTD" : `${f.depIcao} → ${f.arrIcao}`];
    case "airport": return f.isFstd ? [] : [...new Set([f.depIcao, f.arrIcao])];
  }
}

/**
 * Reports on the logbook: pick a period and filters, group the flights, read the totals per group and export them.
 * Everything is computed on the device from the local logbook.
 */
export function LogbookReport({ flights, today }: { flights: Flight[]; today: string }) {
  const t = useTranslations("app.logReport");
  const dur = useDuration();
  const fd = useFormatDate();
  const [preset, setPreset] = useState<Preset>("year");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState("");
  const [reg, setReg] = useState("");
  const [fn, setFn] = useState("");
  const [airport, setAirport] = useState("");
  const [cond, setCond] = useState<Condition>("all");
  const [fstd, setFstd] = useState(true);
  const [group, setGroup] = useState<GroupBy>("month");

  const live = useMemo(() => flights.filter((f) => !f.deletedAt), [flights]);
  const options = useMemo(() => {
    const u = (xs: (string | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort();
    return {
      types: u(live.map((f) => f.aircraftTypeIcao)),
      regs: u(live.map((f) => f.registration?.toUpperCase())),
      airports: u(live.flatMap((f) => (f.isFstd ? [] : [f.depIcao, f.arrIcao]))),
    };
  }, [live]);

  const [start, end] = range(preset, today, from, to);
  const selected = useMemo(
    () =>
      live.filter((f) => {
        if (f.date < start || f.date > end) return false;
        if (!fstd && f.isFstd) return false;
        if (type && f.aircraftTypeIcao !== type) return false;
        if (reg && f.registration?.toUpperCase() !== reg) return false;
        if (fn && f.function !== fn) return false;
        if (airport && f.depIcao !== airport && f.arrIcao !== airport) return false;
        if (cond === "night" && !f.nightMin) return false;
        if (cond === "ifr" && !f.ifrMin) return false;
        if (cond === "pic" && !f.picMin) return false;
        if (cond === "multiPilot" && !f.multiPilotMin) return false;
        return true;
      }),
    [live, start, end, fstd, type, reg, fn, airport, cond],
  );
  const totals = useMemo(() => sumFlights(selected), [selected]);
  const rows = useMemo(() => {
    const m = new Map<string, Flight[]>();
    for (const f of selected) for (const k of keysOf(f, group)) m.set(k, [...(m.get(k) ?? []), f]);
    const list = [...m.entries()].map(([key, fs]) => ({ key, t: sumFlights(fs) }));
    return group === "month" || group === "year" ? list.sort((a, b) => b.key.localeCompare(a.key)) : list.sort((a, b) => b.t.totalMin + b.t.fstdMin - (a.t.totalMin + a.t.fstdMin));
  }, [selected, group]);
  const max = Math.max(1, ...rows.map((r) => r.t.totalMin + r.t.fstdMin));

  const label = (key: string) => (group === "month" && /^\d{4}-\d{2}$/.test(key) ? fd(`${key}-15`, { month: "long", year: "numeric" }) : key);
  const ldg = (x: Totals) => x.landingsDay + x.landingsNight;
  const filtersOn = !!(type || reg || fn || airport || cond !== "all" || !fstd);
  const reset = () => (setType(""), setReg(""), setFn(""), setAirport(""), setCond("all"), setFstd(true));

  const csvCell = (v: string | number) => (/[;"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const h = (m: number) => (m / 60).toFixed(2);
  const exportReport = () => {
    // exports are in English, whatever the language of the app
    const E = EXPORT_EN.col;
    const head = [EXPORT_EN.group[group] ?? group, E.flights, E.total, E.pic, E.copilot, E.dual, E.instructor, E.multiPilot, E.night, E.ifr, E.fstd, E.landings];
    const exportLabel = (k: string) => (group === "month" && /^\d{4}-\d{2}$/.test(k) ? exportMonth(k) : k);
    const line = (k: string, x: Totals) => [exportLabel(k), x.flights + x.fstdSessions, h(x.totalMin), h(x.picMin), h(x.copilotMin), h(x.dualMin), h(x.instructorMin), h(x.multiPilotMin), h(x.nightMin), h(x.ifrMin), h(x.fstdMin), ldg(x)];
    const csv = [head, ...rows.map((r) => line(r.key, r.t)), line(EXPORT_EN.total, totals)].map((r) => r.map(csvCell).join(";")).join("\r\n");
    downloadBlob("﻿" + csv, `geardown-report-${start.replace(/^0000.*/, "start")}_${end.replace(/^9999.*/, today)}.csv`, "text/csv;charset=utf-8");
  };
  const exportFlights = () => {
    const head = ["Date", "From", "To", "Out", "In", "Type", "Registration", "Function", "Total (h)", "PIC (h)", "Night (h)", "IFR (h)", "Landings", "Remarks"];
    const lines = [...selected].sort((a, b) => a.date.localeCompare(b.date)).map((f) => [f.date, f.depIcao, f.arrIcao, f.outUtc?.slice(11, 16) ?? "", f.inUtc?.slice(11, 16) ?? "", f.aircraftTypeIcao ?? "", f.registration ?? "", f.function, h(f.isFstd ? f.fstdMin : f.totalMin), h(f.picMin), h(f.nightMin), h(f.ifrMin), f.landingsDay + f.landingsNight, f.remarks ?? ""]);
    downloadBlob("﻿" + [head, ...lines].map((r) => r.map(csvCell).join(";")).join("\r\n"), `geardown-flights-${today}.csv`, "text/csv;charset=utf-8");
  };

  const pill = (on: boolean) => `rounded-full border px-3 py-1.5 text-xs font-medium transition ${on ? "font-semibold" : "border-border text-muted hover:text-text"}`;
  // inline so the glass workspace's own button styles cannot hide which choice is active
  const pillStyle = (on: boolean) => (on ? { background: "var(--accent)", color: "var(--accent-contrast)", borderColor: "var(--accent)" } : undefined);
  const sel = "input !h-9 !py-1 text-sm";

  return (
    <div className="space-y-4">
      {/* filters */}
      <section className="gw-panel gw-reveal space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(["month", "m3", "year", "lastYear", "m12", "all", "custom"] as Preset[]).map((p) => (
            <button key={p} type="button" aria-pressed={preset === p} className={pill(preset === p)} style={pillStyle(preset === p)} onClick={() => setPreset(p)}>{t(`preset.${p}`)}</button>
          ))}
          {preset === "custom" && (
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <input type="date" className={sel} value={from} onChange={(e) => setFrom(e.target.value)} aria-label={t("from")} />
              →
              <input type="date" className={sel} value={to} onChange={(e) => setTo(e.target.value)} aria-label={t("to")} />
            </span>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <select className={sel} value={type} onChange={(e) => setType(e.target.value)} aria-label={t("f.type")}>
            <option value="">{t("f.type")} · {t("any")}</option>
            {options.types.map((x) => <option key={x}>{x}</option>)}
          </select>
          <select className={sel} value={reg} onChange={(e) => setReg(e.target.value)} aria-label={t("f.registration")}>
            <option value="">{t("f.registration")} · {t("any")}</option>
            {options.regs.map((x) => <option key={x}>{x}</option>)}
          </select>
          <select className={sel} value={fn} onChange={(e) => setFn(e.target.value)} aria-label={t("f.function")}>
            <option value="">{t("f.function")} · {t("any")}</option>
            {PILOT_FUNCTIONS.map((x) => <option key={x}>{x}</option>)}
          </select>
          <select className={sel} value={airport} onChange={(e) => setAirport(e.target.value)} aria-label={t("f.airport")}>
            <option value="">{t("f.airport")} · {t("any")}</option>
            {options.airports.map((x) => <option key={x}>{x}</option>)}
          </select>
          <select className={sel} value={cond} onChange={(e) => setCond(e.target.value as Condition)} aria-label={t("f.condition")}>
            {(["all", "night", "ifr", "pic", "multiPilot"] as Condition[]).map((x) => <option key={x} value={x}>{t(`cond.${x}`)}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <label className="flex items-center gap-2"><input type="checkbox" checked={fstd} onChange={(e) => setFstd(e.target.checked)} /> {t("includeFstd")}</label>
          <span className="flex items-center gap-3">
            {start !== "0000-01-01" && <span className="num">{fd(start, { dateStyle: "medium" })} → {fd(end > today ? today : end, { dateStyle: "medium" })}</span>}
            {filtersOn && <button type="button" className="flex items-center gap-1 font-semibold underline" onClick={reset}><RotateCcw size={12} /> {t("reset")}</button>}
          </span>
        </div>
      </section>

      {/* totals of the selection */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        {[
          [t("col.total"), dur(totals.totalMin)],
          [t("col.flights"), String(totals.flights + totals.fstdSessions)],
          [t("col.pic"), dur(totals.picMin)],
          [t("col.multiPilot"), dur(totals.multiPilotMin)],
          [t("col.night"), dur(totals.nightMin)],
          [t("col.ifr"), dur(totals.ifrMin)],
          [t("col.landings"), String(ldg(totals))],
        ].map(([k, v]) => (
          <section key={k} className="gw-panel gw-reveal !p-4">
            <p className="text-xs text-muted">{k}</p>
            <p className="num mt-1 text-xl font-semibold"><Roll>{v}</Roll></p>
          </section>
        ))}
      </div>

      {/* grouped table */}
      <section className="gw-panel gw-reveal">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-muted">{t("groupBy")}</span>
            {(["month", "year", "type", "registration", "function", "route", "airport"] as GroupBy[]).map((g) => (
              <button key={g} type="button" aria-pressed={group === g} className={pill(group === g)} style={pillStyle(group === g)} onClick={() => setGroup(g)}>{t(`group.${g}`)}</button>
            ))}
          </div>
          <span className="flex gap-2">
            <button type="button" className="gw-button" onClick={exportReport} disabled={!rows.length}><Download size={14} /> {t("exportReport")}</button>
            <button type="button" className="gw-button" onClick={exportFlights} disabled={!selected.length}><FileSpreadsheet size={14} /> {t("exportFlights", { n: selected.length })}</button>
          </span>
        </div>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">{t("empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted [&>th]:px-2 [&>th]:py-2 [&>th]:font-medium">
                  <th>{t(`group.${group}`)}</th>
                  <th className="!text-right">{t("col.flights")}</th>
                  <th className="!text-right">{t("col.total")}</th>
                  <th className="!text-right">{t("col.pic")}</th>
                  <th className="!text-right">{t("col.copilot")}</th>
                  <th className="!text-right">{t("col.night")}</th>
                  <th className="!text-right">{t("col.ifr")}</th>
                  <th className="!text-right">{t("col.landings")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const v = r.t.totalMin + r.t.fstdMin;
                  const best = v === max && rows.length > 1;
                  const all = totals.totalMin + totals.fstdMin;
                  // a zero is noise in a column: shown faint
                  const z = (m: number) => <span className={m ? undefined : "opacity-35"}>{dur(m)}</span>;
                  return (
                    <tr key={r.key} className="report-row num border-t border-[var(--border)] transition-colors [&>td]:px-2 [&>td]:py-2.5" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
                      <td className="min-w-48">
                        <span className="flex items-center gap-2">
                          <span className="font-semibold">{label(r.key)}</span>
                          {best && <span className="rounded-full border border-[var(--accent)]/50 bg-[var(--accent)]/12 px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">{t("best")}</span>}
                        </span>
                        <span className="mt-1.5 flex items-center gap-2">
                          <span className="min-w-0 flex-1"><Meter value={v} max={max} level="ok" /></span>
                          <span className="w-9 shrink-0 text-right text-[11px] text-muted">{all ? Math.round((v / all) * 100) : 0}%</span>
                        </span>
                      </td>
                      <td className="text-right">{r.t.flights + r.t.fstdSessions}</td>
                      <td className="text-right text-base font-bold">{dur(v)}</td>
                      <td className="text-right">{z(r.t.picMin)}</td>
                      <td className="text-right">{z(r.t.copilotMin)}</td>
                      <td className="text-right">{z(r.t.nightMin)}</td>
                      <td className="text-right">{z(r.t.ifrMin)}</td>
                      <td className="text-right">{ldg(r.t)}</td>
                    </tr>
                  );
                })}
                <tr className="num border-t-2 border-[var(--accent)]/40 bg-[var(--accent)]/[0.07] font-bold [&>td]:px-2 [&>td]:py-3">
                  <td className="rounded-l-xl uppercase tracking-wider text-[var(--accent)]">{t("total")}</td>
                  <td className="text-right">{totals.flights + totals.fstdSessions}</td>
                  <td className="text-right text-base">{dur(totals.totalMin + totals.fstdMin)}</td>
                  <td className="text-right">{dur(totals.picMin)}</td>
                  <td className="text-right">{dur(totals.copilotMin)}</td>
                  <td className="text-right">{dur(totals.nightMin)}</td>
                  <td className="text-right">{dur(totals.ifrMin)}</td>
                  <td className="rounded-r-xl text-right">{ldg(totals)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {group === "airport" && <p className="mt-2 text-xs text-muted">{t("airportNote")}</p>}
      </section>
    </div>
  );
}
