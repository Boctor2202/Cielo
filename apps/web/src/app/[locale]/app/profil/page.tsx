"use client";

import { Roll } from "@/components/ui/Roll";
import { Settings2, BadgeCheck, Camera, Check, Pencil, Plane, Trash2, X } from "lucide-react";
import { CountryInput } from "@/components/app/CountryInput";
import { AirportInput } from "@/components/app/AirportInput";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatPhoneIntl, AUTHORITIES, RANKS, countryName, licenseStatus, type Pilot } from "@cielo/core";
import { flightExperience } from "@cielo/cv";
import { Badge, Card, Field, useToast, type Level } from "@/components/app/ui";
import { Link } from "@/i18n/navigation";
import { useDuration, useFlights, usePilot, useTable, useToday, useTypes } from "@/lib/hooks";
import { updatePilot } from "@/lib/repo";
import { localStore } from "@/lib/db";
import { PilotEntrance } from "./PilotEntrance";


type Draft = Pick<Pilot, "fullName" | "rank" | "employer" | "homeBaseIcao" | "nationality" | "licenceNumber" | "phone" | "bio" | "photoDataUrl">;

/** Square, centre-cropped JPEG small enough to sync with the profile (≈ 30–60 kB). */
async function photoFromFile(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  c.getContext("2d")!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 512, 512);
  bmp.close();
  let q = 0.86;
  let url = c.toDataURL("image/jpeg", q);
  while (url.length > 380_000 && q > 0.4) url = c.toDataURL("image/jpeg", (q -= 0.1));
  return url;
}

export default function ProfilePage() {
  const t = useTranslations("app.profile");
  const tk = useTranslations("app.documents");
  const pilot = usePilot();
  const flights = useFlights();
  const opening = useTable("opening_balances");
  const licenses = useTable("licenses");
  const types = useTypes();
  const today = useToday();
  const dur = useDuration();
  const { toast, toastNode } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const locale = useLocale();
  /** What the app already knows elsewhere: the licence document, its authority's country, the CV draft. */
  const [cvPhone, setCvPhone] = useState<string | undefined>();
  useEffect(() => {
    localStore.getMeta("cv").then((raw) => raw && setCvPhone((JSON.parse(raw) as { phone?: string }).phone || undefined));
  }, []);
  const known = useMemo(() => {
    const lic = (licenses ?? []).find((l) => !l.deletedAt && l.kind === "licence" && l.number);
    const auth = (licenses ?? []).map((l) => AUTHORITIES.find((a) => a.label === l.authority)).find((a) => a && a.country !== "EU");
    return { licenceNumber: lic?.number, country: auth?.country, phone: cvPhone };
  }, [licenses, cvPhone]);

  useEffect(() => {
    // empty fields start from what the app already knows (licence document, CV draft); nothing is saved until "Save"
    if (pilot && !editing) setDraft({ fullName: pilot.fullName, rank: pilot.rank, employer: pilot.employer, homeBaseIcao: pilot.homeBaseIcao, nationality: pilot.nationality, licenceNumber: pilot.licenceNumber || known.licenceNumber, phone: pilot.phone || known.phone, bio: pilot.bio, photoDataUrl: pilot.photoDataUrl });
  }, [pilot, editing, known]);

  const hours = useMemo(() => {
    if (!flights || !opening || !types) return null;
    const byIcao = new Map(types.map((x) => [x.icao, x]));
    return flightExperience(flights, opening, (i) => byIcao.get(i), today);
  }, [flights, opening, types, today]);

  const docs = useMemo(
    () =>
      (licenses ?? [])
        .filter((l) => !l.deletedAt)
        .map((l) => ({ l, s: licenseStatus(l, today) }))
        .sort((a, b) => ["licence", "rating", "medical", "endorsement", "language", "other"].indexOf(a.l.kind) - ["licence", "rating", "medical", "endorsement", "language", "other"].indexOf(b.l.kind)),
    [licenses, today],
  );

  if (!pilot || !draft) return <p className="text-muted">…</p>;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const save = async () => {
    await updatePilot({ ...draft, fullName: draft.fullName.trim(), homeBaseIcao: draft.homeBaseIcao?.trim().toUpperCase() || undefined, nationality: draft.nationality?.trim().toUpperCase() || undefined, licenceNumber: draft.licenceNumber?.trim() || undefined, phone: formatPhoneIntl(draft.phone, draft.nationality?.trim() || pilot?.nationality) || undefined });
    setEditing(false);
    toast(t("saved"));
  };
  const onPhoto = async (f?: File) => {
    if (!f) return;
    try {
      set("photoDataUrl", await photoFromFile(f));
    } catch {
      toast(t("photoError"));
    }
  };

  const level = (s: ReturnType<typeof licenseStatus>): Level =>
    s.state === "expired" ? "warning" : s.state === "expiring" ? ((s.daysLeft ?? 99) <= 30 ? "caution" : "info") : s.state === "valid" ? "ok" : "neutral";
  const subtitle = [pilot.rank, pilot.employer, pilot.homeBaseIcao].filter(Boolean).join(" · ");
  const stats = hours
    ? [
        { k: t("h.total"), v: hours.totalMin },
        { k: t("h.pic"), v: hours.picMin },
        { k: t("h.multiPilot"), v: hours.multiPilotMin },
        { k: t("h.turbine"), v: hours.turbineMin },
        { k: t("h.night"), v: hours.nightMin },
        { k: t("h.ifr"), v: hours.ifrMin },
        { k: t("h.last90"), v: hours.last90dMin },
        { k: t("h.landings"), v: hours.landings, raw: true },
      ]
    : [];

  return (
    <div className="space-y-6">
      {toastNode}
      {/* Name at the top of the page */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="mono-label">{t("eyebrow")}</p>
          <h1 className="mt-2 font-display text-[2.4rem] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-5xl">{pilot.fullName || t("noName")}</h1>
          {subtitle && <p className="mt-2 text-lg text-muted">{subtitle}</p>}
        </div>
        {!editing ? (
          <button className="btn btn-primary" onClick={() => setEditing(true)}>
            <Pencil size={16} /> {t("edit")}
          </button>
        ) : (
          <div className="flex gap-2">
            <button className="btn border border-border" onClick={() => setEditing(false)}>
              <X size={16} /> {t("cancel")}
            </button>
            <button className="btn btn-primary" onClick={save} disabled={!draft.fullName.trim()}>
              <Check size={16} /> {t("save")}
            </button>
          </div>
        )}
      </header>

      <PilotEntrance photo={editing ? draft.photoDataUrl : pilot.photoDataUrl} name={pilot.fullName} rank={pilot.rank} employer={pilot.employer} base={pilot.homeBaseIcao} />

      {editing && (
        <Card title={t("editTitle")}>
          <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
            <div className="flex flex-col items-start gap-3">
              <div className="h-40 w-40 overflow-hidden rounded-2xl border border-border bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {draft.photoDataUrl ? <img src={draft.photoDataUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-muted"><Camera size={32} /></div>}
              </div>
              <label className="btn cursor-pointer border border-border text-sm">
                <Camera size={16} /> {draft.photoDataUrl ? t("changePhoto") : t("addPhoto")}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
              </label>
              {draft.photoDataUrl && (
                <button className="btn text-sm text-muted" onClick={() => set("photoDataUrl", undefined)}>
                  <Trash2 size={16} /> {t("removePhoto")}
                </button>
              )}
              <p className="text-xs text-muted">{t("photoHint")}</p>
            </div>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <Field label={t("f.fullName")}><input id="p-name" className="input" value={draft.fullName} onChange={(e) => set("fullName", e.target.value)} /></Field>
              <Field label={t("f.rank")}>
                <input id="p-rank" className="input" list="p-ranks" value={draft.rank ?? ""} onChange={(e) => set("rank", e.target.value || undefined)} />
                <datalist id="p-ranks">{RANKS.map((r) => <option key={r} value={r} />)}</datalist>
              </Field>
              <Field label={t("f.employer")}><input id="p-employer" className="input" value={draft.employer ?? ""} onChange={(e) => set("employer", e.target.value || undefined)} /></Field>
              <AirportInput label={t("f.base")} value={draft.homeBaseIcao ?? ""} onChange={(x) => set("homeBaseIcao", x || undefined)} />
              <CountryInput
                label={t("f.nationality")}
                value={draft.nationality}
                onChange={(v) => set("nationality", v)}
                hint={
                  !draft.nationality && known.country ? (
                    <button type="button" className="font-semibold text-accent underline" onClick={() => set("nationality", known.country)}>
                      {t("f.suggestCountry", { country: countryName(known.country, locale) })}
                    </button>
                  ) : undefined
                }
              />
              <Field label={t("f.licenceNumber")} hint={known.licenceNumber && draft.licenceNumber === known.licenceNumber ? t("f.fromLicence") : undefined}><input id="p-lic" className="input num" value={draft.licenceNumber ?? ""} onChange={(e) => set("licenceNumber", e.target.value || undefined)} /></Field>
              <Field label={t("f.phone")} hint={known.phone && draft.phone === known.phone && !pilot.phone ? t("f.fromCv") : undefined}><input id="p-phone" className="input" type="tel" value={draft.phone ?? ""} onChange={(e) => set("phone", e.target.value || undefined)} onBlur={() => set("phone", formatPhoneIntl(draft.phone, draft.nationality || pilot?.nationality) || undefined)} placeholder="+33 6 12 34 56 78" /></Field>
              <Field label={t("f.email")}><input id="p-email" className="input" value={pilot.email} disabled /></Field>
              <Field label={t("f.bio")} className="sm:col-span-2"><textarea id="p-bio" className="input min-h-28" maxLength={600} value={draft.bio ?? ""} onChange={(e) => set("bio", e.target.value || undefined)} /></Field>
            </div>
          </div>
        </Card>
      )}

      {pilot.bio && !editing && (
        <Card title={t("about")}>
          <p className="max-w-[70ch] whitespace-pre-line leading-relaxed">{pilot.bio}</p>
        </Card>
      )}

      <Card title={t("experience")} action={hours?.asOf ? <span className="text-xs text-muted">{t("asOf", { date: hours.asOf })}</span> : null}>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.k} className="min-w-0">
              <dt className="mono-label !text-[10px]">{s.k}</dt>
              <dd className="num mt-1 text-2xl font-semibold"><Roll>{s.raw ? String(s.v) : dur(s.v)}</Roll></dd>
            </div>
          ))}
        </dl>
        {hours && hours.byType.length > 0 && (
          <div className="mt-6 border-t border-border pt-5">
            <p className="mono-label !text-[10px]">{t("types")}</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {hours.byType.slice(0, 6).map((ty) => (
                <li key={ty.icao} className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <Plane size={15} className="shrink-0 text-accent" />
                    <span className="truncate">{ty.name}</span>
                    <span className="num text-xs text-muted">{ty.icao}</span>
                  </span>
                  <span className="num shrink-0 font-semibold">{dur(ty.totalMin)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card
        title={t("licences")}
        action={
          <Link href="/app/documents" className="btn btn-primary btn-sm">
            <Settings2 size={14} aria-hidden /> {t("manage")}
          </Link>
        }
        pad={docs.length > 0 ? false : true}
      >
        {docs.length === 0 ? (
          <p className="text-muted">{t("noLicences")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {docs.map(({ l, s }) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <span className="flex min-w-0 items-center gap-3">
                  <BadgeCheck size={18} className="shrink-0 text-accent" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{l.code}</span>
                    <span className="block text-xs text-muted">{[tk(`kinds.${l.kind}`), l.authority, l.number].filter(Boolean).join(" · ")}</span>
                  </span>
                </span>
                {l.validUntil ? (
                  <Badge level={level(s)}>{s.state === "expired" ? t("expired") : t("validUntil", { date: l.validUntil })}</Badge>
                ) : (
                  <Badge level="ok">{t("noExpiry")}</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <motion.p className="text-center text-xs text-muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
        {t("privacy")}
      </motion.p>
    </div>
  );
}
