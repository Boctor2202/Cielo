"use client";

import { CalendarDays, Camera, FileSpreadsheet, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  analyseTable, checkMapping, IMPORT_FIELDS, legsToRows, mappingToTitles, mappingUsable, parseCsv, rowsToFlights, sheetCellText, titlesToMapping,
  type DateOrder, type ImportField, type ImportedRow, type LogbookLeg, type StoredMapping,
} from "@cielo/core";
import { apiFetch } from "@/lib/report";
import { Link } from "@/i18n/navigation";
import { Card, Field, PageTitle, Segmented, useToast } from "@/components/app/ui";
import { useAirports } from "@/lib/airports";
import { logImported, buildFlight, flightKey, softDelete } from "@/lib/repo";
import { db, localStore } from "@/lib/db";
import { announceGains } from "@/lib/gains";
import { useAirlineDirectory } from "@/lib/airlines";
import { checkImport, formatDuration, operatorIndex, type Flight, type ImportCheck } from "@cielo/core";
import { DropZone } from "@/components/app/DropZone";
import { Paywall, useAccess } from "@/lib/access";
import { track } from "@/lib/metrics";
import { useFormatDate } from "@/lib/hooks";

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
      {tab === "scan" && (access.has("scan") ? <FileImport photos /> : <Paywall feature="scan" />)}
    </>
  );
}

/** A photo made light enough to send: at most 2000 px on its long side, JPEG. */
async function shrinkImage(file: File): Promise<{ data: string; type: string }> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  const url = c.toDataURL("image/jpeg", 0.85);
  return { data: url.slice(url.indexOf(",") + 1), type: "image/jpeg" };
}

const b64 = async (file: File) => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

/** The universal import on the server: known readers first, then Claude. */
async function importAny(body: Record<string, unknown>) {
  const r = await apiFetch("/api/import-any", { method: "POST", body: JSON.stringify(body) });
  const d = (await r.json().catch(() => ({}))) as {
    legs?: LogbookLeg[];
    role?: string | null;
    reader?: string;
    source?: string;
    mapping?: StoredMapping;
    mappingIndex?: Record<string, number>;
    error?: string;
  };
  return r.ok ? d : { ...d, error: d.error ?? "error" };
}

/** Errors shown to the pilot with their own message (see app.import.pdf.*). */
class ImportFileError extends Error {}

async function readTable(file: File): Promise<string[][]> {
  // Excel 97-2003 (.xls) is a binary format the reader cannot open: ask for .xlsx or CSV rather than fail silently
  if (/\.xls$/i.test(file.name) || file.type === "application/vnd.ms-excel") throw new ImportFileError("xls");
  if (/\.xlsx$/i.test(file.name) || file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    const { readSheet } = await import("read-excel-file/browser");
    try {
      // Excel times arrive as dates on 1899-12-30: the clock part is kept (sheetCellText)
      return ((await readSheet(file)) as unknown[][]).map((r) => r.map(sheetCellText));
    } catch {
      throw new ImportFileError("unreadable");
    }
  }
  return parseCsv((await file.text()).replace(/^\uFEFF/, ""));
}

/** The universal import: a file, a PDF, photos (a paper logbook) or pasted text, in one place. */
function FileImport({ photos = false }: { photos?: boolean }) {
  const t = useTranslations("app.import");
  const airports = useAirports();
  const airlines = useAirlineDirectory();
  const { toast, toastNode } = useToast();
  const [rows, setRows] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<Record<ImportField, number> | null>(null);
  const [order, setOrder] = useState<DateOrder>("dmy");
  const [app, setApp] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  // a logbook statement in PDF (Air France EP5…): legs read on the server
  const [pdfRows, setPdfRows] = useState<ImportedRow[] | null>(null);
  const [pdfState, setPdfState] = useState<string | null>(null);
  // who read the document: "learned" (a layout confirmed before), "report", or what Claude saw
  const [source, setSource] = useState<string | null>(null);
  const [learned, setLearned] = useState(false);
  const [share, setShare] = useState(false);
  const [paste, setPaste] = useState("");
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

  /** A document read on the server (PDF, photos, pasted text): legs to review. */
  async function fromServer(body: Record<string, unknown>) {
    setRows(null);
    setMapping(null);
    setPdfRows(null);
    setSource(null);
    setPdfState("reading");
    try {
      // photos go in batches: a request stays under the server's 4.5 MB limit
      const images = body.kind === "images" ? (body.images as { data: string; type: string }[]) : null;
      let d: Awaited<ReturnType<typeof importAny>>;
      if (images) {
        const legs: LogbookLeg[] = [];
        let batch: typeof images = [];
        let size = 0;
        let last: typeof d = {};
        const flush = async () => {
          if (!batch.length) return;
          last = await importAny({ ...body, images: batch, share });
          if (last.error) throw new Error(last.error);
          legs.push(...(last.legs ?? []));
          batch = [];
          size = 0;
        };
        for (const im of images) {
          if (size + im.data.length > 3_300_000) await flush();
          batch.push(im);
          size += im.data.length;
        }
        await flush();
        d = { ...last, legs };
      } else d = await importAny({ ...body, share });
      if (d.error || !d.legs) return setPdfState(d.error ?? "error");
      const role = d.role === "CDB" || d.role === "CDT" ? "PIC" : "SIC";
      setPdfRows(legsToRows(d.legs, (c) => airports?.get(c)?.icao, { function: role, pilotFlying: false }));
      setApp(d.reader === "airfrance-ep5" ? "Air France · Carnet de vol EP5" : undefined);
      setSource(d.reader === "ai" ? d.source ?? "?" : d.reader === "report" ? "report" : null);
      setPdfState(d.legs.length ? null : "none");
    } catch (e) {
      setPdfState((e as Error).message || "error");
    }
  }
  const onPdf = async (file: File) => {
    const pdf = await b64(file);
    // the server accepts requests up to 4.5 MB: a heavier PDF (usually a scan) is refused with a clear message
    if (pdf.length > 4_200_000) return setPdfState("too_big");
    return fromServer({ kind: "pdf", pdf, fileName: file.name });
  };

  async function onFiles(files: File[]) {
    try {
      const images = files.filter((f) => f.type.startsWith("image/"));
      if (images.length) return await fromServer({ kind: "images", images: await Promise.all(images.slice(0, 12).map(shrinkImage)), fileName: images[0]!.name });
      return await onFile(files[0]!);
    } catch (e) {
      setRows(null);
      setMapping(null);
      setPdfRows(null);
      setPdfState(e instanceof ImportFileError ? e.message : "error");
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
    setSource(null);
    setLearned(false);
    // not enough recognised by itself: a layout learned from other pilots, else Claude maps the columns
    if (!a.app && !mappingUsable(a.mapping)) {
      setPdfState("mapping");
      const d = await importAny({ kind: "table", header: a.header, rows: a.rows.slice(0, 25), fileName: file.name, share });
      if (d.mapping) {
        setMapping(titlesToMapping(a.header, d.mapping, IMPORT_FIELDS));
        setSource("learned");
      } else if (d.mappingIndex) {
        setMapping({ ...a.mapping, ...(d.mappingIndex as Record<ImportField, number>) });
        setSource(d.source ?? "?");
      }
      setPdfState(d.error && d.error !== "plan" ? d.error : null);
    }
  }

  // step 1: build the flights as they would be saved, and compare them with the file ("Check your totals")
  const [review, setReview] = useState<{ built: Flight[]; check: ImportCheck } | null>(null);
  async function prepare() {
    if (!airports) return;
    setBusy(true);
    // flights already in the logbook (or twice in the file) are skipped: importing the same file again adds nothing
    const existing = (await db().t("flights").toArray()).filter((f) => !f.deletedAt);
    const seen = new Set(existing.map(flightKey));
    // the operator of each imported flight, as the logbook recognises it (call sign, aircraft, what it learned)
    const ops = operatorIndex(existing, await db().t("aircraft").toArray(), airlines);
    const pairs: { rowIndex: number; flight: Flight }[] = [];
    const dups: number[] = [];
    for (const r of ok) {
      const f = await buildFlight(r.input!, airports, { source: "import", explicit: r.explicit });
      if (!f.operator && !f.isFstd) f.operator = ops.of(f);
      if (seen.has(flightKey(f))) dups.push(r.rowIndex);
      else {
        seen.add(flightKey(f));
        pairs.push({ rowIndex: r.rowIndex, flight: f });
      }
    }
    setReview({ built: pairs.map((p) => p.flight), check: checkImport(parsed, pairs, dups) });
    setBusy(false);
  }

  // step 2: the pilot checked the totals: save, and keep the batch so it can be undone as a whole
  async function run() {
    if (!review) return;
    setBusy(true);
    const built = review.built;
    await db().t("flights").bulkPut(built);
    await logImported(built);
    await rememberBatch(built.map((f) => f.id));
    announceGains(built.map((f) => f.id));
    // a table imported with its columns: the layout is kept for the next pilot (column titles only)
    if (rows && mapping && !pdfRows && built.length && !learned) {
      setLearned(true);
      void importAny({ kind: "learn", header: rows[0], mapping: mappingToTitles(rows[0]!, mapping), source: app ?? source ?? undefined }).catch(() => undefined);
    }
    setBusy(false);
    const skipped = review.check.rejected.filter((x) => x.reasons.includes("duplicate")).length;
    toast(t("done", { count: built.length }) + (skipped ? ` · ${t("skipped", { count: skipped })}` : ""));
    track(built.length ? "import_success" : "import_fail");
    setReview(null);
    setRows(null);
    setMapping(null);
    setPdfRows(null);
  }

  return (
    <div className="space-y-5">
      {photos && <p className="text-sm text-muted">{t("photosHelp")}</p>}
      <DropZone accept={photos ? "image/*" : ".csv,.txt,.tsv,.xlsx,.xls,.pdf,image/*"} onFiles={(f) => void onFiles(f)} label={photos ? t("photosDrop") : t("dropAny")} />
      <details className="rounded-xl border border-border p-3">
        <summary className="cursor-pointer text-sm font-semibold text-accent">{t("pasteTitle")}</summary>
        <textarea className="input num mt-3 min-h-32 text-xs" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={t("pastePh")} />
        <button type="button" className="btn btn-secondary btn-sm mt-2" disabled={!paste.trim()} onClick={() => void fromServer({ kind: "text", text: paste })}>
          {t("pasteRead")}
        </button>
      </details>
      <label className="flex items-start gap-2 text-xs text-muted">
        <input type="checkbox" className="mt-0.5" checked={share} onChange={(e) => setShare(e.target.checked)} />
        <span>{t("share")}</span>
      </label>
      {pdfState && <p className={`mt-2 text-sm ${pdfState === "reading" || pdfState === "mapping" ? "text-accent" : "text-[var(--warning)]"}`}>{t(`pdf.${["reading", "mapping", "plan", "unauthorized", "rate_limited", "none", "busy", "too_big", "xls", "unreadable"].includes(pdfState) ? pdfState : "error"}`)}</p>}
      {source && <p className="text-sm font-semibold text-accent">{source === "learned" ? t("readLearned") : source === "report" ? t("readReport") : t("readAi", { source })}</p>}
      {review ? (
        <TotalsCheck check={review.check} busy={busy} onConfirm={run} onFix={() => setReview(null)} onCancel={() => { setReview(null); setRows(null); setMapping(null); setPdfRows(null); }} />
      ) : (
        pdfRows && <PreviewCard parsed={pdfRows} ok={ok.length} onImport={prepare} busy={busy || !airports} />
      )}
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
          {!review && <PreviewCard parsed={parsed} ok={ok.length} onImport={prepare} busy={busy || !airports} />}
        </>
      )}
      <ImportBatches />
      {toastNode}
    </div>
  );
}

const BATCHES = "importBatches";
type Batch = { id: string; at: string; ids: string[] };

/** Keeps the ids of an import (this device) so it can be undone as a whole, without touching anything else. */
async function rememberBatch(ids: string[]) {
  if (!ids.length) return;
  let list: Batch[] = [];
  try {
    list = JSON.parse((await localStore.getMeta(BATCHES)) ?? "[]");
  } catch {}
  list.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), ids });
  await localStore.setMeta(BATCHES, JSON.stringify(list.slice(0, 10)));
  window.dispatchEvent(new Event("import-batches"));
}

/** The last imports, each with « Undo this import » (the flights of that import only are deleted). */
function ImportBatches() {
  const t = useTranslations("app.import");
  const fd = useFormatDate();
  const [list, setList] = useState<Batch[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const load = () =>
    void localStore.getMeta(BATCHES).then((v) => {
      try {
        setList(JSON.parse(v ?? "[]"));
      } catch {
        setList([]);
      }
    });
  useEffect(() => {
    load();
    window.addEventListener("import-batches", load);
    return () => window.removeEventListener("import-batches", load);
  }, []);
  if (!list.length) return null;
  const undo = async (b: Batch) => {
    if (!window.confirm(t("undoConfirm", { count: b.ids.length }))) return;
    setBusy(b.id);
    for (const id of b.ids) await softDelete("flights", id);
    const next = list.filter((x) => x.id !== b.id);
    await localStore.setMeta(BATCHES, JSON.stringify(next));
    setList(next);
    setBusy(null);
  };
  return (
    <Card title={t("batches")}>
      <ul className="divide-y divide-border text-sm">
        {list.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-3 py-2">
            <span>{t("batchLine", { count: b.ids.length, date: fd(b.at.slice(0, 10)) })}</span>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy === b.id} onClick={() => void undo(b)}>{t("undo")}</button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** « Check your totals »: the file's columns against what Geardown will record, differences and rows left out. */
function TotalsCheck({ check, busy, onConfirm, onFix, onCancel }: { check: ImportCheck; busy: boolean; onConfirm: () => void; onFix: () => void; onCancel: () => void }) {
  const t = useTranslations("app.import");
  const v = (field: string, n: number | undefined) => (n === undefined ? "—" : field === "landings" ? String(n) : formatDuration(n));
  const shown = check.lines.filter((l) => l.file !== undefined || l.geardown > 0);
  const diffs = check.lines.filter((l) => l.rows.length);
  return (
    <Card title={t("totals.title")}>
      <p className="text-sm text-muted">{t("totals.intro", { kept: check.kept })}</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left">
            <tr className="[&>th]:label-caps [&>th]:px-3 [&>th]:py-2">
              <th>{t("totals.column")}</th><th className="!text-right">{t("totals.file")}</th><th className="!text-right">{t("totals.geardown")}</th><th>{t("totals.status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.map((l) => {
              const off = l.rows.length > 0;
              return (
                <tr key={l.field} className={`num [&>td]:px-3 [&>td]:py-2 ${off ? "bg-[var(--caution)]/10" : ""}`}>
                  <td>{l.field === "landings" ? t("totals.landings") : t(`fields.${l.field}`)}</td>
                  <td className="text-right">{v(l.field, l.file)}</td>
                  <td className="text-right font-semibold">{v(l.field, l.geardown)}</td>
                  <td className={off ? "font-semibold text-caution" : l.file === undefined ? "text-muted" : "text-success"}>
                    {off ? t("totals.diff", { count: l.rows.length }) : l.file === undefined ? t("totals.noColumn") : t("totals.same")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {diffs.length > 0 && (
        <div className="mt-4 rounded-xl bg-[var(--caution)]/10 p-3 text-sm">
          <p className="font-semibold">{t("totals.diffTitle")}</p>
          <ul className="mt-1 space-y-1">
            {diffs.map((l) => (
              <li key={l.field}>
                {l.field === "landings" ? t("totals.landings") : t(`fields.${l.field}`)} : {t("totals.rows", { rows: l.rows.slice(0, 30).join(", ") + (l.rows.length > 30 ? "…" : "") })}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">{t("totals.diffHelp")}</p>
        </div>
      )}
      {check.rejected.length > 0 && (
        <div className="mt-4 text-sm">
          <p className="font-semibold">{t("totals.rejected", { count: check.rejected.length })}</p>
          <ul className="mt-1 max-h-40 space-y-0.5 overflow-auto text-muted">
            {check.rejected.slice(0, 200).map((r) => (
              <li key={r.row}>{t("totals.rejectedLine", { row: r.row, reasons: r.reasons.map((x) => t(`totals.reason.${x}`)).join(", ") })}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>{t("totals.cancel")}</button>
        <button type="button" className="btn btn-secondary" onClick={onFix}>{t("totals.fix")}</button>
        <button type="button" className="btn btn-primary" disabled={busy || check.kept === 0} onClick={onConfirm}>{t("totals.confirm", { count: check.kept })}</button>
      </div>
    </Card>
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

