"use client";

import { DateInput } from "@/components/app/DateInput";
import { FileDown, PenLine } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { openingTotals } from "@cielo/core";
import { frameworkOf } from "@cielo/core";
import { buildLogbookPdf, flightsToCsv, flightsToRows, layoutForAuthority, TABULAR_HEADERS, type LayoutId } from "@cielo/export";
import { Card, Field, PageTitle, Toggle } from "@/components/app/ui";
import { useFlights, usePilot, useTable } from "@/lib/hooks";
import { downloadBlob } from "@/lib/download";
import { track } from "@/lib/metrics";
import { signaturesFor } from "@/lib/repo";
import { useAccess } from "@/lib/access";
import { Link } from "@/i18n/navigation";

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
  const access = useAccess();
  // the logbook signed by the holder with their saved signature (offered whenever they have one)
  const [holderSigns, setHolderSigns] = useState(true);
  const canSign = access.has("signature") && !!pilot?.signatureDataUrl;

  const selected = useMemo(() => (flights ?? []).filter((f) => (!from || f.date >= from) && (!to || f.date <= to)), [flights, from, to]);

  async function generate() {
    setBusy(true);
    const stamp = new Date().toISOString().slice(0, 10);
    const name = `geardown-logbook-${stamp}`;
    try {
      // the flights' signatures always go with the logbook
      const signatures = await signaturesFor(selected);
      if (format === "csv") {
        downloadBlob(flightsToCsv(selected, { decimal, signatures }), `${name}.csv`, "text/csv;charset=utf-8");
        track("export");
      } else if (format === "xlsx") {
        const { default: writeXlsxFile } = await import("write-excel-file/browser");
        const data = [[...TABULAR_HEADERS].map((h) => ({ value: h, fontWeight: "bold" as const })), ...flightsToRows(selected, { decimal, signatures }).map((r) => r.map((v) => ({ value: v === "" ? null : v })))];
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
          signatures,
          holderSignature: canSign && holderSigns ? { image: pilot!.signatureDataUrl!, date: new Date().toLocaleDateString("en-GB") } : undefined,
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
            <Field label={useTranslations("common")("from")}><DateInput className="input num" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label={useTranslations("common")("to")}><DateInput className="input num" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          </div>
          <div className="mt-5 space-y-3">
            {["EASA", "FAA", "CASA"].includes(format) && <Toggle checked={opening} onChange={setOpening} label={t("includeOpening")} />}
            {["csv", "xlsx"].includes(format) && <Toggle checked={decimal} onChange={setDecimal} label={t("decimal")} />}
          </div>
          {/* the holder signs the logbook they export */}
          {!["csv", "xlsx"].includes(format) && access.has("signature") ? (
            <div className="mt-5 rounded-xl border border-accent/40 bg-accent/5 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold"><PenLine size={16} className="text-accent" /> {t("signTitle")}</p>
              {canSign ? (
                <>
                  <p className="mt-1 text-xs text-muted">{t("signBody")}</p>
                  <div className="mt-3 flex items-center gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pilot!.signatureDataUrl!} alt="" className="h-12 rounded bg-white p-1" />
                    <Toggle checked={holderSigns} onChange={setHolderSigns} label={t("signToggle")} />
                  </div>
                </>
              ) : (
                <p className="mt-1 text-xs text-muted">
                  {t("signNone")}{" "}
                  <Link href="/app/profil" className="font-semibold text-accent underline">{t("signCreate")}</Link>
                </p>
              )}
            </div>
          ) : null}
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
