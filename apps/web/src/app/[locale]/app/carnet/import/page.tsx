"use client";

import { uploadImportPdf } from "@/lib/importUpload";

import { CalendarDays, Camera, FileSpreadsheet, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  analyseTable, applyImportChoices, landingsFill, checkMapping, editImportedRow, IMPORT_FIELDS, matchImported, legsToRows, mappingToTitles, mappingUsable, parseCsv, rowsToFlights, sheetCellText, titlesToMapping,
  type DateOrder, type DuplicateMatch, type ImportChoices, type ImportField, type ImportRowEdit, type ImportedRow, type LogbookLeg, type StoredMapping, ep5Legs, parseAirFranceEp5, parseLogTenEasa } from "@cielo/core";
import { apiFetch } from "@/lib/report";
import { Link } from "@/i18n/navigation";
import { Card, Field, PageTitle, Segmented, useToast } from "@/components/app/ui";
import { useAirports } from "@/lib/airports";
import { logImported, buildFlight, softDelete } from "@/lib/repo";
import { db, localStore } from "@/lib/db";
import { announceGains } from "@/lib/gains";
import { useAirlineDirectory } from "@/lib/airlines";
import { checkImport, formatDuration, operatorIndex, type Flight, type ImportCheck } from "@cielo/core";
import { DropZone } from "@/components/app/DropZone";
import { ImportReview } from "@/components/app/ImportReview";
import { Paywall, useAccess } from "@/lib/access";
import { track } from "@/lib/metrics";
import { useFormatDate, usePilot } from "@/lib/hooks";

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
  const pilot = usePilot();
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
  const tableRows = useMemo<ImportedRow[]>(() => (rows && mapping ? rowsToFlights(rows.slice(1), mapping, { dateOrder: order, timezoneOf: (c) => airports?.get(c.length === 3 ? airports.iataToIcao(c) ?? c : c)?.timezone }) : []), [rows, mapping, order, airports]);
  // VFR / IFR and PIC / SIC / dual for every flight of the import, when the document does not say it (a student's page)
  const [choices, setChoices] = useState<ImportChoices>({ rules: "doc", function: "doc", xc: "doc" });
  // the pilot's corrections, row by row (typed in the check before importing)
  const [edits, setEdits] = useState<Record<number, ImportRowEdit>>({});
  const parsed = useMemo(() => applyImportChoices(pdfRows ?? tableRows, choices).map((r) => editImportedRow(r, edits[r.rowIndex])), [pdfRows, tableRows, choices, edits]);
  const recognised = mapping ? Object.values(mapping).filter((i) => i >= 0).length : 0;
  // cross-checks on the data itself, recomputed whenever a column is changed by hand
  const checks = useMemo(() => (rows && mapping ? checkMapping(rows.slice(1), mapping) : []), [rows, mapping]);
  const doubtful = new Set(checks.map((c) => c.field));
  const unused = useMemo(() => {
    if (!rows || !mapping) return [];
    const used = new Set(Object.values(mapping));
    return rows[0]!.filter((h, i) => h && !used.has(i) && rows.slice(1).some((r) => (r[i] ?? "").trim()));
  }, [rows, mapping]);
  const ok = useMemo(() => parsed.filter((r) => r.errors.length === 0 && r.input && !("excluded" in r && r.excluded)), [parsed]);
  /** A new document or file: the corrections and choices made for the previous one are dropped. */
  const fresh = () => {
    setEdits({});
    setChoices({ rules: "doc", function: "doc", xc: "doc" });
    setReview(null);
  };

  /** A document read on the server (PDF, photos, pasted text): legs to review. */
  async function fromServer(body: Record<string, unknown>) {
    fresh();
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
      showLegs(d);
    } catch (e) {
      setPdfState((e as Error).message || "error");
    }
  }
  // the flights a reader found (on the server, or here for a statement or a LogTen logbook), for review
  function showLegs(d: Awaited<ReturnType<typeof importAny>>) {
    if (d.error || !d.legs) return setPdfState(d.error ?? "error");
    // an airline statement gives the role (CDB / OPL); a paper logbook or an e-mail does not: the pilot's usual function
    const ep5 = d.reader === "airfrance-ep5";
    const role = d.role === "CDB" || d.role === "CDT" ? "PIC" : ep5 || d.role ? "SIC" : pilot?.defaultFunction ?? "PIC";
    setPdfRows(legsToRows(d.legs, (c) => airports?.get(c)?.icao, { function: role, pilotFlying: false, airline: ep5 }));
    setApp(d.reader === "airfrance-ep5" ? "Air France · EP4 / EP5" : d.reader === "logten-pdf" ? "LogTen" : undefined);
    setSource(d.reader === "ai" ? d.source ?? "?" : d.reader === "report" ? "report" : null);
    setPdfState(d.legs.length ? null : "none");
  }
  // one PDF: read here first (an airline statement or a LogTen logbook needs no upload, whatever its size), else on
  // the server; a request is limited to 4.5 MB, so a larger PDF is uploaded to the pilot's private folder first
  async function readPdf(file: File): Promise<Awaited<ReturnType<typeof importAny>>> {
    try {
      const { pdfText } = await import("@/lib/pdfPages");
      const pages = await pdfText(new Uint8Array(await file.arrayBuffer()), 1500);
      const ep5 = parseAirFranceEp5(pages);
      if (ep5) return { reader: "airfrance-ep5", role: ep5.role ?? null, legs: ep5Legs(ep5) };
      const logten = parseLogTenEasa(pages);
      if (logten) return { reader: "logten-pdf", legs: logten.legs };
    } catch {
      // a PDF the browser cannot read: the server tries
    }
    const pdf = await b64(file);
    if (pdf.length > 4_200_000) {
      const path = await uploadImportPdf(file);
      if (!path) return { error: "too_big" };
      return importAny({ kind: "pdf", storagePath: path, fileName: file.name, share });
    }
    return importAny({ kind: "pdf", pdf, fileName: file.name, share });
  }
  // one or several PDFs (a year of monthly statements): read one after the other, their flights reviewed together
  const onPdfs = async (files: File[]) => {
    fresh();
    setRows(null);
    setMapping(null);
    setPdfRows(null);
    setSource(null);
    setPdfState("reading");
    try {
      const all: Awaited<ReturnType<typeof importAny>>[] = [];
      for (const f of files) {
        const d = await readPdf(f);
        if (d.error) {
          // a single file's error is the answer; among several, the others are still shown
          if (files.length === 1) return setPdfState(d.error);
          continue;
        }
        all.push(d);
      }
      if (!all.length) return setPdfState("none");
      const first = all[0]!;
      const sameReader = all.every((d) => d.reader === first.reader);
      showLegs({ ...first, reader: sameReader ? first.reader : undefined, role: all.find((d) => d.role)?.role ?? null, legs: all.flatMap((d) => d.legs ?? []) });
    } catch (e) {
      setPdfState((e as Error).message || "error");
    }
  };
  const onPdf = (file: File) => onPdfs([file]);

  async function onFiles(files: File[]) {
    try {
      const images = files.filter((f) => f.type.startsWith("image/"));
      if (images.length) return await fromServer({ kind: "images", images: await Promise.all(images.slice(0, 12).map(shrinkImage)), fileName: images[0]!.name });
      const pdfs = files.filter((f) => /\.pdf$/i.test(f.name) || f.type === "application/pdf");
      if (pdfs.length > 1) return await onPdfs(pdfs.slice(0, 24));
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
    fresh();
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

  // the flights as they would be saved, compared with what was read: worked out again after every change
  const [review, setReview] = useState<{ built: Flight[]; fills: Flight[]; check: ImportCheck } | null>(null);
  const reading = !!pdfRows || !!(rows && mapping);
  useEffect(() => {
    if (!reading || !airports) return;
    let stale = false;
    const h = setTimeout(() => void prepare().then((r) => !stale && r && setReview(r)), 250);
    return () => {
      stale = true;
      clearTimeout(h);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, airports, reading]);
  async function prepare(): Promise<{ built: Flight[]; fills: Flight[]; check: ImportCheck } | null> {
    if (!airports) return null;
    // flights already in the logbook (or twice in the file) are skipped: importing the same file again adds nothing
    const existing = (await db().t("flights").toArray()).filter((f) => !f.deletedAt);
    // the operator of each imported flight, as the logbook recognises it (call sign, aircraft, what it learned)
    const ops = operatorIndex(existing, await db().t("aircraft").toArray(), airlines);
    const pairs: { rowIndex: number; flight: Flight }[] = [];
    const dups: number[] = [];
    const dupOf: Record<number, DuplicateMatch> = {};
    const built: Flight[] = [];
    for (const r of ok) {
      const f = await buildFlight(r.input!, airports, { source: "import", explicit: r.explicit });
      if (!f.operator && !f.isFstd) f.operator = ops.of(f);
      built.push(f);
    }
    // already in the logbook (one logbook flight per row): left out unless the pilot keeps it
    const matches = matchImported(built, existing);
    const byId = new Map(existing.map((f) => [f.id, f]));
    // a flight already logged without its takeoffs and landings gets them from the document read again
    const fills: Flight[] = [];
    ok.forEach((r, i) => {
      const m = matches[i];
      if (m && !("keepDuplicate" in r && r.keepDuplicate)) {
        dups.push(r.rowIndex);
        dupOf[r.rowIndex] = m;
        const logged = byId.get(m.flight.id);
        // only an Air France EP4/EP5: its SAB code says who took off and landed
        const fill = pdfRows && app === "Air France · EP4 / EP5" && logged ? landingsFill(built[i]!, logged, undefined, !!r.input?.autoLandings) : null;
        if (fill) fills.push(fill);
      } else pairs.push({ rowIndex: r.rowIndex, flight: built[i]! });
    });
    return { built: pairs.map((p) => p.flight), fills, check: checkImport(parsed, pairs, dups, pdfRows ? 1 : 2, dupOf) };
  }

  // step 2: the pilot checked the totals: save, and keep the batch so it can be undone as a whole
  async function run() {
    if (!review) return;
    setBusy(true);
    const built = review.built;
    await db().t("flights").bulkPut(built);
    if (review.fills.length) await db().t("flights").bulkPut(review.fills);
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
    fresh();
    setRows(null);
    setMapping(null);
    setPdfRows(null);
  }
  const cancel = () => {
    fresh();
    setRows(null);
    setMapping(null);
    setPdfRows(null);
  };
  const reviewNode = (
    <ImportReview
      rows={parsed}
      check={review?.check ?? null}
      firstRow={pdfRows ? 1 : 2}
      choices={choices}
      onChoices={setChoices}
      edits={edits}
      onEdit={(i, e) => setEdits((all) => ({ ...all, [i]: e }))}
      onConfirm={run}
      onCancel={cancel}
      busy={busy || !airports}
      fills={review?.fills.length ?? 0}
    />
  );

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
      {pdfRows && reviewNode}
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
          {reviewNode}
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

