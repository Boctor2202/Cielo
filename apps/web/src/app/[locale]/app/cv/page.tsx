"use client";

import { AlertTriangle, Check, Copy, FileDown, FileJson, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { countryName } from "@cielo/core";
import { atsReport, buildApplicationPack, buildCvDocument, buildCvPdf, cvToText, CV_THEMES, flightExperience, toJsonResume, type CvData, type CvDocument, type CvProfile, type CvTheme } from "@cielo/cv";
import type { Job } from "@cielo/jobs";
import { Card, Field, PageTitle, Segmented, useToast, type Level } from "@/components/app/ui";
import { localStore } from "@/lib/db";
import { downloadBlob } from "@/lib/download";
import { useFlights, usePilot, useTable, useToday, useTypes } from "@/lib/hooks";

/** order of the documents in the application pack (insurance stays out) */
const PACK_ORDER: string[] = ["licence", "type_rating", "rating", "class_rating", "skill_rating", "medical", "language", "radio", "endorsement", "other"];

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
  const uiLocale = useLocale();
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
      // what the profile already knows fills the empty CV fields
      const known = { fullName: pilot.fullName, email: pilot.email || undefined, phone: pilot.phone || undefined, nationality: pilot.nationality ? countryName(pilot.nationality, uiLocale) : undefined };
      const merged = { ...EMPTY, ...known, ...saved };
      for (const k of Object.keys(known) as (keyof typeof known)[]) if (!merged[k]) merged[k] = known[k] as never;
      setProfile(merged);
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

  const photoUrl = profile.photo ? pilot?.photoDataUrl : undefined;
  const loadFonts = async () => {
    const font = async (w: number) => new Uint8Array(await (await fetch(`/fonts/cv/Inter-${w}.ttf`)).arrayBuffer());
    return Promise.all([font(400), font(600), font(700)])
      .then(([regular, semibold, bold]) => ({ regular, semibold, bold }))
      .catch(() => undefined);
  };
  /** CV + flight-hours statement + licences + scans, in one PDF for a recruiter. */
  const downloadPack = async () => {
    const fonts = await loadFonts();
    const cvPdf = await buildCvPdf(doc, { jsonResume: toJsonResume(data), lang: locale, author: profile.fullName, theme: profile.theme, fonts, photo: photoUrl ? await squareJpeg(photoUrl) : undefined });
    const order = PACK_ORDER;
    const bytes = await buildApplicationPack({
      cvPdf,
      hours: data.hours,
      documents: (licenses ?? [])
        .filter((l) => !l.deletedAt && l.kind !== "insurance")
        .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
        .map((l) => ({ kind: l.kind, code: l.code, authority: l.authority, number: l.number, validUntil: l.validUntil, issuedOn: l.issuedOn, attachmentDataUrl: l.attachmentDataUrl })),
      pilotName: profile.fullName || pilot?.fullName || "",
      licenceNumber: pilot?.licenceNumber || undefined,
      locale,
      theme: profile.theme,
      fonts,
      today,
    });
    const slug = (profile.fullName || "pilot").toLowerCase().normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");
    downloadBlob(bytes as BlobPart, `${locale === "fr" ? "dossier-candidature" : "application-pack"}-${slug}.pdf`, "application/pdf");
  };
  const download = async () => {
    const fonts = await loadFonts();
    const bytes = await buildCvPdf(doc, {
      jsonResume: toJsonResume(data),
      lang: locale,
      author: profile.fullName,
      theme: profile.theme,
      fonts,
      photo: photoUrl ? await squareJpeg(photoUrl) : undefined,
    });
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
            <button type="button" className="btn btn-secondary btn-sm" onClick={downloadPack} title={t("packHint")}>
              <FileDown size={15} aria-hidden /> {t("pack")}
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

          <Card title={t("design.look")}>
            <div className="space-y-4">
              <Field label={t("design.theme")}>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(CV_THEMES) as CvTheme[]).map((k) => {
                    const on = (profile.theme ?? "navy") === k;
                    return (
                      <button key={k} type="button" onClick={() => set("theme", k)} aria-pressed={on}
                        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${on ? "border-accent bg-accent/10 font-semibold" : "border-border"}`}>
                        <span className="h-4 w-4 rounded-full" style={{ background: `linear-gradient(135deg, ${CV_THEMES[k].swatch} 55%, ${CV_THEMES[k].accent} 55%)` }} />
                        {t(`design.themes.${k}`)}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!profile.photo} disabled={!pilot?.photoDataUrl} onChange={(e) => set("photo", e.target.checked)} />
                {t("design.photo")}
              </label>
              {!pilot?.photoDataUrl && <p className="text-xs text-muted">{t("design.noPhoto")}</p>}
            </div>
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
                  <div key={i} className="grid grid-cols-[1fr_100px_1.2fr_auto] items-end gap-2">
                    <Field label={t("f.language")}>
                      <input className="input" list="cv-langs" value={x.name} onChange={(e) => upd({ name: e.target.value })} />
                      <datalist id="cv-langs">{(t.raw("langs") as string[]).map((l) => <option key={l} value={l} />)}</datalist>
                    </Field>
                    <Field label={t("f.icao")}>
                      <select className="input" value={x.icaoLevel ?? ""} onChange={(e) => upd({ icaoLevel: e.target.value ? Number(e.target.value) : undefined })}>
                        <option value="">—</option>
                        {[4, 5, 6].map((n) => <option key={n}>{n}</option>)}
                      </select>
                    </Field>
                    <Field label={t("f.level")}>
                      <select className="input" value={x.level ?? ""} onChange={(e) => upd({ level: e.target.value || undefined })}>
                        <option value="">—</option>
                        {(t.raw("levels") as string[]).map((l) => <option key={l} value={l}>{l}</option>)}
                        {x.level && !(t.raw("levels") as string[]).includes(x.level) && <option value={x.level}>{x.level}</option>}
                      </select>
                    </Field>
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
          <Preview doc={doc} theme={profile.theme ?? "navy"} photo={photoUrl} />
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

/** The photo as a square JPEG (the PDF takes PNG or JPEG; profile photos can be anything the browser reads). */
async function squareJpeg(url: string): Promise<Uint8Array | undefined> {
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const c = document.createElement("canvas");
    c.width = c.height = Math.min(600, side);
    c.getContext("2d")!.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.9));
    return blob ? new Uint8Array(await blob.arrayBuffer()) : undefined;
  } catch {
    return undefined;
  }
}

/** On-screen rendering of the PDF: same structure, same layout, same colours. */
function Preview({ doc, theme, photo }: { doc: CvDocument; theme: CvTheme; photo?: string }) {
  const c = CV_THEMES[theme];
  const contact = doc.sections.find((s) => s.id === "contact");
  const items = (s: CvDocument["sections"][number]) => s.lines.filter((l) => l.kind === "item") as Extract<CvDocument["sections"][number]["lines"][number], { kind: "item" }>[];
  const pairs = (s: CvDocument["sections"][number]) => s.lines.filter((l) => l.kind === "pair") as Extract<CvDocument["sections"][number]["lines"][number], { kind: "pair" }>[];
  const texts = (s: CvDocument["sections"][number]) => s.lines.filter((l) => l.kind === "text") as Extract<CvDocument["sections"][number]["lines"][number], { kind: "text" }>[];
  const Pill = ({ a, b }: { a: string; b?: string }) => (
    <span className="rounded-full px-2.5 py-1 text-[11px]" style={{ background: c.tint }}>
      <b style={{ color: c.dark }}>{a}</b>{b && <span className="ml-1.5 text-[#5B6878]">{b}</span>}
    </span>
  );
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white text-[#16202C] shadow-sm" style={{ fontFamily: "\"CV Inter\", sans-serif" }}>
      <div className="max-h-[78svh] overflow-auto text-[12px] leading-relaxed">
        <div className="flex items-center gap-5 px-7 py-6 text-white" style={{ background: c.dark, borderBottom: `3px solid ${c.accent}` }}>
          <div className="min-w-0 flex-1">
            <p className="text-[26px] font-bold leading-tight">{doc.name}</p>
            {doc.headline && <p className="mt-1 text-[13px] text-[#C9D3DF]">{doc.headline}</p>}
            {contact && <p className="mt-3 text-[11px] text-[#E8EDF3]">{pairs(contact).map((p) => p.value).join("   ·   ")}</p>}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
          {photo && <img src={photo} alt="" className="h-20 w-20 shrink-0 rounded-full border-[3px] border-white object-cover" />}
        </div>
        <div className="px-7 pb-7">
          <div className="mt-4 grid grid-cols-4 rounded-lg py-3" style={{ background: c.tint }}>
            {doc.figures.map((f, i) => (
              <div key={f.label} className={`text-center ${i ? "border-l border-[#DCE2E9]" : ""}`}>
                <p className="num text-[18px] font-bold" style={{ color: c.dark }}>{f.value}</p>
                <p className="text-[9px] font-semibold uppercase" style={{ color: c.accent }}>{f.label}</p>
              </div>
            ))}
          </div>
          {doc.sections.filter((s) => s.id !== "contact").map((s) => (
            <section key={s.id} className="mt-5">
              <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase" style={{ color: c.dark }}>
                <span className="h-3 w-[3px]" style={{ background: c.accent }} />{s.heading}<span className="h-px flex-1 bg-[#DCE2E9]" />
              </h3>
              {s.id === "hours" ? (
                <>
                  <div className="mt-2 grid grid-cols-2 gap-x-6">
                    {pairs(s).map((p) => (
                      <p key={p.label} className="flex justify-between border-b border-[#DCE2E9] py-0.5">
                        <span className={p.strong ? "font-semibold" : "text-[#5B6878]"}>{p.label}</span>
                        <span className="num font-semibold" style={p.strong ? { color: c.dark } : undefined}>{p.value}</span>
                      </p>
                    ))}
                  </div>
                  {texts(s).map((x, i) => <p key={i} className="mt-1 text-[10px] text-[#5B6878]">{x.text}</p>)}
                </>
              ) : s.id === "types" ? (
                <div className="mt-2 space-y-2.5">
                  {items(s).map((it) => (
                    <div key={it.title}>
                      <p className="flex justify-between font-semibold"><span>{it.title}</span><span className="num" style={{ color: c.dark }}>{it.value}</span></p>
                      <div className="mt-1 h-1 rounded-full" style={{ background: c.tint }}><div className="h-1 rounded-full" style={{ width: `${Math.round((it.ratio ?? 0) * 100)}%`, background: c.accent }} /></div>
                      {it.meta && <p className="mt-0.5 text-[10px] text-[#5B6878]">{it.meta.split(" · ").slice(it.value ? 1 : 0).join("  ·  ")}</p>}
                    </div>
                  ))}
                </div>
              ) : s.id === "experience" || s.id === "education" ? (
                <div className="mt-2 space-y-3">
                  {items(s).map((it, i) => (
                    <div key={i} className="grid grid-cols-[92px_1fr] gap-4">
                      <p className="text-[10.5px] font-semibold" style={{ color: c.accent }}>{it.when}</p>
                      <div className="border-l border-[#DCE2E9] pl-3.5">
                        <p className="font-bold">{it.title}</p>
                        {it.meta && <p className="text-[10.5px] text-[#5B6878]">{it.meta}</p>}
                        {!!it.bullets?.length && <ul className="mt-0.5 list-disc pl-4 marker:text-[var(--m)]" style={{ ["--m" as string]: c.accent }}>{it.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : s.id === "languages" ? (
                <div className="mt-2 flex flex-wrap gap-1.5">{pairs(s).map((p) => <Pill key={p.label} a={p.label} b={p.value === "—" ? undefined : p.value} />)}</div>
              ) : s.id === "skills" ? (
                <div className="mt-2 flex flex-wrap gap-1.5">{texts(s).flatMap((x) => x.text.split(" · ")).map((a) => <Pill key={a} a={a} />)}</div>
              ) : (
                <div className="mt-2 space-y-1">
                  {s.id === "licences" ? (
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                      {items(s).map((it) => (
                        <div key={it.title} className="border-l-2 pl-2.5" style={{ borderColor: c.accent }}>
                          <p className="font-semibold">{it.title}</p>
                          {it.meta && <p className="text-[10.5px] text-[#5B6878]">{it.meta}</p>}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {pairs(s).map((p) => (
                    <p key={p.label}>{s.id === "summary" ? <><b style={{ color: c.accent }}>{p.label} : </b><b>{p.value}</b></> : <>{p.label} — {p.value}</>}</p>
                  ))}
                  {texts(s).map((x, i) => <p key={i}>{x.text}</p>)}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
