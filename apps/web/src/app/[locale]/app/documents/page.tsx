"use client";

import { Award, BadgeCheck, Bell, CalendarClock, FileText, HeartPulse, IdCard, Languages, Moon, Plane, Plus, Radio, ShieldCheck, Trash2, Users, type LucideIcon } from "lucide-react";
import { AircraftTypeInput } from "@/components/app/AircraftTypeInput";
import { ClassRatingsCard } from "@/components/app/ClassRatingsCard";
import { DocumentScan, DocumentScanButton } from "@/components/app/DocumentScan";
import { useTypes } from "@/lib/hooks";
import { AuthorityInput } from "@/components/app/AuthorityInput";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { DOCUMENT_KINDS, alertsDueToday, computeRecency, DEFAULT_ALERT_DAYS, LICENSE_CATALOGUE, licenseStatus, LPE_LANGUAGES, DOCUMENT_FORMS, MEDICAL_CLASSES, MEDICAL_LIMITATIONS, AGE_BANDS, medicalValidUntil, type AgeBand, type MedicalClass, lpeCode, lpeValidUntil, parseLpe, type License, type LicenseKind } from "@cielo/core";
import { Badge, Card, Empty, Field, Modal, PageTitle, type Level } from "@/components/app/ui";
import { useFlights, useFormatDate, useTable, useToday } from "@/lib/hooks";
import { saveLicense, softDelete } from "@/lib/repo";
import { localStore } from "@/lib/db";

// each kind of document: its icon and colour
const KIND_LOOK: Partial<Record<LicenseKind, { icon: LucideIcon; tone: string }>> = {
  licence: { icon: IdCard, tone: "#22C55E" },
  type_rating: { icon: Plane, tone: "#38BDF8" },
  rating: { icon: Plane, tone: "#38BDF8" },
  class_rating: { icon: Award, tone: "#818CF8" },
  skill_rating: { icon: Award, tone: "#A78BFA" },
  medical: { icon: HeartPulse, tone: "#F43F5E" },
  language: { icon: Languages, tone: "#F59E0B" },
  radio: { icon: Radio, tone: "#2DD4BF" },
  insurance: { icon: ShieldCheck, tone: "#64748B" },
};
const lookOf = (k: LicenseKind) => KIND_LOOK[k] ?? { icon: FileText, tone: "#94A3B8" };
// colour of the time left
const STATE_TONE = { ok: "#22C55E", info: "#38BDF8", caution: "#F59E0B", warning: "#EF4444", neutral: "#94A3B8" } as const;

type Draft = Omit<License, "id" | "createdAt" | "updatedAt" | "pilotId"> & { id?: string };
// display groups: the older single "rating" category is shown with the type ratings
const KINDS: LicenseKind[] = ["licence", "type_rating", "rating", "class_rating", "skill_rating", "medical", "language", "radio", "insurance", "endorsement", "other"];
const FORM_KINDS: LicenseKind[] = [...DOCUMENT_KINDS];
const blank = (): Draft => ({ kind: "licence", code: "", alertDays: [...DEFAULT_ALERT_DAYS] });

export default function DocumentsPage() {
  const t = useTranslations("app.documents");
  const types = useTypes();
  const [showExpiry, setShowExpiry] = useState(false);
  const td = useTranslations("app.dashboard");
  const tc = useTranslations("common");
  const licenses = useTable("licenses");
  const flights = useFlights();
  const today = useToday();
  const fd = useFormatDate();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [scan, setScan] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission), []);

  // Local reminders: once a day, notify for thresholds crossed today.
  useEffect(() => {
    if (!licenses || perm !== "granted") return;
    (async () => {
      if ((await localStore.getMeta("lastLicenseAlert")) === today) return;
      for (const { license, daysLeft } of alertsDueToday(licenses, today)) {
        new Notification(`Geardown · ${license.code}`, { body: daysLeft === 0 ? t("daysLeft", { count: 0 }) : t("daysLeft", { count: daysLeft }), icon: "/icon.svg" });
      }
      await localStore.setMeta("lastLicenseAlert", today);
    })();
  }, [licenses, perm, today, t]);

  const groups = useMemo(() => {
    const list = (licenses ?? []).map((l) => ({ l, s: licenseStatus(l, today) }));
    return KINDS.map((k) => ({ k, items: list.filter((x) => x.l.kind === k).sort((a, b) => (a.s.daysLeft ?? 1e9) - (b.s.daysLeft ?? 1e9)) })).filter((g) => g.items.length);
  }, [licenses, today]);
  const recency = useMemo(() => (flights ? computeRecency(flights, today) : null), [flights, today]);

  const level = (s: ReturnType<typeof licenseStatus>): Level =>
    s.state === "expired" ? "warning" : s.state === "expiring" ? ((s.daysLeft ?? 99) <= 30 ? "caution" : "info") : s.state === "valid" ? "ok" : "neutral";

  // how much of the validity is left (from the issue date, else a year)
  const left = (l: License, s: ReturnType<typeof licenseStatus>) => {
    if (s.daysLeft === undefined || !l.validUntil) return undefined;
    const span = l.issuedOn ? Math.max(1, Math.round((Date.parse(l.validUntil) - Date.parse(l.issuedOn)) / 86_400_000)) : 365;
    return Math.max(0, Math.min(1, s.daysLeft / span));
  };
  const summary = useMemo(() => {
    const all = (licenses ?? []).filter((l) => !l.deletedAt).map((l) => ({ l, s: licenseStatus(l, today) }));
    const dated = all.filter((x) => x.s.daysLeft !== undefined && x.s.state !== "expired").sort((a, b) => a.s.daysLeft! - b.s.daysLeft!);
    return {
      next: dated[0],
      valid: all.filter((x) => x.s.state === "valid" || x.s.state === "no_expiry").length,
      soon: all.filter((x) => x.s.state === "expiring").length,
      expired: all.filter((x) => x.s.state === "expired").length,
    };
  }, [licenses, today]);

  return (
    <>
      <PageTitle title={t("title")} subtitle={t("subtitle")} actions={<div className="flex flex-wrap gap-2"><DocumentScanButton onClick={() => setScan(true)} /><button type="button" className="btn btn-primary btn-sm" onClick={() => setDraft(blank())}><Plus size={15} /> {t("add")}</button></div>} />
      <DocumentScan open={scan} onClose={() => setScan(false)} licenses={licenses ?? []} />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          {licenses && groups.length === 0 && <Card><Empty icon={<BadgeCheck size={36} />} text={t("empty")} /></Card>}
          {groups.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
              {summary.next ? (() => {
                const { l, s } = summary.next;
                const tone = STATE_TONE[level(s)];
                const Icon = lookOf(l.kind).icon;
                return (
                  <button type="button" onClick={() => setDraft(l)} className="group relative overflow-hidden rounded-2xl border border-border bg-surface/70 p-5 text-left backdrop-blur transition hover:-translate-y-0.5">
                    <div aria-hidden className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full blur-3xl" style={{ background: tone, opacity: 0.18 }} />
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted"><CalendarClock size={14} /> {t("nextExpiry")}</p>
                    <div className="relative mt-3 flex items-end justify-between gap-4">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 truncate text-xl font-bold"><Icon size={20} style={{ color: lookOf(l.kind).tone }} /> {l.code}</p>
                        <p className="mt-1 text-sm text-muted">{l.validUntil ? `${t("validUntil")} ${fd(l.validUntil)}` : ""}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="num text-4xl font-bold leading-none" style={{ color: tone }}>{s.daysLeft}</p>
                        <p className="mt-1 text-xs text-muted">{t("daysUnit")}</p>
                      </div>
                    </div>
                  </button>
                );
              })() : <div />}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { n: summary.valid, label: t("sumValid"), tone: STATE_TONE.ok },
                  { n: summary.soon, label: t("sumSoon"), tone: STATE_TONE.caution },
                  { n: summary.expired, label: t("sumExpired"), tone: STATE_TONE.warning },
                ].map((x) => (
                  <div key={x.label} className="flex flex-col justify-between rounded-2xl border border-border bg-surface/70 p-4 backdrop-blur">
                    <span className="h-1.5 w-8 rounded-full" style={{ background: x.tone, opacity: x.n ? 1 : 0.35 }} />
                    <div>
                      <p className="num mt-3 text-3xl font-bold leading-none">{x.n}</p>
                      <p className="mt-1 text-xs text-muted">{x.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {groups.map((g) => {
            const look = lookOf(g.k);
            return (
              <section key={g.k} className="space-y-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: `color-mix(in srgb, ${look.tone} 20%, transparent)`, color: `color-mix(in srgb, ${look.tone} 75%, var(--text))` }}><look.icon size={15} /></span>
                  {t(`kinds.${g.k}`)}
                  <span className="text-sm font-normal text-muted">{g.items.length}</span>
                </h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {g.items.map(({ l, s }) => {
                    const lvl = level(s);
                    const tone = STATE_TONE[lvl];
                    const ratio = left(l, s);
                    return (
                      <button key={l.id} type="button" onClick={() => setDraft(l)} className="group relative overflow-hidden rounded-2xl border border-border bg-surface/70 p-4 text-left backdrop-blur transition hover:-translate-y-0.5 hover:border-[color:var(--accent)]/40">
                        <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: tone }} />
                        <div className="flex items-start justify-between gap-3 pl-1">
                          <div className="min-w-0">
                            <p className="line-clamp-2 text-lg font-bold leading-snug">{l.code}</p>
                            <p className="mt-0.5 truncate text-xs text-muted">{[l.authority, l.number].filter(Boolean).join(" · ") || "—"}</p>
                          </div>
                          <Badge level={lvl}>
                            {s.state === "no_expiry" ? t("state.no_expiry") : s.state === "expired" ? t("expiredSince", { count: -(s.daysLeft ?? 0) }) : t("daysLeft", { count: s.daysLeft ?? 0 })}
                          </Badge>
                        </div>
                        {ratio !== undefined ? (
                          <div className="mt-4 pl-1">
                            <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--text)]/10">
                              <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(3, ratio * 100)}%`, background: tone }} />
                            </div>
                            <p className="num mt-1.5 text-xs text-muted">{t("validUntil")} {fd(l.validUntil!)}</p>
                          </div>
                        ) : (
                          <p className="mt-4 pl-1 text-xs text-muted">{t("noExpiryHint")}</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
        <div className="min-w-0 space-y-5">
          {recency && (
            <Card title={t("recency")}>
              <div className="space-y-3 text-sm">
                {[
                  { icon: Users, tone: "#F59E0B", label: td("recencyPax"), ok: recency.passengers.valid, v: recency.passengers.valid ? fd(recency.passengers.validUntil) : `${recency.passengers.landings}/3` },
                  { icon: Moon, tone: "#818CF8", label: td("recencyNight"), ok: recency.night.valid, v: recency.night.valid ? fd(recency.night.validUntil) : "0/1" },
                ].map((x) => (
                  <div key={x.label} className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${x.tone} 20%, transparent)`, color: `color-mix(in srgb, ${x.tone} 75%, var(--text))` }}><x.icon size={17} /></span>
                    <span className="min-w-0 flex-1">{x.label}</span>
                    <Badge level={x.ok ? "ok" : "warning"}>{x.v}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {flights && <ClassRatingsCard flights={flights} types={types ?? []} licenses={(licenses ?? []).filter((l) => !l.deletedAt)} today={today} />}
          <Card title={t("notifications")}>
            {perm === "granted" ? (
              <p className="flex items-center gap-2 text-sm text-success"><Bell size={16} /> {t("notificationsOn")}</p>
            ) : perm !== "unsupported" ? (
              <button type="button" className="btn btn-secondary w-full !whitespace-normal" onClick={async () => setPerm(await Notification.requestPermission())}><Bell size={16} /> {t("enableNotifications")}</button>
            ) : null}
            <p className="mt-3 text-xs text-muted">{t("notificationsInfo")}</p>
          </Card>
        </div>
      </div>

      {/* fields shown for the category being edited */}
      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? draft.code : t("add")}>
        {draft && (() => { const form = DOCUMENT_FORMS[draft.kind]; return (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              await saveLicense(draft);
              setDraft(null);
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("kind")}>
                <select className="input" value={draft.kind} onChange={(e) => {
                  const kind = e.target.value as LicenseKind;
                  // each category starts from its own first title rather than the previous category's
                  const fits = LICENSE_CATALOGUE.some((c) => c.kind === kind && c.code === draft.code) || (kind === "language" && /^LPE/i.test(draft.code));
                  const code = fits ? draft.code : kind === "language" ? "LPE English" : kind === "medical" ? "Class 1" : "";
                  // dates and medical limitations belong to the previous category
                  const notes = (draft.notes ?? "").replace(/^Limitations?: .*$\n?/m, "").trim() || undefined;
                  setDraft({ ...draft, kind, code, issuedOn: null, validUntil: null, lastCheckOn: null, notes });
                  setShowExpiry(false);
                }}>
                  {(draft.kind === "rating" ? [...FORM_KINDS, "rating" as LicenseKind] : FORM_KINDS).map((k) => <option key={k} value={k}>{t(`kinds.${k}`)}</option>)}
                </select>
              </Field>
              {draft.kind === "language" ? (
                <LpeFields draft={draft} setDraft={setDraft} />
              ) : draft.kind === "medical" ? (
                <MedicalFields draft={draft} setDraft={setDraft} />
              ) : (
                <Field label={t(`titleFor.${draft.kind}`)}>
                  <input className="input" required list="lic-cat" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
                  <datalist id="lic-cat">{LICENSE_CATALOGUE.filter((c) => c.kind === draft.kind).map((c) => <option key={c.code} value={c.code} />)}</datalist>
                </Field>
              )}
              {(draft.kind === "rating" || draft.kind === "type_rating") && (
                <div className="sm:col-span-2">
                  <AircraftTypeInput
                    types={types ?? []}
                    value={ratedType(draft.code, types ?? [])}
                    label={t("aircraftType")}
                    hint={t("aircraftTypeHint")}
                    onPick={(ty) => setDraft({ ...draft, code: ratingTitle(ty) })}
                  />
                </div>
              )}
              {form.authority === "authority" && <AuthorityInput label={t("authority")} value={draft.authority ?? ""} onChange={(v) => setDraft({ ...draft, authority: v })} />}
              {(form.authority === "aemc" || form.authority === "organisation") && (
                <Field label={t(form.authority === "aemc" ? "aemc" : "organisation")}>
                  <input className="input" value={draft.authority ?? ""} placeholder={form.authority === "aemc" ? t("aemcPh") : ""} onChange={(e) => setDraft({ ...draft, authority: e.target.value })} />
                </Field>
              )}
              {form.number && (
                <Field label={t(draft.kind === "licence" ? "licenceNumber" : "number")}>
                  <input className="input num" value={draft.number ?? ""} placeholder={draft.kind === "licence" ? "FRA.FCL.PA00012345" : ""} onChange={(e) => setDraft({ ...draft, number: e.target.value })} />
                </Field>
              )}
              {form.issued && draft.kind !== "medical" && (
                <Field label={t(`dates.${form.issued}`)}>
                  <input
                    type="date"
                    className="input num"
                    value={draft.issuedOn ?? ""}
                    onChange={(e) => {
                      const issuedOn = e.target.value || null;
                      const lvl = draft.kind === "language" ? parseLpe(draft.code).level : undefined;
                      setDraft({ ...draft, issuedOn, ...(lvl ? { validUntil: lpeValidUntil(lvl, issuedOn) } : {}) });
                    }}
                  />
                </Field>
              )}
              {(form.validity === true || (form.validity === "optional" && (showExpiry || draft.validUntil))) && (
                <Field label={t("validUntil")}><input type="date" className="input num" value={draft.validUntil ?? ""} onChange={(e) => setDraft({ ...draft, validUntil: e.target.value || null })} /></Field>
              )}
              {form.validity === "optional" && !showExpiry && !draft.validUntil && (
                <p className="self-end pb-2 text-xs text-muted">
                  {t("noExpiryLicence")}{" "}
                  <button type="button" className="font-semibold underline" onClick={() => setShowExpiry(true)}>{t("addExpiry")}</button>
                </p>
              )}
              {form.lastCheck && (
                <Field label={t("lastCheckRating")}><input type="date" className="input num" value={draft.lastCheckOn ?? ""} onChange={(e) => setDraft({ ...draft, lastCheckOn: e.target.value || null })} /></Field>
              )}
              {(form.validity === true || draft.validUntil) && (
                <Field label={t("alertDays")}>
                  <input className="input num" value={draft.alertDays.join(", ")} onChange={(e) => setDraft({ ...draft, alertDays: e.target.value.split(/[,; ]+/).map(Number).filter((n) => Number.isFinite(n) && n >= 0) })} />
                </Field>
              )}
              <Field label={t("notes")} className="sm:col-span-2"><textarea className="input" rows={2} value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></Field>
              <Field label={t("attachment")} className="sm:col-span-2">
                <input type="file" accept="image/*,application/pdf" className="text-sm" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file || file.size > 4_000_000) return;
                  const r = new FileReader();
                  r.onload = () => setDraft({ ...draft, attachmentDataUrl: String(r.result) });
                  r.readAsDataURL(file);
                }} />
                {draft.attachmentDataUrl?.startsWith("data:image") && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={draft.attachmentDataUrl} alt="" className="mt-2 max-h-40 rounded border border-border" />
                )}
              </Field>
            </div>
            <div className="flex justify-between gap-2">
              {draft.id ? <button type="button" className="btn btn-danger btn-sm" onClick={async () => (await softDelete("licenses", draft.id!), setDraft(null))}><Trash2 size={14} /> {tc("delete")}</button> : <span />}
              <div className="flex gap-2">
                <button type="button" className="btn btn-secondary" onClick={() => setDraft(null)}>{tc("cancel")}</button>
                <button className="btn btn-primary">{tc("save")}</button>
              </div>
            </div>
          </form>
        ); })()}
      </Modal>
    </>
  );
}

/** "TR A320", "TR C680A"; class ratings ("SEP(L)", "MEP(L)") as they are. */
function ratingTitle(t: { icao: string; classOrTypeRating?: string }): string {
  const r = t.classOrTypeRating?.trim();
  if (!r) return `TR ${t.icao}`;
  return /\(|^(SEP|MEP|SET|TMG)/i.test(r) ? r : `TR ${r}`;
}

/** The ICAO type a rating title refers to ("TR A320", "A320 TR", "SEP(L)"). */
function ratedType(code: string, types: { icao: string; classOrTypeRating?: string }[]): string {
  const c = code.trim().toUpperCase();
  const m = c.match(/^TR\s+([A-Z0-9-]{2,7})\b/) ?? c.match(/^([A-Z0-9-]{2,7})\s+TR\b/);
  const r = m?.[1] ?? c;
  const same = types.filter((t) => t.classOrTypeRating?.toUpperCase() === r || t.icao === r);
  return (same.find((t) => t.icao === r) ?? same[0])?.icao ?? "";
}

/** Language proficiency: language and ICAO level instead of a free title; validity from FCL.055. */
function LpeFields({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const t = useTranslations("app.documents");
  const { language, level } = parseLpe(draft.code);
  const update = (lang: string, lvl?: number) => {
    const code = lpeCode(lang || "English", lvl);
    setDraft({ ...draft, code, validUntil: lvl ? lpeValidUntil(lvl, draft.issuedOn) : draft.validUntil });
  };
  return (
    <>
      <Field label={t("lpe.language")}>
        <input className="input" list="lpe-lang" required value={language} onChange={(e) => update(e.target.value, level)} />
        <datalist id="lpe-lang">{LPE_LANGUAGES.map((l) => <option key={l} value={l} />)}</datalist>
      </Field>
      <Field label={t("lpe.level")} className="sm:col-span-2">
        <div className="flex flex-wrap gap-2">
          {[4, 5, 6].map((n) => (
            <button key={n} type="button" aria-pressed={level === n} onClick={() => update(language, n)}
              className={`rounded-lg border px-3 py-2 text-left text-sm ${level === n ? "border-accent bg-accent/12 font-semibold" : "border-border"}`}>
              <span className="num">{n}</span> · {t(`lpe.levels.${n}`)}
              <span className="block text-xs text-muted">{t(`lpe.validity.${n}`)}</span>
            </button>
          ))}
        </div>
      </Field>
    </>
  );
}

/** Medical: class, examination date and age band give the validity (MED.A.045); limitations go in the notes. */
function MedicalFields({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const t = useTranslations("app.documents");
  const [age, setAge] = useState<AgeBand>("u40");
  const [spPax, setSpPax] = useState(false);
  const cls = (MEDICAL_CLASSES as string[]).includes(draft.code) ? (draft.code as MedicalClass) : "Class 1";
  const recompute = (patch: Partial<Draft>, a = age, sp = spPax) => {
    const next = { ...draft, ...patch };
    const c = (MEDICAL_CLASSES as string[]).includes(next.code) ? (next.code as MedicalClass) : "Class 1";
    setDraft({ ...next, validUntil: next.issuedOn ? medicalValidUntil(c, next.issuedOn, a, sp) : next.validUntil });
  };
  const lims = (draft.notes ?? "").match(/^Limitations?: (.*)$/m)?.[1]?.split(/,\s*/).filter(Boolean) ?? [];
  const toggleLim = (l: string) => {
    const set = lims.includes(l) ? lims.filter((x) => x !== l) : [...lims, l];
    const rest = (draft.notes ?? "").replace(/^Limitations?: .*$\n?/m, "").trim();
    setDraft({ ...draft, notes: [set.length ? `Limitations: ${set.join(", ")}` : "", rest].filter(Boolean).join("\n") });
  };
  const chip = (on: boolean) => `rounded-lg border px-3 py-1.5 text-sm ${on ? "border-accent bg-accent/12 font-semibold" : "border-border"}`;
  return (
    <>
      <Field label={t("medical.class")}>
        <div className="flex flex-wrap gap-2">
          {MEDICAL_CLASSES.map((c) => (
            <button key={c} type="button" aria-pressed={cls === c} className={chip(cls === c)} onClick={() => recompute({ code: c })}>{t(`medical.classes.${c.replace(/\s/g, "")}`)}</button>
          ))}
        </div>
      </Field>
      <Field label={t("dates.examOn")}>
        <input type="date" className="input num" value={draft.issuedOn ?? ""} onChange={(e) => recompute({ issuedOn: e.target.value || null })} />
      </Field>
      <Field label={t("medical.age")} className="sm:col-span-2" hint={t("medical.ageHint")}>
        <div className="flex flex-wrap gap-2">
          {AGE_BANDS.map((a) => (
            <button key={a} type="button" aria-pressed={age === a} className={chip(age === a)} onClick={() => (setAge(a), recompute({}, a))}>{t(`medical.ages.${a}`)}</button>
          ))}
        </div>
        {cls === "Class 1" && (
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={spPax} onChange={(e) => (setSpPax(e.target.checked), recompute({}, age, e.target.checked))} /> {t("medical.singlePilotPax")}
          </label>
        )}
      </Field>
      <Field label={t("medical.limitations")} className="sm:col-span-2">
        <div className="flex flex-wrap gap-1.5">
          {MEDICAL_LIMITATIONS.map((l) => (
            <button key={l} type="button" aria-pressed={lims.includes(l)} title={t(`medical.lim.${l}`)} className={`num ${chip(lims.includes(l))}`} onClick={() => toggleLim(l)}>{l}</button>
          ))}
        </div>
        {lims.length > 0 && <p className="mt-1 text-xs text-muted">{lims.map((l) => `${l} : ${t(`medical.lim.${l}`)}`).join(" · ")}</p>}
      </Field>
    </>
  );
}
