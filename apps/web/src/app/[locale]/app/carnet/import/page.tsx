"use client";

import { CalendarDays, Camera, FileSpreadsheet, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  analyseTable, checkMapping, IMPORT_FIELDS, legsToRows, parseCsv, rowsToFlights, type DateOrder, type ImportField, type ImportedRow, type LogbookLeg,
} from "@cielo/core";
import { apiFetch } from "@/lib/report";
import { Link } from "@/i18n/navigation";
import { Card, Field, PageTitle, Segmented, useToast } from "@/components/app/ui";
import { useAirports } from "@/lib/airports";
import { logImported, buildFlight, flightKey } from "@/lib/repo";
import { db } from "@/lib/db";
import { parseOcrText } from "@/lib/ocr";
import { DropZone } from "@/components/app/DropZone";
import { Paywall, useAccess } from "@/lib/access";

type Tab = "file" | "roster" | "scan";

export default function ImportPage() {
  const t = useTranslations("app.import");
  const access = useAccess();
  const [tab, setTab] = useState<Tab>("file");
  return (
    <>
      <PageTitle title={t("title")} />
      <div className="mb-5">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "file", label: <span className="flex items-center gap-1.5"><FileSpreadsheet size={14} /> {t("tabs.file")}</span> },
            { value: "roster", label: <span className="flex items-center gap-1.5"><CalendarDays size={14} /> {t("tabs.roster")}</span> },
            { value: "scan", label: <span className="flex items-center gap-1.5"><Camera size={14} /> {t("tabs.scan")}</span> },
          ]}
        />
      </div>
      {tab === "file" && <FileImport />}
      {tab === "roster" && (
        <Card>
          <p className="text-muted">{t("rosterHelp")}</p>
          <Link href="/app/roster" className="btn btn-primary mt-4">{t("goRoster")}</Link>
        </Card>
      )}
      {tab === "scan" && (access.has("scan") ? <ScanImport /> : <Paywall feature="scan" />)}
    </>
  );
}

async function readTable(file: File): Promise<string[][]> {
  if (/\.xlsx?$/i.test(file.name)) {
    const { readSheet } = await import("read-excel-file/browser");
    const rows = (await readSheet(file)) as unknown[][];
    return rows.map((r) =>
      r.map((c: unknown) => {
        if (c instanceof Date) {
          // Excel times arrive as dates on 1899-12-30 — keep the clock part only.
          return c.getUTCFullYear() < 1901 ? c.toISOString().slice(11, 16) : c.toISOString().slice(0, 10);
        }
        return c === null || c === undefined ? "" : String(c);
      }),
    );
  }
  return parseCsv(await file.text());
}

function FileImport() {
  const t = useTranslations("app.import");
  const airports = useAirports();
  const { toast, toastNode } = useToast();
  const [rows, setRows] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<Record<ImportField, number> | null>(null);
  const [order, setOrder] = useState<DateOrder>("dmy");
  const [app, setApp] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  // a logbook statement in PDF (Air France EP5…): legs read on the server
  const [pdfRows, setPdfRows] = useState<ImportedRow[] | null>(null);
  const [pdfState, setPdfState] = useState<string | null>(null);
  const tableRows = useMemo<ImportedRow[]>(() => (rows && mapping ? rowsToFlights(rows.slice(1), mapping, { dateOrder: order }) : []), [rows, mapping, order]);
  const parsed = pdfRows ?? tableRows;
  const recognised = mapping ? Object.values(mapping).filter((i) => i >= 0).length : 0;
  // cross-checks on the data itself, recomputed whenever a column is changed by hand
  const checks = useMemo(() => (rows && mapping ? checkMapping(rows.slice(1), mapping) : []), [rows, mapping]);
  const doubtful = new Set(checks.map((c) => c.field));
  const unused = useMemo(() => {
    if (!rows || !mapping) return [];
    const used = new Set(Object.values(mapping));
    return rows[0]!.filter((h, i) => h && !used.has(i) && rows.slice(1).some((r) => (r[i] ?? "").trim()));
  }, [rows, mapping]);
  const ok = parsed.filter((r) => r.errors.length === 0 && r.input);

  async function onPdf(file: File) {
    setRows(null);
    setMapping(null);
    setPdfRows(null);
    setPdfState("reading");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const r = await apiFetch("/api/logbook-pdf", { method: "POST", body: JSON.stringify({ pdf: btoa(bin) }) });
      const d = (await r.json().catch(() => ({}))) as { legs?: LogbookLeg[]; role?: string | null; reader?: string; error?: string };
      if (!r.ok || !d.legs) return setPdfState(d.error ?? "error");
      const role = d.role === "CDB" || d.role === "CDT" ? "PIC" : "SIC";
      setPdfRows(legsToRows(d.legs, (c) => airports?.get(c)?.icao, { function: role, pilotFlying: false }));
      setApp(d.reader === "airfrance-ep5" ? "Air France · Carnet de vol EP5" : undefined);
      setPdfState(null);
    } catch {
      setPdfState("error");
    }
  }

  async function onFile(file: File) {
    if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") return onPdf(file);
    setPdfRows(null);
    setPdfState(null);
    // header row, two-row headers, columns (names + values) and date order are all detected automatically
    const a = analyseTable(await readTable(file));
    setRows([a.header, ...a.rows]);
    setMapping(a.mapping);
    setOrder(a.dateOrder);
    setApp(a.app);
  }

  async function run() {
    if (!airports) return;
    setBusy(true);
    // flights already in the logbook (or twice in the file) are skipped: importing the same file again adds nothing
    const seen = new Set((await db().t("flights").toArray()).filter((f) => !f.deletedAt).map(flightKey));
    const built = [];
    let skipped = 0;
    for (const r of ok) {
      const f = await buildFlight(r.input!, airports, { source: "import", explicit: r.explicit });
      if (seen.has(flightKey(f))) skipped++;
      else {
        seen.add(flightKey(f));
        built.push(f);
      }
    }
    await db().t("flights").bulkPut(built);
    await logImported(built);
    setBusy(false);
    toast(t("done", { count: built.length }) + (skipped ? ` · ${t("skipped", { count: skipped })}` : ""));
    setRows(null);
    setMapping(null);
    setPdfRows(null);
  }

  return (
    <div className="space-y-5">
      <DropZone accept=".csv,.txt,.tsv,.xlsx,.pdf" onFile={onFile} label={t("drop")} />
      {pdfState && <p className={`mt-2 text-sm ${pdfState === "reading" ? "text-accent" : "text-[var(--warning)]"}`}>{t(`pdf.${["reading", "plan", "unauthorized", "rate_limited"].includes(pdfState) ? pdfState : "error"}`)}</p>}
      <p className="mt-2 text-xs text-muted">{t("fromApps")}</p>
      {app && (rows || pdfRows) && <p className="mt-2 text-sm font-semibold text-accent">{t("appRecognised", { app })}</p>}
      {rows && mapping && (
        <>
          <Card title={t("mapping")}>
            <p className="text-sm">{t("autoDetected", { count: recognised, total: rows[0]!.length })}</p>
            {checks.length > 0 && (
              <ul className="mt-3 space-y-1.5 rounded-xl bg-[var(--caution)]/12 p-3 text-sm">
                {checks.map((c) => (
                  <li key={c.field + c.issue}>⚠️ {t(`checks.${c.issue}`, { field: t(`fields.${c.field}`), pct: Math.round(c.ratio * 100) })}</li>
                ))}
              </ul>
            )}
            {unused.length > 0 && <p className="mt-2 text-xs text-muted">{t("unused", { cols: unused.join(", ") })}</p>}
            <details className="mt-3" open={checks.length > 0}>
            <summary className="cursor-pointer text-sm text-accent">{t("checkColumns")}</summary>
            <p className="mb-4 mt-3 text-sm text-muted">{t("mappingHelp")}</p>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {IMPORT_FIELDS.map((f) => (
                <Field key={f} label={doubtful.has(f) ? `⚠️ ${t(`fields.${f}`)}` : t(`fields.${f}`)}>
                  <select className={`input ${doubtful.has(f) ? "!border-[var(--caution)]" : ""}`} value={mapping[f]} onChange={(e) => setMapping({ ...mapping, [f]: Number(e.target.value) })}>
                    <option value={-1}>{t("ignore")}</option>
                    {rows[0]!.map((h, i) => (
                      <option key={i} value={i}>{h || `#${i + 1}`}</option>
                    ))}
                  </select>
                </Field>
              ))}
              <Field label={t("dateOrder")}>
                <select className="input" value={order} onChange={(e) => setOrder(e.target.value as DateOrder)}>
                  <option value="dmy">JJ/MM/AAAA</option>
                  <option value="mdy">MM/DD/YYYY</option>
                  <option value="ymd">YYYY-MM-DD</option>
                </select>
              </Field>
            </div>
            </details>
          </Card>
          <PreviewCard parsed={parsed} ok={ok.length} onImport={run} busy={busy || !airports} />
        </>
      )}
      {toastNode}
    </div>
  );
}

function PreviewCard({ parsed, ok, onImport, busy }: { parsed: ImportedRow[]; ok: number; onImport: () => void; busy: boolean }) {
  const t = useTranslations("app.import");
  return (
    <Card title={t("preview")} action={<span className="text-sm text-muted">{t("rowsOk", { ok, total: parsed.length })}</span>} pad={false}>
      <div className="max-h-96 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface text-left">
            <tr className="[&>th]:label-caps [&>th]:px-3 [&>th]:py-2">
              <th>#</th><th>{t("fields.date")}</th><th>{t("fields.dep")}</th><th>{t("fields.arr")}</th><th>{t("fields.out")}</th><th>{t("fields.in")}</th><th>{t("fields.registration")}</th><th>{t("fields.type")}</th><th>{t("fields.function")}</th><th>{t("errors")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {parsed.slice(0, 200).map((r) => (
              <tr key={r.rowIndex} className={`num [&>td]:px-3 [&>td]:py-1.5 ${r.errors.length ? "bg-warning/8 text-warning" : ""}`}>
                <td className="text-muted">{r.rowIndex + 2}</td>
                <td>{r.input?.date}</td><td>{r.input?.depIcao}</td><td>{r.input?.arrIcao}</td><td>{r.input?.out}</td><td>{r.input?.in}</td>
                <td>{r.input?.registration}</td><td>{r.input?.aircraftTypeIcao}</td><td>{r.input?.function}</td>
                <td>{r.errors.map((e) => t(`fields.${e === "route" ? "dep" : e === "times" ? "out" : "date"}`)).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border p-4 text-right">
        <button type="button" className="btn btn-primary" disabled={busy || ok === 0} onClick={onImport}>
          <Upload size={16} /> {t("importN", { count: ok })}
        </button>
      </div>
    </Card>
  );
}

function ScanImport() {
  const t = useTranslations("app.import");
  const airports = useAirports();
  const { toast, toastNode } = useToast();
  const [progress, setProgress] = useState<number | null>(null);
  const [parsed, setParsed] = useState<ImportedRow[] | null>(null);
  const [image, setImage] = useState<string | null>(null);

  async function onFile(file: File) {
    setImage(URL.createObjectURL(file));
    setProgress(0);
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng", 1, { logger: (m: { status: string; progress: number }) => m.status === "recognizing text" && setProgress(Math.round(m.progress * 100)) });
    const { data } = await worker.recognize(file);
    await worker.terminate();
    setProgress(null);
    setParsed(parseOcrText(data.text, (c) => !!airports?.get(c)));
  }

  async function run() {
    if (!airports || !parsed) return;
    const ok = parsed.filter((r) => !r.errors.length && r.input);
    const built = [];
    for (const r of ok) built.push(await buildFlight(r.input!, airports, { source: "scan", explicit: r.explicit }));
    await db().t("flights").bulkPut(built);
    await logImported(built);
    toast(t("done", { count: built.length }));
    setParsed(null);
  }

  return (
    <div className="space-y-5">
      <Card>
        <p className="text-sm text-muted">{t("scanHelp")} <span className="rounded bg-accent/12 px-1.5 text-xs font-semibold text-accent">{useTranslations("common")("beta")}</span></p>
        <div className="mt-4">
          <DropZone accept="image/*" onFile={onFile} label={t("scanChoose")} />
        </div>
        {progress !== null && <p className="mt-3 text-sm text-accent">{t("scanRunning", { progress })}</p>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {image && <img src={image} alt="" className="mt-4 max-h-64 rounded-lg border border-border object-contain" />}
      </Card>
      {parsed && (
        <>
          <p className="text-sm text-muted">{t("scanFound", { count: parsed.length })}</p>
          {parsed.length > 0 && <PreviewCard parsed={parsed} ok={parsed.filter((r) => !r.errors.length).length} onImport={run} busy={!airports} />}
        </>
      )}
      {toastNode}
    </div>
  );
}
