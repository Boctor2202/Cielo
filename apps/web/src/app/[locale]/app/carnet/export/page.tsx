"use client";

import { FileDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { openingTotals } from "@cielo/core";
import { frameworkOf } from "@cielo/core";
import { buildLogbookPdf, flightsToCsv, flightsToRows, layoutForAuthority, TABULAR_HEADERS, type LayoutId } from "@cielo/export";
import { Card, Field, PageTitle, Toggle } from "@/components/app/ui";
import { useFlights, usePilot, useTable } from "@/lib/hooks";
import { downloadBlob } from "@/lib/download";
import { track } from "@/lib/metrics";

type Format = LayoutId | "csv" | "xlsx";

export default function ExportPage() {
  const t = useTranslations("app.export");
  const flights = useFlights();
  const balances = useTable("opening_balances");
  const pilot = usePilot();
  // the logbook layout of the pilot's authority comes first and is chosen by default
  const mine: LayoutId = pilot ? layoutForAuthority(pilot.authority, frameworkOf(pilot)) : "EASA";
  const [picked, setFormat] = useState<Format | null>(null);
  const format: Format = picked ?? mine;
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [opening, setOpening] = useState(true);
  const [decimal, setDecimal] = useState(false);
  const [busy, setBusy] = useState(false);

  const selected = useMemo(() => (flights ?? []).filter((f) => (!from || f.date >= from) && (!to || f.date <= to)), [flights, from, to]);

  async function generate() {
    setBusy(true);
    const stamp = new Date().toISOString().slice(0, 10);
    const name = `geardown-logbook-${stamp}`;
    try {
      if (format === "csv") {
        downloadBlob(flightsToCsv(selected, { decimal }), `${name}.csv`, "text/csv;charset=utf-8");
        track("export");
      } else if (format === "xlsx") {
        const { default: writeXlsxFile } = await import("write-excel-file/browser");
        const data = [[...TABULAR_HEADERS].map((h) => ({ value: h, fontWeight: "bold" as const })), ...flightsToRows(selected, { decimal }).map((r) => r.map((v) => ({ value: v === "" ? null : v })))];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const blob = (await writeXlsxFile(data as any, { sheet: "Logbook" }).toBlob?.()) as Blob | undefined;
        if (blob) downloadBlob(blob, `${name}.xlsx`, blob.type);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        else await (writeXlsxFile as any)(data, { fileName: `${name}.xlsx`, sheet: "Logbook" });
      } else {
        // Flights before the selected period are carried forward with the paper totals.
        const before = from ? (flights ?? []).filter((f) => f.date < from) : [];
        const base = opening ? openingTotals(balances ?? []) : openingTotals([]);
        const { sumFlights } = await import("@cielo/core");
        const bytes = await buildLogbookPdf(selected, {
          layout: format as LayoutId,
          pilotName: pilot?.fullName || "—",
          licenceNumber: pilot?.licenceNumber,
          periodLabel: from || to ? `${from || "…"} → ${to || "…"}` : "All time",
          opening: sumFlights(before, base),
          locale: pilot?.locale ?? "fr",
          holderDetails: format === "HKCAD" && pilot?.employer ? [["Employer", pilot.employer]] : undefined,
        });
        downloadBlob(bytes as BlobPart, `${name}-${format}.pdf`, "application/pdf");
        track("export");
      }
    } finally {
      setBusy(false);
    }
  }

  const LAYOUT_ORDER: LayoutId[] = ["EASA", "UK", "FAA", "CASA", "TCCA", "SACAA", "HKCAD"];
  const formats: { v: Format; label: string }[] = [
    ...[mine, ...LAYOUT_ORDER.filter((l) => l !== mine)].map((l) => ({ v: l as Format, label: t(`pdf.${l}`) + (l === mine ? ` · ${t("pdfMine")}` : "") })),
    { v: "csv", label: t("csv") },
    { v: "xlsx", label: t("xlsx") },
  ];

  return (
    <>
      <PageTitle title={t("title")} subtitle={t("notice")} />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card title={t("format")}>
          <div className="grid gap-2 sm:grid-cols-2">
            {formats.map((f) => (
              <label key={f.v} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${format === f.v ? "border-accent bg-accent/8" : "border-border hover:border-accent/50"}`}>
                <input type="radio" name="format" className="accent-[var(--accent)]" checked={format === f.v} onChange={() => setFormat(f.v)} />
                {f.label}
              </label>
            ))}
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label={useTranslations("common")("from")}><input type="date" className="input num" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label={useTranslations("common")("to")}><input type="date" className="input num" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          </div>
          <div className="mt-5 space-y-3">
            {["EASA", "FAA", "CASA"].includes(format) && <Toggle checked={opening} onChange={setOpening} label={t("includeOpening")} />}
            {["csv", "xlsx"].includes(format) && <Toggle checked={decimal} onChange={setDecimal} label={t("decimal")} />}
          </div>
        </Card>
        <div className="card self-start p-5">
          <p className="label-caps">{t("period")}</p>
          <p className="num mt-2 text-3xl font-semibold">{selected.length}</p>
          <p className="text-sm text-muted">{t("count", { count: selected.length })}</p>
          <button type="button" className="btn btn-primary mt-5 w-full" disabled={busy || !flights} onClick={generate}>
            <FileDown size={17} /> {busy ? t("generating") : t("generate")}
          </button>
        </div>
      </div>
    </>
  );
}
