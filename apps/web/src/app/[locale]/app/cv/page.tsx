"use client";

import { AlertTriangle, Check, Copy, FileDown, FileJson, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { atsReport, buildCvDocument, buildCvPdf, cvToText, flightExperience, toJsonResume, type CvData, type CvDocument, type CvProfile } from "@cielo/cv";
import type { Job } from "@cielo/jobs";
import { Card, Field, PageTitle, Segmented, useToast, type Level } from "@/components/app/ui";
import { localStore } from "@/lib/db";
import { downloadBlob } from "@/lib/download";
import { useFlights, usePilot, useTable, useToday, useTypes } from "@/lib/hooks";

const EMPTY: CvProfile = { fullName: "", experience: [], education: [], languages: [], skills: [] };

/** Keywords an AI screener will look for in an offer: licence, aircraft names, hour categories. */
function keywordsFor(job: Job): string[] {
  const k = new Set<string>();
  if (job.requirements.licence) k.add(job.requirements.licence === "FATPL" ? "ATPL" : job.requirements.licence);
  if (job.requirements.authority) k.add(job.requirements.authority);
  const name = job.title.replace(/\(.*?\)|first officer|captain|commandant|copilot|co-pilot|\bm\/[fw]\/d\b|[-–|/]/gi, " ").replace(/\s+/g, " ").trim();
  if (name.length > 2) k.add(name);
  if (job.requirements.jetHours) k.add("Jet");
  if (job.requirements.multiPilotHours) k.add("Multi-pilot");
  if (job.requirements.picHours) k.add("PIC");
  return [...k];
}

export default function CvPage() {
  const t = useTranslations("app.cv");
  const flights = useFlights();
  const opening = useTable("opening_balances");
  const licenses = useTable("licenses");
  const types = useTypes();
  const pilot = usePilot();
  const today = useToday();
  const { toast, toastNode } = useToast();
  const [profile, setProfile] = useState<CvProfile | null>(null);
  const [locale, setLocale] = useState<"en" | "fr">("en");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [targetId, setTargetId] = useState("");
  const loaded = useRef(false);

  // The CV draft lives on this device, next to the logbook
  useEffect(() => {
    if (loaded.current || !pilot) return;
    loaded.current = true;
    localStore.getMeta("cv").then((raw) => {
      const saved = raw ? (JSON.parse(raw) as CvProfile) : null;
      setProfile({ ...EMPTY, fullName: pilot.fullName, email: pilot.email || undefined, ...saved });
    });
    fetch("/api/jobs")
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((d: { jobs: Job[] }) => setJobs(d.jobs ?? []))
      .catch(() => {});
  }, [pilot]);
  useEffect(() => {
    if (profile) localStore.setMeta("cv", JSON.stringify(profile));
  }, [profile]);

  const set = <K extends keyof CvProfile>(k: K, v: CvProfile[K]) => setProfile((p) => (p ? { ...p, [k]: v } : p));

  const data: CvData | null = useMemo(() => {
    if (!profile || !flights || !opening || !licenses || !types) return null;
    const byIcao = new Map(types.map((x) => [x.icao, x]));
    const hours = flightExperience(flights, opening, (i) => byIcao.get(i), today);
    return { profile, hours, locale, licences: licenses.map((l) => ({ kind: l.kind, code: l.code, authority: l.authority, number: l.number, validUntil: l.validUntil, issuedOn: l.issuedOn })) };
  }, [profile, flights, opening, licenses, types, today, locale]);
  const doc: CvDocument | null = useMemo(() => (data ? buildCvDocument(data) : null), [data]);
  const text = useMemo(() => (doc ? cvToText(doc) : ""), [doc]);
  const report = useMemo(() => (data && doc ? atsReport(data, doc, text, today) : null), [data, doc, text, today]);

  if (!profile || !data || !doc || !report) return <p className="text-muted">…</p>;

  const pickTarget = (id: string) => {
    setTargetId(id);
    const job = jobs.find((j) => j.id === id);
    set("target", job ? { title: job.title, company: job.company, aircraft: job.aircraft.slice(0, 3), keywords: keywordsFor(job) } : undefined);
  };

  const download = async () => {
    const bytes = await buildCvPdf(doc, { jsonResume: toJsonResume(data), lang: locale, author: profile.fullName });
    const slug = (profile.fullName || "pilot").toLowerCase().normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");
    downloadBlob(bytes as BlobPart, `cv-${slug}-${locale}.pdf`, "application/pdf");
  };

  return (
    <>
      <PageTitle
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <>
            <Segmented value={locale} onChange={setLocale} options={[{ value: "en", label: t("en") }, { value: "fr", label: t("fr") }]} />
            <button type="button" className="btn btn-secondary btn-sm" onClick={async () => (await navigator.clipboard.writeText(text), toast(t("copied")))}>
              <Copy size={15} aria-hidden /> {t("copy")}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => downloadBlob(JSON.stringify(toJsonResume(data), null, 2), "resume.json", "application/json")}>
              <FileJson size={15} aria-hidden /> JSON
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={download}>
              <FileDown size={15} aria-hidden /> {t("download")}
            </button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* ---------- Editor ---------- */}
        <div className="min-w-0 space-y-5">
          <Card title={t("sections.target")}>
            <Field label={t("target.pick")} hint={t("target.help")}>
              <select className="input" value={targetId} onChange={(e) => pickTarget(e.target.value)}>
                <option value="">{t("target.none")}</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.company} — {j.title}</option>
                ))}
              </select>
            </Field>
          </Card>

          <Card title={t("sections.identity")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("f.fullName")}><input className="input" value={profile.fullName} onChange={(e) => set("fullName", e.target.value)} /></Field>
              <Field label={t("f.headline")}><input className="input" placeholder={t("f.headlinePh")} value={profile.headline ?? ""} onChange={(e) => set("headline", e.target.value)} /></Field>
              <Field label={t("f.email")}><input className="input" type="email" value={profile.email ?? ""} onChange={(e) => set("email", e.target.value)} /></Field>
              <Field label={t("f.phone")}><input className="input" type="tel" value={profile.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></Field>
              <Field label={t("f.location")}><input className="input" value={profile.location ?? ""} onChange={(e) => set("location", e.target.value)} /></Field>
              <Field label={t("f.nationality")}><input className="input" value={profile.nationality ?? ""} onChange={(e) => set("nationality", e.target.value)} /></Field>
              <Field label={t("f.rightToWork")}><input className="input" placeholder={t("f.rightToWorkPh")} value={profile.rightToWork ?? ""} onChange={(e) => set("rightToWork", e.target.value)} /></Field>
              <Field label={t("f.linkedin")}><input className="input" value={profile.linkedin ?? ""} onChange={(e) => set("linkedin", e.target.value)} /></Field>
            </div>
          </Card>

          <Card title={t("sections.summary")}>
            <Field label={t("f.summary")} hint={t("f.words", { count: profile.summary?.trim() ? profile.summary.trim().split(/\s+/).length : 0 })}>
              <textarea className="input" rows={4} value={profile.summary ?? ""} onChange={(e) => set("summary", e.target.value)} />
            </Field>
          </Card>

          <Card title={t("sections.experience")} action={<AddBtn onClick={() => set("experience", [...profile.experience, { role: "", employer: "", start: "", bullets: [] }])} />}>
            <div className="space-y-4">
              {profile.experience.map((x, i) => {
                const upd = (patch: Partial<typeof x>) => set("experience", profile.experience.map((e, j) => (j === i ? { ...e, ...patch } : e)));
                return (
                  <div key={i} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
                    <Field label={t("f.role")}><input className="input" value={x.role} onChange={(e) => upd({ role: e.target.value })} /></Field>
                    <Field label={t("f.employer")}><input className="input" value={x.employer} onChange={(e) => upd({ employer: e.target.value })} /></Field>
                    <Field label={t("f.start")}><input className="input num" type="month" value={x.start} onChange={(e) => upd({ start: e.target.value })} /></Field>
                    <Field label={t("f.end")}><input className="input num" type="month" value={x.end ?? ""} onChange={(e) => upd({ end: e.target.value || undefined })} /></Field>
                    <Field label={t("f.aircraft")} className="sm:col-span-2"><input className="input num uppercase" value={(x.aircraft ?? []).join(", ")} onChange={(e) => upd({ aircraft: e.target.value.toUpperCase().split(/[,\s]+/).filter(Boolean) })} /></Field>
                    <Field label={t("f.bullets")} className="sm:col-span-2"><textarea className="input" rows={3} value={x.bullets.join("\n")} onChange={(e) => upd({ bullets: e.target.value.split("\n") })} /></Field>
                    <RemoveBtn onClick={() => set("experience", profile.experience.filter((_, j) => j !== i))} />
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title={t("sections.education")} action={<AddBtn onClick={() => set("education", [...profile.education, { title: "", school: "" }])} />}>
            <div className="space-y-3">
              {profile.education.map((x, i) => {
                const upd = (patch: Partial<typeof x>) => set("education", profile.education.map((e, j) => (j === i ? { ...e, ...patch } : e)));
                return (
                  <div key={i} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
                    <Field label={t("f.titleEdu")}><input className="input" value={x.title} onChange={(e) => upd({ title: e.target.value })} /></Field>
                    <Field label={t("f.school")}><input className="input" value={x.school} onChange={(e) => upd({ school: e.target.value })} /></Field>
                    <Field label={t("f.start")}><input className="input num" type="month" value={x.start ?? ""} onChange={(e) => upd({ start: e.target.value })} /></Field>
                    <Field label={t("f.end")}><input className="input num" type="month" value={x.end ?? ""} onChange={(e) => upd({ end: e.target.value })} /></Field>
                    <RemoveBtn onClick={() => set("education", profile.education.filter((_, j) => j !== i))} />
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title={t("sections.languages")} action={<AddBtn onClick={() => set("languages", [...profile.languages, { name: "" }])} />}>
            <div className="space-y-2">
              {profile.languages.map((x, i) => {
                const upd = (patch: Partial<typeof x>) => set("languages", profile.languages.map((e, j) => (j === i ? { ...e, ...patch } : e)));
                return (
                  <div key={i} className="grid grid-cols-[1fr_110px_1fr_auto] items-end gap-2">
                    <Field label={t("f.language")}><input className="input" value={x.name} onChange={(e) => upd({ name: e.target.value })} /></Field>
                    <Field label={t("f.icao")}>
                      <select className="input" value={x.icaoLevel ?? ""} onChange={(e) => upd({ icaoLevel: e.target.value ? Number(e.target.value) : undefined })}>
                        <option value="">—</option>
                        {[4, 5, 6].map((n) => <option key={n}>{n}</option>)}
                      </select>
                    </Field>
                    <Field label={t("f.level")}><input className="input" value={x.level ?? ""} onChange={(e) => upd({ level: e.target.value })} /></Field>
                    <button type="button" className="btn btn-ghost !px-2" aria-label={t("f.remove")} onClick={() => set("languages", profile.languages.filter((_, j) => j !== i))}><X size={16} /></button>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title={t("sections.skills")}>
            <Field label={t("f.skills")}>
              <input className="input" value={profile.skills.join(", ")} onChange={(e) => set("skills", e.target.value.split(",").map((s) => s.trimStart()).filter((s, i, a) => s || i === a.length - 1))} />
            </Field>
          </Card>
        </div>

        {/* ---------- Check + preview ---------- */}
        <div className="min-w-0 space-y-5 xl:sticky xl:top-6 xl:self-start">
          <AtsPanel report={report} />
          <Preview doc={doc} />
          <p className="text-xs text-muted">{t("tips")}</p>
        </div>
      </div>
      {toastNode}
    </>
  );
}

function AddBtn({ onClick }: { onClick: () => void }) {
  const t = useTranslations("app.cv.f");
  return (
    <button type="button" className="btn btn-ghost btn-sm" onClick={onClick}>
      <Plus size={14} aria-hidden /> {t("add")}
    </button>
  );
}
function RemoveBtn({ onClick }: { onClick: () => void }) {
  const t = useTranslations("app.cv.f");
  return (
    <div className="sm:col-span-2">
      <button type="button" className="btn btn-ghost btn-sm text-warning" onClick={onClick}>
        <Trash2 size={14} aria-hidden /> {t("remove")}
      </button>
    </div>
  );
}

const RING: Record<Level, string> = { ok: "var(--success)", info: "var(--accent)", caution: "var(--caution)", warning: "var(--warning)", neutral: "var(--muted)" };

function AtsPanel({ report }: { report: ReturnType<typeof atsReport> }) {
  const t = useTranslations("app.cv.ats");
  const level: Level = report.score >= 85 ? "ok" : report.score >= 65 ? "info" : "caution";
  const issues = report.checks.filter((c) => c.status !== "ok");
  const ok = report.checks.filter((c) => c.status === "ok");
  return (
    <Card title={t("title")}>
      <div className="flex items-center gap-4">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(${RING[level]} ${report.score * 3.6}deg, var(--surface-2) 0)` }} role="img" aria-label={`${report.score} %`}>
          <span className="num flex h-[52px] w-[52px] items-center justify-center rounded-full bg-surface text-base font-semibold">{report.score}%</span>
        </div>
        <p className="text-sm text-muted">{t("subtitle")}</p>
      </div>
      <ul className="mt-4 space-y-1.5 text-sm">
        {[...issues, ...ok].map((c) => (
          <li key={c.code} className="flex items-start gap-2">
            {c.status === "ok" ? <Check size={15} className="mt-0.5 shrink-0 text-success" aria-label="OK" /> : c.status === "warn" ? <AlertTriangle size={15} className="mt-0.5 shrink-0 text-caution" aria-label="!" /> : <X size={15} className="mt-0.5 shrink-0 text-warning" aria-label="✗" />}
            <span className={c.status === "ok" ? "text-muted" : ""}>{t(`checks.${c.code}`, { detail: c.detail ?? "" })}</span>
          </li>
        ))}
      </ul>
      {report.keywords.found.length + report.keywords.missing.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
          {report.keywords.found.length > 0 && <KwRow label={t("keywordsFound")} items={report.keywords.found} ok />}
          {report.keywords.missing.length > 0 && <KwRow label={t("keywordsMissing")} items={report.keywords.missing} />}
        </div>
      )}
    </Card>
  );
}
function KwRow({ label, items, ok }: { label: string; items: string[]; ok?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {items.map((k) => (
          <span key={k} className={`rounded-md px-2 py-0.5 text-xs font-semibold ${ok ? "bg-success/12 text-success" : "bg-caution/12 text-caution"}`}>{k}</span>
        ))}
      </div>
    </div>
  );
}

/** On-screen rendering of exactly what goes into the PDF. */
function Preview({ doc }: { doc: CvDocument }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white text-[#0f172a] shadow-sm">
      <div className="max-h-[78svh] overflow-auto px-7 py-6 text-[13px] leading-relaxed">
        <p className="text-2xl font-bold">{doc.name}</p>
        <p className="text-[#475569]">{doc.headline}</p>
        {doc.sections.map((s) => (
          <section key={s.id} className="mt-5">
            <h3 className="border-b border-[#cbd5e1] pb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#15803d]">{s.heading}</h3>
            <div className="mt-1.5 space-y-1">
              {s.lines.map((l, i) =>
                l.kind === "pair" ? (
                  <p key={i} className="grid grid-cols-[minmax(0,210px)_1fr] gap-3">
                    <span className={l.strong ? "font-semibold" : "text-[#475569]"}>{l.label}</span>
                    <span className={`num ${l.strong ? "font-semibold" : ""}`}>{l.value}</span>
                  </p>
                ) : l.kind === "text" ? (
                  <p key={i}>{l.text}</p>
                ) : (
                  <div key={i} className="pt-1">
                    <p className="font-semibold">{l.title}</p>
                    {l.meta && <p className="text-[12px] text-[#475569]">{l.meta}</p>}
                    {!!l.bullets?.length && (
                      <ul className="mt-0.5 list-disc pl-5">
                        {l.bullets.map((b, j) => <li key={j}>{b}</li>)}
                      </ul>
                    )}
                  </div>
                ),
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
