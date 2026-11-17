"use client";

import { ChevronDown, ChevronRight, Download, FileSpreadsheet } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import * as FLAGS from "country-flag-icons/string/3x2";
import { countryName, layoverStays, nightsByCountry, type Flight } from "@cielo/core";
import { Card } from "./ui";
import { downloadBlob } from "@/lib/download";
import { useFormatDate } from "@/lib/hooks";

/** A round flag: the 3:2 flag cropped to a circle (cover), as SVG, so it renders the same everywhere. */
function Flag({ code }: { code: string }) {
  const svg = (FLAGS as Record<string, string>)[code];
  if (!svg) return <span className="inline-block h-5 w-5 rounded-full bg-surface-2" aria-hidden />;
  const src = `data:image/svg+xml;utf8,${encodeURIComponent(svg.replace("<svg ", '<svg preserveAspectRatio="xMidYMid slice" '))}`;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={20} height={20} className="h-5 w-5 shrink-0 rounded-full object-cover ring-1 ring-black/10" />;
}

/** Nights on layover per country and year, from the logbook (for the "frais réels" of the tax return). */
export function LayoverNights({ flights, homeBase, countryOf }: { flights: Flight[]; homeBase?: string; countryOf: (icao: string) => string | undefined }) {
  const t = useTranslations("app.nights");
  const locale = useLocale();
  const fd = useFormatDate();
  const now = new Date();
  const years = [0, 1, 2].map((k) => now.getUTCFullYear() - k);
  const [year, setYear] = useState(now.getUTCFullYear() - (now.getUTCMonth() < 6 ? 1 : 0));
  const [open, setOpen] = useState<string | null>(null);
  const stays = useMemo(() => layoverStays(flights, homeBase, countryOf), [flights, homeBase, countryOf]);
  const r = useMemo(() => nightsByCountry(stays, year), [stays, year]);
  const cname = (c: string) => (c === "??" ? t("unknown") : countryName(c, locale));

  const exportCsv = () => {
    const lines = [
      [t("country"), t("nightsCol"), t("staysCol"), t("airportsCol")].join(";"),
      ...r.countries.map((x) => [cname(x.country), x.nights, x.stays, x.airports.join(" ")].join(";")),
      "",
      [t("airportsCol"), t("country"), t("fromCol"), t("toCol"), t("nightsCol")].join(";"),
      ...r.stays.map((s) => [s.airport, cname(s.country), s.from, s.to, s.nights].join(";")),
    ];
    downloadBlob("﻿" + lines.join("\r\n"), `geardown-${locale.startsWith("fr") ? "nuitees-escale" : "layover-nights"}-${year}.csv`, "text/csv;charset=utf-8");
  };

  const exportXlsx = async () => {
    const { buildXlsx } = await import("@cielo/export");
    const bytes = buildXlsx([
      { name: t("sheetCountries"), header: true, widths: [28, 10, 10, 40], rows: [[t("country"), t("nightsCol"), t("staysCol"), t("airportsCol")], ...r.countries.map((x) => [cname(x.country), x.nights, x.stays, x.airports.join(", ")]), [t("totalCol"), r.total, r.stays.length, ""]] },
      { name: t("sheetStays"), header: true, widths: [12, 28, 14, 14, 8], rows: [[t("airportsCol"), t("country"), t("fromCol"), t("toCol"), t("nightsCol")], ...r.stays.map((s) => [s.airport, cname(s.country), s.from, s.to, s.nights])] },
    ]);
    downloadBlob(bytes as BlobPart, `geardown-${locale.startsWith("fr") ? "nuitees-escale" : "layover-nights"}-${year}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  };

  return (
    <Card title={t("title")}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {years.map((y) => (
            <button key={y} type="button" className={`btn btn-sm ${y === year ? "btn-primary" : "btn-ghost"}`} onClick={() => setYear(y)}>
              {y}
            </button>
          ))}
        </div>
        {r.countries.length > 0 && (
          <span className="flex gap-1.5">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void exportXlsx()}>
              <FileSpreadsheet size={14} /> Excel
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={exportCsv}>
              <Download size={14} /> CSV
            </button>
          </span>
        )}
      </div>
      {!homeBase && <p className="mb-2 text-sm text-[var(--caution)]">{t("noBase")}</p>}
      <p className="text-sm text-muted">{t("how", { base: homeBase ?? "—" })}</p>
      <p className="num mt-3 text-2xl font-semibold">{t("totalLine", { n: r.total, c: r.countries.length })}</p>
      {r.countries.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{t("empty")}</p>
      ) : (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted [&>th]:py-1.5">
              <th>{t("country")}</th>
              <th className="!text-right">{t("nightsCol")}</th>
              <th className="!text-right">{t("staysCol")}</th>
              <th className="pl-4">{t("airportsCol")}</th>
            </tr>
          </thead>
          <tbody>
            {r.countries.map((x) => {
              const isOpen = open === x.country;
              return (
                <Fragment key={x.country}>
                  <tr
                    className="cursor-pointer border-t border-border align-top hover:bg-surface-2 [&>td]:py-1.5"
                    onClick={() => setOpen(isOpen ? null : x.country)}
                    aria-expanded={isOpen}
                  >
                    <td className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        {isOpen ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
                        <Flag code={x.country} />
                        {cname(x.country)}
                      </span>
                    </td>
                    <td className="num text-right font-semibold">{x.nights}</td>
                    <td className="num text-right">{x.stays}</td>
                    <td className="num pl-4 text-xs text-muted">{x.airports.join(", ")}</td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-surface-2/60">
                      <td colSpan={4} className="px-3 py-2">
                        <div className="animate-[unroll_220ms_ease-out] origin-top overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-muted [&>th]:py-1 [&>th]:font-medium">
                              <th>{t("airportsCol")}</th>
                              <th>{t("fromCol")}</th>
                              <th>{t("toCol")}</th>
                              <th className="!text-right">{t("nightsCol")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.stays
                              .filter((st) => st.country === x.country)
                              .map((st) => (
                                <tr key={`${st.airport}${st.from}`} className="border-t border-border/60 [&>td]:py-1">
                                  <td className="num font-semibold">{st.airport}</td>
                                  <td className="num">{fd(st.from)}</td>
                                  <td className="num">{fd(st.to)}</td>
                                  <td className="num text-right">{st.nights}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="mt-3 text-xs text-muted">{t("note")}</p>
    </Card>
  );
}
