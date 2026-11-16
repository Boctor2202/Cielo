"use client";

import { BadgeCheck, Bell, Plus, Trash2 } from "lucide-react";
import { AuthorityInput } from "@/components/app/AuthorityInput";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { alertsDueToday, computeRecency, DEFAULT_ALERT_DAYS, LICENSE_CATALOGUE, licenseStatus, type License, type LicenseKind } from "@cielo/core";
import { Badge, Card, Empty, Field, Modal, PageTitle, type Level } from "@/components/app/ui";
import { useFlights, useFormatDate, useTable, useToday } from "@/lib/hooks";
import { saveLicense, softDelete } from "@/lib/repo";
import { localStore } from "@/lib/db";

type Draft = Omit<License, "id" | "createdAt" | "updatedAt" | "pilotId"> & { id?: string };
const KINDS: LicenseKind[] = ["licence", "medical", "rating", "endorsement", "language", "other"];
const blank = (): Draft => ({ kind: "licence", code: "", alertDays: [...DEFAULT_ALERT_DAYS] });

export default function DocumentsPage() {
  const t = useTranslations("app.documents");
  const td = useTranslations("app.dashboard");
  const tc = useTranslations("common");
  const licenses = useTable("licenses");
  const flights = useFlights();
  const today = useToday();
  const fd = useFormatDate();
  const [draft, setDraft] = useState<Draft | null>(null);
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

  return (
    <>
      <PageTitle title={t("title")} subtitle={t("subtitle")} actions={<button type="button" className="btn btn-primary btn-sm" onClick={() => setDraft(blank())}><Plus size={15} /> {t("add")}</button>} />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          {licenses && groups.length === 0 && <Card><Empty icon={<BadgeCheck size={36} />} text={t("empty")} /></Card>}
          {groups.map((g) => (
            <Card key={g.k} title={t(`kinds.${g.k}`)} pad={false}>
              <ul className="divide-y divide-border">
                {g.items.map(({ l, s }) => (
                  <li key={l.id}>
                    <button type="button" className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-surface-2" onClick={() => setDraft(l)}>
                      <div className="min-w-0">
                        <p className="font-semibold">{l.code}</p>
                        <p className="truncate text-xs text-muted">{[l.authority, l.number, l.validUntil && `${t("validUntil")} ${fd(l.validUntil)}`].filter(Boolean).join(" · ")}</p>
                      </div>
                      <Badge level={level(s)}>
                        {s.state === "no_expiry" ? t("state.no_expiry") : s.state === "expired" ? t("expiredSince", { count: -(s.daysLeft ?? 0) }) : t("daysLeft", { count: s.daysLeft ?? 0 })}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
        <div className="min-w-0 space-y-5">
          {recency && (
            <Card title={t("recency")}>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between"><span>{td("recencyPax")}</span><Badge level={recency.passengers.valid ? "ok" : "warning"}>{recency.passengers.valid ? fd(recency.passengers.validUntil) : `${recency.passengers.landings}/3`}</Badge></div>
                <div className="flex items-center justify-between"><span>{td("recencyNight")}</span><Badge level={recency.night.valid ? "ok" : "warning"}>{recency.night.valid ? fd(recency.night.validUntil) : "0/1"}</Badge></div>
              </div>
            </Card>
          )}
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

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? draft.code : t("add")}>
        {draft && (
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
                <select className="input" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as LicenseKind })}>
                  {KINDS.map((k) => <option key={k} value={k}>{t(`kinds.${k}`)}</option>)}
                </select>
              </Field>
              <Field label={t("code")}>
                <input className="input" required list="lic-cat" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
                <datalist id="lic-cat">{LICENSE_CATALOGUE.filter((c) => c.kind === draft.kind).map((c) => <option key={c.code} value={c.code} />)}</datalist>
              </Field>
              <AuthorityInput label={t("authority")} value={draft.authority ?? ""} onChange={(v) => setDraft({ ...draft, authority: v })} />
              <Field label={t("number")}><input className="input num" value={draft.number ?? ""} onChange={(e) => setDraft({ ...draft, number: e.target.value })} /></Field>
              <Field label={t("issuedOn")}><input type="date" className="input num" value={draft.issuedOn ?? ""} onChange={(e) => setDraft({ ...draft, issuedOn: e.target.value || null })} /></Field>
              <Field label={t("validUntil")}><input type="date" className="input num" value={draft.validUntil ?? ""} onChange={(e) => setDraft({ ...draft, validUntil: e.target.value || null })} /></Field>
              <Field label={t("lastCheck")}><input type="date" className="input num" value={draft.lastCheckOn ?? ""} onChange={(e) => setDraft({ ...draft, lastCheckOn: e.target.value || null })} /></Field>
              <Field label={t("alertDays")}>
                <input className="input num" value={draft.alertDays.join(", ")} onChange={(e) => setDraft({ ...draft, alertDays: e.target.value.split(/[,; ]+/).map(Number).filter((n) => Number.isFinite(n) && n >= 0) })} />
              </Field>
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
        )}
      </Modal>
    </>
  );
}
