"use client";

import { Download, FileSpreadsheet } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { countryName, layoverStays, nightsByCountry, type Flight } from "@cielo/core";
import { Card } from "./ui";
import { downloadBlob } from "@/lib/download";
import { useFormatDate } from "@/lib/hooks";

/** Nights on layover per country and year, from the logbook (for the "frais réels" of the tax return). */
export function LayoverNights({ flights, homeBase, countryOf }: { flights: Flight[]; homeBase?: string; countryOf: (icao: string) => string | undefined }) {
  const t = useTranslations("app.nights");
  const locale = useLocale();
  const fd = useFormatDate();
  const now = new Date();
  const years = [0, 1, 2].map((k) => now.getUTCFullYear() - k);
  const [year, setYear] = useState(now.getUTCFullYear() - (now.getUTCMonth() < 6 ? 1 : 0));
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
    downloadBlob("﻿" + lines.join("\r\n"), `geardown-nuitees-escale-${year}.csv`, "text/csv;charset=utf-8");
  };

  const exportXlsx = async () => {
    const { buildXlsx } = await import("@cielo/export");
    const bytes = buildXlsx([
      { name: t("sheetCountries"), header: true, widths: [28, 10, 10, 40], rows: [[t("country"), t("nightsCol"), t("staysCol"), t("airportsCol")], ...r.countries.map((x) => [cname(x.country), x.nights, x.stays, x.airports.join(", ")]), [t("totalCol"), r.total, r.stays.length, ""]] },
      { name: t("sheetStays"), header: true, widths: [12, 28, 14, 14, 8], rows: [[t("airportsCol"), t("country"), t("fromCol"), t("toCol"), t("nightsCol")], ...r.stays.map((s) => [s.airport, cname(s.country), s.from, s.to, s.nights])] },
    ]);
    downloadBlob(bytes as BlobPart, `geardown-nuitees-escale-${year}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
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
            {r.countries.map((x) => (
              <tr key={x.country} className="border-t border-border align-top [&>td]:py-1.5">
                <td className="font-medium">{cname(x.country)}</td>
                <td className="num text-right font-semibold">{x.nights}</td>
                <td className="num text-right">{x.stays}</td>
                <td className="num pl-4 text-xs text-muted" title={r.stays.filter((s) => s.country === x.country).map((s) => `${s.airport} ${fd(s.from)} → ${fd(s.to)} (${s.nights})`).join("\n")}>
                  {x.airports.join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-3 text-xs text-muted">{t("note")}</p>
    </Card>
  );
}
