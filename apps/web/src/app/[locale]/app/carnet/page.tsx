"use client";

import { BookCopy, Building2, Check, ListChecks, Clock, CloudFog, FileDown, MapPin, Moon, NotebookPen, Plane, PlaneLanding, Plus, ScanSearch, ShieldCheck, Upload } from "lucide-react";
import { useAirports } from "@/lib/airports";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { operatorIndex, sumFlights } from "@cielo/core";
import { Link, useRouter } from "@/i18n/navigation";
import { Card, Empty, Overlay, PageTitle, useToast } from "@/components/app/ui";
import { setOperator as assignOperator } from "@/lib/repo";
import { useDuration, useFlights, useFormatDate, useTable } from "@/lib/hooks";

/** Function badges: command green, co-pilot blue, supervised command teal, instruction amber / violet. */
const FUNCTION_TONE: Record<string, string> = {
  PIC: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  SIC: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  PICUS: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  DUAL: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  FI: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  FE: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
};

export default function Logbook() {
  const t = useTranslations("app.logbook");
  const tfn = useTranslations("app.functions");
  const tn = useTranslations("app.nav");
  const flights = useFlights();
  const d = useDuration();
  const fd = useFormatDate();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [year, setYear] = useState("");
  const [type, setType] = useState("");
  const [operator, setOperator] = useState("");
  const aircraft = useTable("aircraft");
  const ops = useMemo(() => operatorIndex(flights ?? [], aircraft ?? []), [flights, aircraft]);

  const years = useMemo(() => [...new Set((flights ?? []).map((f) => f.date.slice(0, 4)))].sort().reverse(), [flights]);
  const types = useMemo(() => [...new Set((flights ?? []).map((f) => (f.isFstd ? "FSTD" : f.aircraftTypeIcao ?? "")).filter(Boolean))].sort(), [flights]);
  const filtered = useMemo(() => {
    const s = q.trim().toUpperCase();
    return (flights ?? []).filter(
      (f) =>
        (!year || f.date.startsWith(year)) &&
        (!type || (type === "FSTD" ? f.isFstd : f.aircraftTypeIcao === type)) &&
        (!operator || (operator === "-" ? !ops.of(f) : ops.of(f) === operator)) &&
        (!s || [f.depIcao, f.arrIcao, f.registration, f.aircraftTypeIcao, f.flightNumber, f.remarks, f.picName, f.fstdType, ops.of(f)].some((x) => x?.toUpperCase().includes(s))),
    );
  }, [flights, q, year, type, operator, ops]);
  const totals = useMemo(() => sumFlights(filtered), [filtered]);
  const [limit, setLimit] = useState(100);
  const airports = useAirports();
  // selection, to give flights their operator in one go
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [assignTo, setAssignTo] = useState("");
  const { toast, toastNode } = useToast();
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const open = (id: string) => (selecting ? toggle(id) : router.push({ pathname: "/app/carnet/[id]", params: { id } }));
  const stopSelecting = () => (setSelecting(false), setPicked(new Set()), setAssignTo(""));
  const assign = async () => {
    const n = picked.size;
    await assignOperator([...picked], assignTo || undefined);
    toast(assignTo ? t("assign.done", { count: n, operator: assignTo }) : t("assign.cleared", { count: n }));
    stopSelecting();
  };
  const airportCount = useMemo(() => new Set(filtered.filter((f) => !f.isFstd).flatMap((f) => [f.depIcao, f.arrIcao])).size, [filtered]);
  // the shown flights, month by month
  const months = useMemo(() => {
    const out: { key: string; label: string; flights: typeof filtered; total: number; night: number }[] = [];
    for (const f of filtered.slice(0, limit)) {
      const key = f.date.slice(0, 7);
      let m = out[out.length - 1];
      if (!m || m.key !== key) {
        m = { key, label: fd(`${key}-15`, { month: "long", year: "numeric" }), flights: [], total: 0, night: 0 };
        out.push(m);
      }
      m.flights.push(f);
      m.total += f.isFstd ? f.fstdMin : f.totalMin;
      m.night += f.nightMin;
    }
    return out;
  }, [filtered, limit, fd]);

  return (
    <>
      <PageTitle
        title={t("title")}
        subtitle={t("entries", { count: filtered.length })}
        actions={
          <>
            <Link href="/app/carnet/import" className="btn btn-secondary btn-sm"><Upload size={15} /> {t("import")}</Link>
            <Link href="/app/carnet/export" className="btn btn-secondary btn-sm"><FileDown size={15} /> {t("export")}</Link>
            <Link href="/app/carnet/audit" className="btn btn-secondary btn-sm"><ScanSearch size={15} /> {t("audit")}</Link>
            <Link href="/app/carnet/report" className="btn btn-secondary btn-sm"><BookCopy size={15} /> {t("carry")}</Link>
            <Link href="/app/carnet/nouveau" className="btn btn-primary btn-sm"><Plus size={15} /> {tn("newFlight")}</Link>
          </>
        }
      />
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_140px_140px_190px_auto]">
        <input className="input" type="search" placeholder={t("searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={year} onChange={(e) => setYear(e.target.value)} aria-label={t("allYears")}>
          <option value="">{t("allYears")}</option>
          {years.map((y) => <option key={y}>{y}</option>)}
        </select>
        <select className="input" value={type} onChange={(e) => setType(e.target.value)} aria-label={t("allTypes")}>
          <option value="">{t("allTypes")}</option>
          {types.map((y) => <option key={y}>{y}</option>)}
        </select>
        <select className="input" value={operator} onChange={(e) => setOperator(e.target.value)} aria-label={t("allOperators")}>
          <option value="">{t("allOperators")}</option>
          {ops.all.map((o) => <option key={o} value={o}>{o}</option>)}
          <option value="-">{t("noOperator")}</option>
        </select>
        <button type="button" className={`btn btn-sm h-full ${selecting ? "btn-primary" : "btn-secondary"}`} onClick={() => (selecting ? stopSelecting() : setSelecting(true))}>
          <ListChecks size={15} /> {selecting ? t("assign.stop") : t("assign.start")}
        </button>
      </div>

      {/* what the selection adds up to */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { icon: Plane, k: t("sum.flights"), v: String(filtered.length) },
          { icon: Clock, k: t("sum.total"), v: d(totals.totalMin + totals.fstdMin), lead: true },
          { icon: Moon, k: t("night"), v: d(totals.nightMin) },
          { icon: CloudFog, k: t("ifr"), v: d(totals.ifrMin) },
          { icon: PlaneLanding, k: t("sum.landings"), v: String(totals.landingsDay + totals.landingsNight) },
          { icon: MapPin, k: t("sum.airports"), v: String(airportCount) },
        ].map(({ icon: Icon, k, v, lead }) => (
          <div key={k} className={`readout relative overflow-hidden rounded-2xl border px-4 py-3 ${lead ? "border-accent/40 bg-accent/[0.08]" : "border-border bg-surface/70"}`} style={{ "--readout": lead ? "var(--accent)" : "var(--muted)" } as React.CSSProperties}>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted"><Icon size={13} className={lead ? "text-accent" : ""} /> {k}</p>
            <p className={`num mt-1 text-2xl font-bold ${lead ? "text-accent" : ""}`}>{v}</p>
          </div>
        ))}
      </div>

      <Card pad={false}>
        {flights && filtered.length === 0 ? (
          <Empty icon={<NotebookPen size={36} />} text={t("empty")} />
        ) : (
          <>
            {/* Desktop: the flights by month, each month with its own totals */}
            <div className="hidden md:block">
              {months.map((m) => (
                <section key={m.key} className="logbook-month">
                  <header className="sticky top-0 z-10 flex items-baseline justify-between gap-3 border-b border-border bg-surface/90 px-5 py-2.5 backdrop-blur">
                    <h2 className="font-display text-lg font-semibold capitalize">{m.label}</h2>
                    <p className="num flex items-center gap-4 text-xs text-muted">
                      <span>{t("entries", { count: m.flights.length })}</span>
                      {m.night > 0 && <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-300"><Moon size={11} /> {d(m.night)}</span>}
                      <span className="rounded-md bg-accent/12 px-2 py-0.5 text-sm font-bold text-accent">{d(m.total)}</span>
                    </p>
                  </header>
                  <ul>
                    {m.flights.map((f) => {
                      const dep = airports?.get(f.depIcao);
                      const arr = airports?.get(f.arrIcao);
                      const op = ops.of(f);
                      return (
                        <li key={f.id}>
                          <button
                            type="button"
                            onClick={() => open(f.id)}
                            aria-pressed={selecting ? picked.has(f.id) : undefined}
                            className={`logbook-row group grid w-full items-center gap-4 border-b border-border/60 px-5 py-3 text-left transition-colors hover:bg-accent/[0.05] ${selecting ? "grid-cols-[22px_64px_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_96px]" : "grid-cols-[64px_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_96px]"} ${picked.has(f.id) ? "bg-accent/[0.08]" : ""}`}
                          >
                            {selecting && (
                              <span className={`grid h-5 w-5 place-items-center rounded-md border ${picked.has(f.id) ? "border-accent bg-accent text-white" : "border-border"}`} aria-hidden>
                                {picked.has(f.id) && <Check size={13} strokeWidth={3} />}
                              </span>
                            )}
                            {/* the day, with a coloured edge: night indigo, IFR sky, VFR green, simulator violet */}
                            <span className="relative flex items-center gap-3">
                              <span className={`h-10 w-1 rounded-full ${f.isFstd ? "bg-violet-400" : f.nightMin > 0 ? "bg-indigo-400" : f.ifrMin > 0 ? "bg-sky-400" : "bg-emerald-400"}`} aria-hidden />
                              <span className="text-center leading-none">
                                <span className="num block text-xl font-bold">{f.date.slice(8, 10)}</span>
                                <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">{fd(f.date, { weekday: "short" })}</span>
                              </span>
                            </span>
                            {/* the route, as on a boarding pass */}
                            <span className="min-w-0">
                              {f.isFstd ? (
                                <span className="inline-flex items-center gap-2 font-semibold"><span className="rounded-md bg-violet-500/15 px-2 py-0.5 text-violet-700 dark:text-violet-300">{t("fstd")}</span> {f.fstdType}</span>
                              ) : (
                                <span className="flex items-center gap-3">
                                  <span className="min-w-0">
                                    <span className="num block text-[17px] font-bold tracking-wide">{f.depIcao}</span>
                                    <span className="block truncate text-[11px] text-muted">{dep?.city ?? dep?.name ?? ""}</span>
                                  </span>
                                  <span className="logbook-line relative mx-1 h-px min-w-10 flex-1" aria-hidden>
                                    <Plane size={13} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45 text-accent" />
                                  </span>
                                  <span className="min-w-0 text-right">
                                    <span className="num block text-[17px] font-bold tracking-wide">{f.arrIcao}</span>
                                    <span className="block truncate text-[11px] text-muted">{arr?.city ?? arr?.name ?? ""}</span>
                                  </span>
                                </span>
                              )}
                            </span>
                            {/* times, flight number, operator */}
                            <span className="min-w-0 text-sm">
                              {!f.isFstd && <span className="num block font-medium">{f.outUtc?.slice(11, 16) ?? "--"} <span className="text-muted">→</span> {f.inUtc?.slice(11, 16) ?? "--"} <span className="text-[11px] text-muted">UTC</span></span>}
                              <span className="block truncate text-xs text-muted">{[f.flightNumber, op].filter(Boolean).join(" · ") || "\u00a0"}</span>
                            </span>
                            {/* aircraft and function */}
                            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                              {f.registration ? <span className="num rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[12px] font-semibold">{f.registration}</span> : null}
                              {f.aircraftTypeIcao ? <span className="num text-[12px] text-muted">{f.aircraftTypeIcao}</span> : null}
                              <span title={tfn(f.function)} className={`num rounded-full px-2 py-0.5 text-[11px] font-semibold ${FUNCTION_TONE[f.function] ?? "bg-surface-2 text-muted"}`}>{f.function}</span>
                            </span>
                            {/* time, with night / IFR / landings / signature underneath */}
                            <span className="text-right">
                              <span className="num block text-lg font-bold text-accent">{d(f.isFstd ? f.fstdMin : f.totalMin)}</span>
                              <span className="num mt-0.5 flex items-center justify-end gap-2 text-[11px] text-muted">
                                {f.nightMin > 0 && <span className="inline-flex items-center gap-0.5 text-indigo-600 dark:text-indigo-300"><Moon size={10} />{d(f.nightMin, true)}</span>}
                                {f.ifrMin > 0 && <span className="text-sky-600 dark:text-sky-300">IFR</span>}
                                {f.landingsDay + f.landingsNight > 0 && <span>{f.landingsDay + f.landingsNight} ldg</span>}
                                {f.signatureId && <ShieldCheck size={12} className="text-success" aria-label={t("signed")} />}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
            {/* Mobile list */}
            <ul className="divide-y divide-border md:hidden">
              {filtered.slice(0, limit).map((f) => (
                <li key={f.id}>
                  <Link
                    href={{ pathname: "/app/carnet/[id]", params: { id: f.id } }}
                    onClick={(e) => { if (selecting) { e.preventDefault(); toggle(f.id); } }}
                    className={`flex items-center justify-between gap-3 px-4 py-3 ${picked.has(f.id) ? "bg-accent/[0.08]" : ""}`}
                  >
                    <div className="min-w-0">
                      <p className="num font-semibold">{f.isFstd ? `FSTD · ${f.fstdType ?? ""}` : `${f.depIcao} → ${f.arrIcao}`}</p>
                      <p className="truncate text-xs text-muted">{fd(f.date)} · {f.registration} {f.aircraftTypeIcao} · {f.function}</p>
                    </div>
                    <div className="text-right">
                      <p className="num font-semibold">{d(f.isFstd ? f.fstdMin : f.totalMin)}</p>
                      {f.nightMin > 0 && <p className="num text-xs text-muted">☾ {d(f.nightMin)}</p>}
                    </div>
                  </Link>
                </li>
              ))}
              <li className="flex justify-between bg-surface-2/60 px-4 py-3 text-sm font-semibold">
                <span>{t("pageTotal")}</span>
                <span className="num">{d(totals.totalMin)}</span>
              </li>
            </ul>
            {filtered.length > limit && (
              <div className="border-t border-border p-3 text-center">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLimit(limit + 200)}>+ {Math.min(200, filtered.length - limit)}</button>
              </div>
            )}
          </>
        )}
      </Card>

      {selecting && (
        <Overlay>
        <div className="fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-3xl flex-wrap items-center gap-2 rounded-2xl border border-white/15 bg-[#061226]/95 p-3 text-white shadow-[0_30px_80px_-20px_rgba(0,0,0,.8)] backdrop-blur-xl lg:bottom-6">
          <span className="num px-1 text-sm font-semibold">{t("assign.picked", { count: picked.size })}</span>
          <button type="button" className="text-xs font-semibold text-white/70 underline hover:text-white" onClick={() => setPicked(new Set(filtered.map((f) => f.id)))}>
            {t("assign.all", { count: filtered.length })}
          </button>
          <span className="flex min-w-48 flex-1 items-center gap-2">
            <Building2 size={15} className="shrink-0 text-white/60" />
            <input className="input h-9 flex-1 !bg-white/10 !text-white" list="logbook-operators" placeholder={t("assign.placeholder")} value={assignTo} onChange={(e) => setAssignTo(e.target.value)} />
            <datalist id="logbook-operators">{ops.all.map((o) => <option key={o} value={o} />)}</datalist>
          </span>
          <button type="button" className="btn btn-primary btn-sm" disabled={!picked.size} onClick={() => void assign()}>
            {assignTo ? t("assign.go") : t("assign.clear")}
          </button>
          <button type="button" className="btn btn-ghost btn-sm !text-white/70" onClick={stopSelecting}>{t("assign.stop")}</button>
        </div>
        </Overlay>
      )}
      {toastNode}
    </>
  );
}
