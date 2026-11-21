"use client";

import { X, BookCopy, Building2, CalendarRange, Check, ListChecks, Clock, CloudFog, FileDown, MapPin, Moon, NotebookPen, Plane, PenLine, PlaneLanding, Plus, ScanSearch, ShieldCheck, Upload } from "lucide-react";
import { SignManyModal } from "@/components/app/Signature";
import { useAccess } from "@/lib/access";
import { useAirports } from "@/lib/airports";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PRIVATE_OPERATOR, TRAINING_OPERATOR, operatorIndex, sumFlights } from "@cielo/core";
import { Link, useRouter } from "@/i18n/navigation";
import { Card, Empty, Overlay, PageTitle, useToast } from "@/components/app/ui";
import { setOperator as assignOperator } from "@/lib/repo";
import { useAirlineDirectory } from "@/lib/airlines";
import { OperatorInput } from "@/components/app/OperatorInput";
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
  const tm = useTranslations("app.mysig");
  const access = useAccess();
  const [signMany, setSignMany] = useState(false);
  const flights = useFlights();
  const d = useDuration();
  const fd = useFormatDate();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [year, setYear] = useState("");
  const [type, setType] = useState("");
  const [operator, setOperator] = useState("");
  // simulator sessions hidden (remembered on this device)
  const [hideSim, setHideSim] = useState(false);
  useEffect(() => {
    try {
      setHideSim(localStorage.getItem("gd:hide-sim") === "1");
    } catch {}
  }, []);
  const toggleSim = (v: boolean) => {
    setHideSim(v);
    try {
      localStorage.setItem("gd:hide-sim", v ? "1" : "0");
    } catch {}
  };
  // a link from the CV opens the logbook on the flights without an operator, ready to assign
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("operator");
    if (q) {
      setOperator(q);
      setSelecting(true);
    }
  }, []);
  const aircraft = useTable("aircraft");
  const airlines = useAirlineDirectory();
  const ops = useMemo(() => operatorIndex(flights ?? [], aircraft ?? [], airlines), [flights, aircraft, airlines]);

  const years = useMemo(() => [...new Set((flights ?? []).map((f) => f.date.slice(0, 4)))].sort().reverse(), [flights]);
  const types = useMemo(() => [...new Set((flights ?? []).map((f) => (f.isFstd ? "FSTD" : f.aircraftTypeIcao ?? "")).filter(Boolean))].sort(), [flights]);
  const filtered = useMemo(() => {
    const s = q.trim().toUpperCase();
    return (flights ?? []).filter(
      (f) =>
        (!year || f.date.startsWith(year)) &&
        (!type || (type === "FSTD" ? f.isFstd : f.aircraftTypeIcao === type)) &&
        (!operator || (operator === "-" ? !ops.of(f) : ops.of(f) === operator)) &&
        !(hideSim && f.isFstd) &&
        (!s || [f.depIcao, f.arrIcao, f.registration, f.aircraftTypeIcao, f.flightNumber, f.remarks, f.picName, f.fstdType, ops.of(f)].some((x) => x?.toUpperCase().includes(s))),
    );
  }, [flights, q, year, type, operator, ops, hideSim]);
  const totals = useMemo(() => sumFlights(filtered), [filtered]);
  const [limit, setLimit] = useState(100);
  const airports = useAirports();
  // selection, to give flights their operator in one go
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [assignTo, setAssignTo] = useState("");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  /** Every flight shown between two dates (both included), added to the selection. */
  const pickRange = () => {
    const from = rangeFrom || "0000-01-01";
    const to = rangeTo || "9999-12-31";
    setPicked((p) => new Set([...p, ...filtered.filter((f) => f.date >= from && f.date <= to).map((f) => f.id)]));
  };
  const { toast, toastNode } = useToast();
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const open = (id: string) => (selecting ? toggle(id) : router.push({ pathname: "/app/carnet/[id]", params: { id } }));
  const stopSelecting = () => (setSelecting(false), setPicked(new Set()), setAssignTo(""), setRangeFrom(""), setRangeTo(""));
  const assign = async (to = assignTo) => {
    const n = picked.size;
    await assignOperator([...picked], to || undefined);
    toast(to ? t("assign.done", { count: n, operator: opLabel(to)! }) : t("assign.cleared", { count: n }));
    stopSelecting();
  };
  /** "Private" and "Training" are stored as such and shown in the pilot's language */
  const opLabel = (op?: string) => (op === PRIVATE_OPERATOR ? t("op.private") : op === TRAINING_OPERATOR ? t("op.training") : op);
  const unassigned = useMemo(() => (flights ?? []).filter((f) => !f.deletedAt && !f.isFstd && !ops.of(f)).length, [flights, ops]);
  // dismissed: hidden until more flights without an operator come in (private, training… stay as they are)
  const [dismissedAt, setDismissedAt] = useState(0);
  useEffect(() => {
    try {
      setDismissedAt(Number(localStorage.getItem("gd:unassigned-dismissed")) || 0);
    } catch {}
  }, []);
  const dismiss = () => {
    setDismissedAt(unassigned);
    try {
      localStorage.setItem("gd:unassigned-dismissed", String(unassigned));
    } catch {}
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
      <SignManyModal open={signMany} onClose={() => setSignMany(false)} flights={flights ?? []} />
      <PageTitle
        title={t("title")}
        subtitle={t("flightCount", { count: filtered.length })}
        actions={
          <>
            <Link href="/app/carnet/import" className="btn btn-secondary btn-sm"><Upload size={15} /> {t("import")}</Link>
            <Link href="/app/carnet/export" className="btn btn-secondary btn-sm"><FileDown size={15} /> {t("export")}</Link>
            {access.has("signature") ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSignMany(true)}><PenLine size={15} /> {tm("signMine")}</button>
            ) : null}
            <Link href="/app/carnet/audit" className="btn btn-secondary btn-sm"><ScanSearch size={15} /> {t("audit")}</Link>
            <Link href="/app/carnet/report" className="btn btn-secondary btn-sm"><BookCopy size={15} /> {t("carry")}</Link>
            <Link href="/app/carnet/nouveau" className="btn btn-primary btn-sm"><Plus size={15} /> {tn("newFlight")}</Link>
          </>
        }
      />
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_170px_160px_200px_auto]">
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
          {ops.all.map((o) => <option key={o} value={o}>{opLabel(o)}</option>)}
          <option value="-">{t("noOperator")}</option>
        </select>
        <button type="button" className={`btn btn-sm h-full ${selecting ? "btn-primary" : "btn-secondary"}`} onClick={() => (selecting ? stopSelecting() : setSelecting(true))}>
          <ListChecks size={15} /> {selecting ? t("assign.stop") : t("assign.start")}
        </button>
      </div>

      <label className="-mt-2 mb-4 flex w-fit cursor-pointer items-center gap-2 text-sm text-muted hover:text-text">
        <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={hideSim} onChange={(e) => toggleSim(e.target.checked)} />
        {t("hideSim")}
      </label>

      {/* flights without an operator: the CV cannot place them */}
      {unassigned > dismissedAt && operator !== "-" && (
        <div className="relative mb-4">
        <button
          type="button"
          onClick={() => (setOperator("-"), setSelecting(true))}
          className="flex w-full items-center gap-3 rounded-2xl border border-caution/40 bg-caution/10 py-3 pl-4 pr-12 text-left transition hover:bg-caution/15"
        >
          <Building2 size={18} className="shrink-0 text-caution" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{t("unassigned.title", { n: unassigned })}</span>
            <span className="block text-xs text-muted">{t("unassigned.why")}</span>
          </span>
          <span className="btn btn-sm shrink-0 border border-caution/50 text-caution">{t("unassigned.go")}</span>
        </button>
        <button type="button" onClick={dismiss} aria-label={t("unassigned.dismiss")} title={t("unassigned.dismiss")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted hover:bg-caution/15 hover:text-text">
          <X size={16} />
        </button>
        </div>
      )}

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
                    <h2 className="text-[17px] font-bold capitalize tracking-tight">{m.label}</h2>
                    <p className="num flex items-center gap-4 text-xs text-muted">
                      <span>{t("flightCount", { count: m.flights.length })}</span>
                      {m.night > 0 && <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-300"><Moon size={11} /> {d(m.night)}</span>}
                      <span className="rounded-md bg-accent/12 px-2 py-0.5 text-sm font-bold text-accent">{d(m.total)}</span>
                    </p>
                  </header>
                  <ul>
                    {m.flights.map((f) => {
                      const dep = airports?.get(f.depIcao);
                      const arr = airports?.get(f.arrIcao);
                      const op = opLabel(ops.of(f));
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
                                <span className="grid grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)] items-center gap-3">
                                  <span className="min-w-0">
                                    <span className="num block text-[17px] font-bold tracking-wide">{f.depIcao}</span>
                                    <span className="block truncate text-[11px] text-muted" title={dep?.name}>{dep ? airports?.shortName(f.depIcao) : ""}</span>
                                  </span>
                                  <span className="logbook-line relative h-px w-full" aria-hidden>
                                    <Plane size={13} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45 text-accent" />
                                  </span>
                                  <span className="min-w-0">
                                    <span className="num block text-[17px] font-bold tracking-wide">{f.arrIcao}</span>
                                    <span className="block truncate text-[11px] text-muted" title={arr?.name}>{arr ? airports?.shortName(f.arrIcao) : ""}</span>
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
        <div className="fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-4xl flex-wrap items-center gap-2 rounded-2xl border border-white/15 bg-[#061226]/95 p-3 text-white shadow-[0_30px_80px_-20px_rgba(0,0,0,.8)] backdrop-blur-xl lg:bottom-6">
          <span className="num px-1 text-sm font-semibold">{t("assign.picked", { count: picked.size })}</span>
          <button type="button" className="text-xs font-semibold text-white/70 underline hover:text-white" onClick={() => setPicked(new Set(filtered.map((f) => f.id)))}>
            {t("assign.all", { count: filtered.length })}
          </button>
          <span className="flex items-center gap-1.5 text-xs text-white/70">
            <CalendarRange size={14} className="shrink-0 text-white/60" />
            <input type="date" className="input num h-9 w-[9.5rem] !bg-white/10 !text-white" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} aria-label={t("assign.from")} />
            →
            <input type="date" className="input num h-9 w-[9.5rem] !bg-white/10 !text-white" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} aria-label={t("assign.to")} />
            <button type="button" className="btn btn-secondary btn-sm" disabled={!rangeFrom && !rangeTo} onClick={pickRange}>{t("assign.range")}</button>
          </span>
          <span className="flex min-w-48 flex-1 items-center gap-2">
            <Building2 size={15} className="shrink-0 text-white/60" />
            <OperatorInput value={assignTo} onChange={setAssignTo} known={ops.all} placeholder={t("assign.placeholder")} className="h-9 !bg-white/10 !text-white" up dark />
          </span>
          <span className="flex items-center gap-1.5">
            {[PRIVATE_OPERATOR, TRAINING_OPERATOR].map((x) => (
              <button key={x} type="button" className="btn btn-sm border border-white/20 !text-white/85 hover:border-white/50" disabled={!picked.size} onClick={() => void assign(x)}>
                {opLabel(x)}
              </button>
            ))}
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
