"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Camera, FileSignature, Link2, PenLine, Plus, Search, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import {
  AC_61_65K,
  blanksLeft,
  canonicalEndorsement,
  endorsementSignatureLine,
  endorsementTemplate,
  endorsementValidUntil,
  fillEndorsement,
  type Endorsement,
} from "@cielo/core";
import { Badge, Card, Empty, Field, Modal, PageTitle, Segmented, type Level } from "@/components/app/ui";
import { DateInput } from "@/components/app/DateInput";
import { SignatureCanvas } from "@/components/app/Signature";
import { useFormatDate, usePilot, useTable, useToday } from "@/lib/hooks";
import { saveEndorsement, sha256, signEndorsementHere, softDelete } from "@/lib/repo";
import { useCloud } from "@/lib/cloud";
import { apiFetch } from "@/lib/report";
import { Link } from "@/i18n/navigation";

type Draft = Omit<Endorsement, "id" | "createdAt" | "updatedAt" | "pilotId"> & { id?: string };

/**
 * FAA logbook endorsements (AC 61-65K): the ones received, signed by the instructor on this screen, by link or
 * copied from paper; and, for an instructor, the record of the ones given (14 CFR 61.189).
 */
export default function EndorsementsPage() {
  const t = useTranslations("app.endorsements");
  const all = useTable("endorsements");
  const pilot = usePilot();
  const today = useToday();
  const [tab, setTab] = useState<"received" | "given">("received");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [signing, setSigning] = useState<Endorsement | null>(null);
  const [linking, setLinking] = useState<Endorsement | null>(null);

  const list = useMemo(
    () => (all ?? []).filter((e) => !e.deletedAt && e.direction === tab).sort((a, b) => b.issuedOn.localeCompare(a.issuedOn) || b.createdAt.localeCompare(a.createdAt)),
    [all, tab],
  );
  const start = () =>
    setDraft({ direction: tab, templateId: "", title: "", text: "", studentName: tab === "received" ? (pilot?.fullName ?? "") : "", issuedOn: today, source: "here" });

  return (
    <>
      <PageTitle
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/app/carnet/8710" className="btn btn-secondary btn-sm">{t("report8710")}</Link>
            <button type="button" className="btn btn-primary btn-sm" onClick={start}><Plus size={15} /> {t("add")}</button>
          </div>
        }
      />
      <div className="mb-5">
        <Segmented value={tab} onChange={setTab} options={[{ value: "received", label: t("received") }, { value: "given", label: t("given") }]} />
      </div>
      {tab === "given" && <p className="mb-4 max-w-3xl text-sm text-muted">{t("givenHint")}</p>}
      {all && list.length === 0 ? (
        <Card><Empty icon={<FileSignature size={36} />} text={tab === "received" ? t("emptyReceived") : t("emptyGiven")} /></Card>
      ) : (
        <div className="space-y-3">
          {list.map((e) => (
            <EndorsementCard key={e.id} e={e} today={today} onSign={() => setSigning(e)} onLink={() => setLinking(e)} onEdit={() => setDraft(e)} />
          ))}
        </div>
      )}
      <p className="mt-6 text-xs text-muted">{t("source")}</p>
      {draft && <EditModal draft={draft} onClose={() => setDraft(null)} />}
      {signing && <SignHereModal e={signing} onClose={() => setSigning(null)} />}
      {linking && <LinkModal e={linking} onClose={() => setLinking(null)} />}
    </>
  );
}

function EndorsementCard({ e, today, onSign, onLink, onEdit }: { e: Endorsement; today: string; onSign: () => void; onLink: () => void; onEdit: () => void }) {
  const t = useTranslations("app.endorsements");
  const fd = useFormatDate();
  const [valid, setValid] = useState<boolean | null>(null);
  // the seal: unchanged since signed?
  useEffect(() => {
    if (!e.signedAt || !e.contentHash) return setValid(null);
    void sha256(canonicalEndorsement(e)).then((h) => setValid(h === e.contentHash));
  }, [e]);
  const left = e.expiresOn ? Math.round((Date.parse(e.expiresOn) - Date.parse(today)) / 86_400_000) : null;
  const level: Level = left === null ? "neutral" : left < 0 ? "warning" : left <= 14 ? "caution" : "ok";
  const signed = !!e.signedAt;
  return (
    <article className={`rounded-2xl border bg-surface/70 p-4 ${signed ? "border-border" : "border-dashed border-border"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted">{[e.templateId !== "custom" ? e.templateId : null, e.regulation].filter(Boolean).join(" · ")}</p>
          <h3 className="mt-0.5 font-semibold">{e.title}</h3>
          <p className="text-xs text-muted">{[e.direction === "given" ? e.studentName : null, fd(e.issuedOn), e.aircraft].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {e.expiresOn && <Badge level={level}>{left! < 0 ? t("expired", { date: fd(e.expiresOn) }) : t("validUntil", { date: fd(e.expiresOn) })}</Badge>}
          {e.direction === "received" && (signed ? <Badge level={valid === false ? "warning" : "ok"}>{valid === false ? t("changed") : e.source === "paper" ? t("paper") : t("signed")}</Badge> : <Badge level="caution">{t("unsigned")}</Badge>)}
        </div>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-[14.5px] leading-relaxed text-text/90">{e.text}</p>
      {e.testKind && <p className="mt-2 text-sm text-muted">{[e.testKind, e.testResult].filter(Boolean).join(" · ")}</p>}
      {signed && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {e.signatureImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={e.signatureImage} alt="" className="h-12 rounded bg-white px-2" />
          )}
          <p className="num text-xs text-muted">{endorsementSignatureLine(e)}</p>
          {e.contentHash && <p className="num text-[11px] text-muted">SHA-256 {e.contentHash.slice(0, 16)}…</p>}
        </div>
      )}
      {e.attachmentDataUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={e.attachmentDataUrl} alt="" className="mt-3 max-h-56 rounded-lg border border-border" />
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {e.direction === "received" && !signed && (
          <>
            <button type="button" className="btn btn-primary btn-sm" onClick={onSign}><PenLine size={14} /> {t("signHere")}</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onLink}><Link2 size={14} /> {t("sendLink")}</button>
          </>
        )}
        {!signed && <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}>{t("edit")}</button>}
        <button type="button" className="btn btn-ghost btn-sm text-muted" onClick={() => window.confirm(t("deleteConfirm")) && void softDelete("endorsements", e.id)}><Trash2 size={14} /></button>
      </div>
    </article>
  );
}

/** Pick a template (or write one), fill it, save it unsigned; a paper endorsement is saved with its copy. */
function EditModal({ draft: initial, onClose }: { draft: Draft; onClose: () => void }) {
  const t = useTranslations("app.endorsements");
  const [d, setD] = useState<Draft>(initial);
  const [q, setQ] = useState("");
  const [picking, setPicking] = useState(!initial.templateId);
  const [touched, setTouched] = useState(!!initial.id);
  const [paper, setPaper] = useState(initial.source === "paper");
  const found = useMemo(() => {
    const s = q.trim().toLowerCase();
    return AC_61_65K.filter((x) => !s || `${x.id} ${x.title} ${x.ref} ${x.text}`.toLowerCase().includes(s));
  }, [q]);
  const fill = (next: Draft) => {
    const tpl = endorsementTemplate(next.templateId);
    // the text follows the pilot and the aircraft until the pilot edits it
    setD(tpl && !touched ? { ...next, text: fillEndorsement(tpl.text, next) } : next);
  };
  const pick = (id: string) => {
    const tpl = endorsementTemplate(id);
    setTouched(false);
    setPicking(false);
    if (!tpl) return setD({ ...d, templateId: "custom", title: "", regulation: "", text: "" });
    setD({ ...d, templateId: tpl.id, title: tpl.title, regulation: tpl.ref, text: fillEndorsement(tpl.text, d) });
  };
  const blanks = blanksLeft(d.text);
  const photo = async (file: File) => {
    const url = await new Promise<string>((res) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.readAsDataURL(file);
    });
    setD({ ...d, attachmentDataUrl: url });
  };
  const save = async () => {
    const base = { ...d, source: paper ? ("paper" as const) : d.source, expiresOn: endorsementValidUntil(d.templateId, d.issuedOn) };
    // a paper endorsement is copied as signed: the instructor's line as written, no drawn signature
    if (paper && d.direction === "received" && d.instructorName && d.instructorCertificate) {
      const saved = await saveEndorsement(base);
      await signEndorsementHere(saved, { instructorName: d.instructorName, instructorCertificate: d.instructorCertificate, instructorCertKind: d.instructorCertKind ?? null, instructorCertDate: d.instructorCertDate ?? null, signatureImage: undefined });
    } else await saveEndorsement(base);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={d.direction === "received" ? t("newReceived") : t("newGiven")} wide>
      {picking ? (
        <div className="space-y-3">
          <label className="relative block">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input !pl-9" autoFocus placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className="max-h-[55vh] space-y-1 overflow-y-auto pr-1">
            {found.map((x, i) => (
              <div key={x.id}>
                {(i === 0 || found[i - 1]!.section !== x.section) && <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted">{x.section.toLowerCase()}</p>}
                <button type="button" onClick={() => pick(x.id)} className="flex w-full items-baseline gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[color:var(--text)]/5">
                  <span className="num w-10 shrink-0 font-semibold text-accent">{x.id}</span>
                  <span className="min-w-0 flex-1">{x.title}</span>
                  <span className="hidden shrink-0 text-xs text-muted sm:inline">{x.ref}</span>
                </button>
              </div>
            ))}
            <button type="button" onClick={() => pick("custom")} className="mt-2 w-full rounded-lg border border-dashed border-border px-3 py-2 text-left text-sm text-muted">{t("custom")}</button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm"><span className="font-semibold">{d.templateId !== "custom" ? `${d.templateId} · ` : ""}{d.title || t("custom")}</span> <span className="text-muted">{d.regulation}</span></p>
            {!initial.id && <button type="button" className="text-xs font-semibold text-accent underline" onClick={() => setPicking(true)}>{t("change")}</button>}
          </div>
          {d.templateId === "custom" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("f.title")}><input className="input" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} /></Field>
              <Field label={t("f.regulation")}><input className="input" value={d.regulation ?? ""} onChange={(e) => setD({ ...d, regulation: e.target.value })} /></Field>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={d.direction === "received" ? t("f.pilot") : t("f.student")}><input className="input" value={d.studentName} onChange={(e) => fill({ ...d, studentName: e.target.value })} /></Field>
            <Field label={t("f.aircraft")}><input className="input" placeholder="Cessna 172S" value={d.aircraft ?? ""} onChange={(e) => fill({ ...d, aircraft: e.target.value })} /></Field>
            <Field label={t("f.date")}><DateInput value={d.issuedOn} required onChange={(e) => e.target.value && setD({ ...d, issuedOn: e.target.value })} /></Field>
          </div>
          <Field label={t("f.text")} hint={blanks.length ? t("blanks", { list: blanks.join(" ") }) : undefined}>
            <textarea className="input min-h-36 leading-relaxed" value={d.text} onChange={(e) => (setTouched(true), setD({ ...d, text: e.target.value }))} />
          </Field>
          {d.direction === "given" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("f.testKind")}><input className="input" placeholder={t("f.testKindPh")} value={d.testKind ?? ""} onChange={(e) => setD({ ...d, testKind: e.target.value })} /></Field>
              <Field label={t("f.testResult")}><input className="input" value={d.testResult ?? ""} onChange={(e) => setD({ ...d, testResult: e.target.value })} /></Field>
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-border p-3">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" className="accent-[var(--accent)]" checked={paper} onChange={(e) => setPaper(e.target.checked)} /> {t("paperToggle")}
              </label>
              {paper && (
                <>
                  <p className="text-xs text-muted">{t("paperHint")}</p>
                  <InstructorFields d={d} set={setD} />
                  <label className="btn btn-secondary btn-sm w-fit cursor-pointer"><Camera size={14} /> {d.attachmentDataUrl ? t("photoChange") : t("photo")}<input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && void photo(e.target.files[0])} /></label>
                </>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>{t("cancel")}</button>
            <button type="button" className="btn btn-primary" disabled={!d.title.trim() || !d.text.trim() || !d.studentName.trim() || (paper && !(d.instructorName && d.instructorCertificate))} onClick={() => void save()}>
              {paper ? t("savePaper") : t("save")}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function InstructorFields({ d, set }: { d: Draft; set: (d: Draft) => void }) {
  const t = useTranslations("app.endorsements");
  const kind = d.instructorCertKind ?? "ground";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t("f.instructor")}><input className="input" value={d.instructorName ?? ""} onChange={(e) => set({ ...d, instructorName: e.target.value })} /></Field>
      <Field label={t("f.certificate")}><input className="input num" placeholder="987654321CFI" value={d.instructorCertificate ?? ""} onChange={(e) => set({ ...d, instructorCertificate: e.target.value })} /></Field>
      <Field label={t("f.certKind")}>
        <select className="input" value={kind} onChange={(e) => set({ ...d, instructorCertKind: e.target.value === "ground" ? null : (e.target.value as "RE" | "Exp"), instructorCertDate: e.target.value === "ground" ? null : d.instructorCertDate })}>
          <option value="RE">{t("kindRE")}</option>
          <option value="Exp">{t("kindExp")}</option>
          <option value="ground">{t("kindGround")}</option>
        </select>
      </Field>
      {kind !== "ground" && <Field label={kind === "RE" ? t("f.dateRE") : t("f.dateExp")}><DateInput value={d.instructorCertDate ?? ""} onChange={(e) => set({ ...d, instructorCertDate: e.target.value || null })} /></Field>}
    </div>
  );
}

/** The instructor signs on this screen: their certificate, then the drawn signature; the endorsement is sealed. */
function SignHereModal({ e, onClose }: { e: Endorsement; onClose: () => void }) {
  const t = useTranslations("app.endorsements");
  const [d, setD] = useState<Draft>({ ...e, instructorCertKind: "RE" });
  const [image, setImage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const blanks = blanksLeft(e.text);
  const ready = !blanks.length && image && ok && d.instructorName?.trim() && d.instructorCertificate?.trim() && (!d.instructorCertKind || d.instructorCertDate);
  return (
    <Modal open onClose={onClose} title={t("signTitle")} wide>
      <div className="space-y-4">
        <div className="rounded-xl border border-border p-3">
          <p className="text-xs font-semibold text-muted">{e.templateId} · {e.regulation}</p>
          <p className="mt-1 font-semibold">{e.title}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{e.text}</p>
        </div>
        {blanks.length ? (
          <p className="flex items-center gap-2 text-sm text-warning"><ShieldAlert size={16} /> {t("blanksFirst", { list: blanks.join(" ") })}</p>
        ) : (
          <>
            <p className="text-sm text-muted">{t("signIntro")}</p>
            <InstructorFields d={d} set={setD} />
            <SignatureCanvas onChange={setImage} />
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 accent-[var(--accent)]" checked={ok} onChange={(x) => setOk(x.target.checked)} /> {t("attest")}</label>
          </>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t("cancel")}</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!ready}
            onClick={async () => {
              await signEndorsementHere(e, { instructorName: d.instructorName!.trim(), instructorCertificate: d.instructorCertificate!.trim(), instructorCertKind: d.instructorCertKind ?? null, instructorCertDate: d.instructorCertKind ? d.instructorCertDate : null, signatureImage: image! });
              onClose();
            }}
          >
            <ShieldCheck size={16} /> {t("sign")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** A link for an instructor without Geardown: they read the endorsement and sign it in their browser. */
function LinkModal({ e, onClose }: { e: Endorsement; onClose: () => void }) {
  const t = useTranslations("app.endorsements");
  const locale = useLocale();
  const cloud = useCloud();
  const [name, setName] = useState(e.instructorName ?? "");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ url: string; mailed: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const blanks = blanksLeft(e.text);
  const create = async () => {
    setBusy(true);
    setErr(null);
    try {
      const call = () => apiFetch("/api/sign-link", { method: "POST", body: JSON.stringify({ action: "create", endorsementId: e.id, signerName: name.trim(), email: email.trim() || undefined, locale }) });
      // the endorsement must reach the account first
      await cloud.syncNow();
      let r = await call();
      if (r.status === 409) {
        await cloud.syncNow();
        r = await call();
      }
      const d = (await r.json().catch(() => ({}))) as { url?: string; mailed?: boolean; error?: string };
      if (!r.ok || !d.url) throw new Error(d.error ?? "error");
      setRes({ url: d.url, mailed: !!d.mailed });
    } catch (x) {
      const code = (x as Error).message;
      setErr(t(`linkErr.${["plan", "blanks", "not_synced", "unauthorized"].includes(code) ? code : "error"}`));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={t("linkTitle")}>
      <div className="space-y-3">
        <p className="text-sm text-muted">{t("linkHint")}</p>
        {blanks.length ? <p className="text-sm text-warning">{t("blanksFirst", { list: blanks.join(" ") })}</p> : null}
        {res ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-success">{t("linkReady")}</p>
            {res.mailed && <p className="text-xs text-muted">{t("linkMailed", { email })}</p>}
            <input className="input num text-xs" readOnly value={res.url} onFocus={(x) => x.target.select()} />
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void navigator.clipboard.writeText(res.url)}>{t("copy")}</button>
          </div>
        ) : (
          <>
            <Field label={t("f.instructor")}><input className="input" value={name} onChange={(x) => setName(x.target.value)} /></Field>
            <Field label={t("f.email")}><input className="input" type="email" value={email} onChange={(x) => setEmail(x.target.value)} /></Field>
            <div className="flex justify-end">
              <button type="button" className="btn btn-primary" disabled={busy || !name.trim() || !!blanks.length || !cloud.session} onClick={() => void create()}>{t("createLink")}</button>
            </div>
            {!cloud.session && <p className="text-xs text-muted">{t("linkErr.unauthorized")}</p>}
          </>
        )}
        {err && <p className="text-sm text-warning">{err}</p>}
      </div>
    </Modal>
  );
}
