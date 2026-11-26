"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, ScanLine, ShieldCheck } from "lucide-react";
import { planScan, type License, type ScanPlanItem, type ScannedDocument } from "@cielo/core";
import { Badge, Modal } from "@/components/app/ui";
import { DropZone } from "@/components/app/DropZone";
import { Paywall, useAccess } from "@/lib/access";
import { apiFetch } from "@/lib/report";
import { saveLicense } from "@/lib/repo";
import { localStore } from "@/lib/db";

const CONSENT_KEY = "docScanConsentAt";

/** A photo made light enough to send: at most 2400 px on its long side (small print stays legible), JPEG. */
async function shrink(file: File): Promise<{ data: string; type: string }> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  const url = c.toDataURL("image/jpeg", 0.88);
  return { data: url.slice(url.indexOf(",") + 1), type: "image/jpeg" };
}
const b64 = async (file: File) => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

type Row = ScanPlanItem & { on: boolean };

/**
 * "Read a document": a photo or a PDF of the licence or of the medical certificate, read by Claude on the
 * server, then every entry checked by the pilot before it is saved. Nothing of the document is kept.
 */
export function DocumentScan({ open, onClose, licenses }: { open: boolean; onClose: () => void; licenses: License[] }) {
  const t = useTranslations("app.documents.scan");
  const tk = useTranslations("app.documents");
  const access = useAccess();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [saving, setSaving] = useState(false);

  // consent given before on this device: shown ticked, still readable and revocable
  useEffect(() => {
    if (open) void localStore.getMeta(CONSENT_KEY).then((v) => setConsent(!!v));
  }, [open]);

  const close = () => {
    setRows(null);
    setError(null);
    onClose();
  };

  const send = async (files: File[]) => {
    if (!consent) return setError(t("needConsent"));
    setError(null);
    setBusy(true);
    try {
      await localStore.setMeta(CONSENT_KEY, new Date().toISOString());
      const pdf = files.find((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
      const body = pdf ? { pdf: await b64(pdf), consent: true } : { images: await Promise.all(files.filter((f) => f.type.startsWith("image/")).slice(0, 4).map(shrink)), consent: true };
      const r = await apiFetch("/api/document-scan", { method: "POST", body: JSON.stringify(body) });
      const d = (await r.json().catch(() => ({}))) as { entries?: ScannedDocument[]; document?: string; error?: string };
      if (!r.ok) return setError(t(`err.${["plan", "rate_limited", "refused", "unreadable", "bad_request"].includes(d.error ?? "") ? d.error : "failed"}`));
      if (!d.entries?.length) return setError(t("none"));
      setRows(planScan(d.entries, licenses).map((p) => ({ ...p, on: p.action !== "same" })));
    } catch {
      setError(t("err.failed"));
    } finally {
      setBusy(false);
    }
  };

  const edit = (i: number, patch: Partial<Row["draft"]>) => setRows((rs) => rs!.map((r, j) => (j === i ? { ...r, on: true, draft: { ...r.draft, ...patch } } : r)));
  const chosen = rows?.filter((r) => r.on) ?? [];
  const save = async () => {
    setSaving(true);
    try {
      for (const r of chosen) await saveLicense(r.draft);
      close();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title={t("title")} wide>
      {!access.has("scan") ? (
        <Paywall feature="scan" />
      ) : rows ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">{t("check")}</p>
          <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
            {rows.map((r, i) => (
              <div key={i} className={`rounded-xl border p-3 ${r.on ? "border-[color:var(--accent)]/50 bg-[color:var(--accent)]/5" : "border-border"}`}>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="accent-[var(--accent)]" checked={r.on} onChange={() => setRows((rs) => rs!.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))} />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">{tk(`kinds.${r.draft.kind}`)}</span>
                  <input className="input !w-auto min-w-0 flex-1 !py-1.5 font-semibold" value={r.draft.code} onChange={(e) => edit(i, { code: e.target.value })} />
                  <Badge level={r.action === "new" ? "ok" : r.action === "update" ? "info" : "neutral"}>{t(`action.${r.action}`)}</Badge>
                </label>
                <div className="mt-2 grid gap-2 pl-6 text-xs sm:grid-cols-4">
                  {(["issuedOn", "validUntil", "lastCheckOn"] as const).map((f) =>
                    r.draft[f] || r.changes.includes(f) || f === "validUntil" ? (
                      <label key={f} className="space-y-0.5">
                        <span className={r.changes.includes(f) ? "font-semibold text-[color:var(--accent)]" : "text-muted"}>{t(`f.${f}`)}</span>
                        <input type="date" className="input num !py-1.5 text-xs" value={r.draft[f] ?? ""} onChange={(e) => edit(i, { [f]: e.target.value || null })} />
                      </label>
                    ) : null,
                  )}
                  {(r.draft.number || r.draft.authority) && (
                    <p className="self-end truncate text-muted sm:col-span-1">{[r.draft.authority, r.draft.number].filter(Boolean).join(" · ")}</p>
                  )}
                </div>
                {r.draft.kind === "medical" && r.draft.notes?.match(/^Limitations?: .*$/m) && <p className="mt-1 pl-6 text-xs text-muted">{r.draft.notes.match(/^Limitations?: .*$/m)![0]}</p>}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setRows(null)}>{t("again")}</button>
            <button type="button" className="btn btn-primary" disabled={!chosen.length || saving} onClick={() => void save()}>
              {t("save", { count: chosen.length })}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted">{t("intro")}</p>
          <div className="rounded-xl border border-border bg-surface/60 p-3 text-xs leading-relaxed text-muted">
            <p className="mb-1 flex items-center gap-1.5 font-semibold text-text"><ShieldCheck size={14} /> {t("privacyTitle")}</p>
            {t("privacy")}
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 accent-[var(--accent)]" checked={consent} onChange={(e) => (setConsent(e.target.checked), !e.target.checked && void localStore.setMeta(CONSENT_KEY, ""))} />
            <span>{t("consent")}</span>
          </label>
          {busy ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border p-8 text-sm text-muted"><Loader2 size={16} className="animate-spin" /> {t("reading")}</div>
          ) : (
            <DropZone accept="image/jpeg,image/png,image/webp,application/pdf" onFiles={(f) => void send(f)} label={t("drop")} />
          )}
          {error && <p className="text-sm text-warning">{error}</p>}
        </div>
      )}
    </Modal>
  );
}

export function DocumentScanButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations("app.documents.scan");
  return (
    <button type="button" className="btn btn-secondary btn-sm" onClick={onClick}>
      <ScanLine size={15} /> {t("button")}
    </button>
  );
}
