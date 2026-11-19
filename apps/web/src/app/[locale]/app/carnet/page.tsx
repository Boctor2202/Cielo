"use client";

import { FileDown, Moon, NotebookPen, Plane, Plus, ScanSearch, ShieldCheck, Upload, BookCopy } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { operatorIndex, sumFlights } from "@cielo/core";
import { Link, useRouter } from "@/i18n/navigation";
import { Card, Empty, PageTitle } from "@/components/app/ui";
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
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_160px_160px_200px]">
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
      </div>

      <Card pad={false}>
        {flights && filtered.length === 0 ? (
          <Empty icon={<NotebookPen size={36} />} text={t("empty")} />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left">
                  <tr className="[&>th]:label-caps [&>th]:px-3 [&>th]:py-2.5">
                    <th>{t("date")}</th>
                    <th>{t("route")}</th>
                    <th>{t("times")}</th>
                    <th>{t("aircraft")}</th>
                    <th>{t("function")}</th>
                    <th className="!text-right">{t("total")}</th>
                    <th className="!text-right">{t("night")}</th>
                    <th className="!text-right">{t("ifr")}</th>
                    <th className="!text-right">{t("ldg")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.slice(0, limit).map((f) => (
                    <tr
                      key={f.id}
                      className="group cursor-pointer transition-colors hover:bg-accent/[0.06] [&>td]:px-3 [&>td]:py-2.5"
                      onClick={() => router.push({ pathname: "/app/carnet/[id]", params: { id: f.id } })}
                    >
                      <td className="num whitespace-nowrap">
                        {/* a coloured edge: night flights indigo, IFR sky, VFR green, simulator violet */}
                        <span className={`mr-2.5 inline-block h-6 w-1 rounded-full align-middle ${f.isFstd ? "bg-violet-400" : f.nightMin > 0 ? "bg-indigo-400" : f.ifrMin > 0 ? "bg-sky-400" : "bg-emerald-400"}`} aria-hidden />
                        {fd(f.date, { day: "2-digit", month: "2-digit", year: "2-digit" })}
                      </td>
                      <td className="num whitespace-nowrap font-semibold">
                        {f.isFstd ? (
                          <span className="rounded-md bg-violet-500/15 px-2 py-0.5 text-violet-700 dark:text-violet-300">{t("fstd")}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            {f.depIcao}
                            <Plane size={12} className="text-accent" aria-hidden />
                            {f.arrIcao}
                          </span>
                        )}
                      </td>
                      <td className="num whitespace-nowrap text-muted">{f.isFstd ? f.fstdType : `${f.outUtc?.slice(11, 16) ?? "--"} – ${f.inUtc?.slice(11, 16) ?? "--"}`}</td>
                      <td className="whitespace-nowrap">
                        {f.registration ? <span className="num rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[12.5px] font-semibold">{f.registration}</span> : null}{" "}
                        <span className="num text-[12.5px] text-muted">{f.aircraftTypeIcao}</span>
                      </td>
                      <td className="whitespace-nowrap" title={tfn(f.function)}>
                        <span className={`num rounded-full px-2 py-0.5 text-[12px] font-semibold ${FUNCTION_TONE[f.function] ?? "bg-surface-2 text-muted"}`}>{f.function}</span>
                      </td>
                      <td className="num text-right">
                        <span className="rounded-md bg-accent/12 px-2 py-0.5 font-bold text-accent">{d(f.isFstd ? f.fstdMin : f.totalMin)}</span>
                      </td>
                      <td className="num text-right">
                        {f.nightMin > 0 ? (
                          <span className="inline-flex items-center gap-1 text-indigo-700 dark:text-indigo-300">
                            <Moon size={12} aria-hidden />
                            {d(f.nightMin, true)}
                          </span>
                        ) : null}
                      </td>
                      <td className="num text-right">
                        {f.ifrMin > 0 ? <span className="rounded-md bg-sky-500/12 px-1.5 py-0.5 text-sky-700 dark:text-sky-300">{d(f.ifrMin, true)}</span> : null}
                      </td>
                      <td className="num text-right text-muted">{f.landingsDay + f.landingsNight || ""}</td>
                      <td className="w-6">{f.signatureId && <ShieldCheck size={15} className="text-success" aria-label={t("signed")} />}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-border bg-surface-2/60 font-semibold">
                  <tr className="[&>td]:px-3 [&>td]:py-2.5">
                    <td colSpan={5}>{t("pageTotal")}</td>
                    <td className="num text-right">{d(totals.totalMin)}</td>
                    <td className="num text-right">{d(totals.nightMin)}</td>
                    <td className="num text-right">{d(totals.ifrMin)}</td>
                    <td className="num text-right">{totals.landingsDay + totals.landingsNight}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            {/* Mobile list */}
            <ul className="divide-y divide-border md:hidden">
              {filtered.slice(0, limit).map((f) => (
                <li key={f.id}>
                  <Link href={{ pathname: "/app/carnet/[id]", params: { id: f.id } }} className="flex items-center justify-between gap-3 px-4 py-3">
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
    </>
  );
}
