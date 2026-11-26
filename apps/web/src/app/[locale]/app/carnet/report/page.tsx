"use client";

import { DateInput } from "@/components/app/DateInput";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { isoDate, type OpeningBalance } from "@cielo/core";
import { Card, DurationInput, Empty, Field, PageTitle } from "@/components/app/ui";
import { useDuration, useFormatDate, useTable } from "@/lib/hooks";
import { saveOpening, softDelete } from "@/lib/repo";

type Draft = Omit<OpeningBalance, "id" | "createdAt" | "updatedAt" | "pilotId">;
const EMPTY: Draft = {
  label: "", asOfDate: isoDate(new Date()), aircraftTypeIcao: null, totalMin: 0, singlePilotSeMin: 0, singlePilotMeMin: 0, multiPilotMin: 0,
  picMin: 0, copilotMin: 0, dualMin: 0, instructorMin: 0, nightMin: 0, ifrMin: 0, landingsDay: 0, landingsNight: 0, fstdMin: 0,
};
const TIME_FIELDS: [keyof Draft, string][] = [
  ["totalMin", "TOTAL"], ["singlePilotSeMin", "SE"], ["singlePilotMeMin", "ME"], ["multiPilotMin", "Multi-pilot"], ["picMin", "PIC"],
  ["copilotMin", "Co-pilot"], ["dualMin", "Dual"], ["instructorMin", "Instructor"], ["nightMin", "Night"], ["ifrMin", "IFR"], ["fstdMin", "FSTD"],
];

export default function CarryForward() {
  const t = useTranslations("app.carry");
  const tc = useTranslations("common");
  const list = useTable("opening_balances");
  const d = useDuration();
  const fd = useFormatDate();
  const [draft, setDraft] = useState<Draft>(EMPTY);

  return (
    <>
      <PageTitle title={t("title")} subtitle={t("subtitle")} />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card title={t("add")}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await saveOpening(draft);
              setDraft(EMPTY);
            }}
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t("label")}><input className="input" placeholder={t("labelPh")} value={draft.label ?? ""} onChange={(e) => setDraft({ ...draft, label: e.target.value })} /></Field>
              <Field label={t("asOf")}><DateInput className="input num" required value={draft.asOfDate} onChange={(e) => setDraft({ ...draft, asOfDate: e.target.value })} /></Field>
              <Field label={t("type")}><input className="input num uppercase" value={draft.aircraftTypeIcao ?? ""} onChange={(e) => setDraft({ ...draft, aircraftTypeIcao: e.target.value.toUpperCase() || null })} /></Field>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {TIME_FIELDS.map(([k, label]) => (
                <Field key={k} label={label}>
                  <DurationInput value={(draft[k] as number) || undefined} onChange={(m) => setDraft({ ...draft, [k]: m ?? 0 })} />
                </Field>
              ))}
              <Field label="Ldg day"><input type="number" min={0} className="input num" value={draft.landingsDay} onChange={(e) => setDraft({ ...draft, landingsDay: +e.target.value || 0 })} /></Field>
              <Field label="Ldg night"><input type="number" min={0} className="input num" value={draft.landingsNight} onChange={(e) => setDraft({ ...draft, landingsNight: +e.target.value || 0 })} /></Field>
            </div>
            <button className="btn btn-primary mt-6" disabled={!draft.totalMin}>{tc("add")}</button>
          </form>
        </Card>
        <Card title={t("existing")} pad={false}>
          {!list?.length ? (
            <Empty text={t("none")} />
          ) : (
            <ul className="divide-y divide-border">
              {list.map((b) => (
                <li key={b.id} className="flex items-start justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="font-semibold">{b.label || "—"} {b.aircraftTypeIcao && <span className="text-muted">· {b.aircraftTypeIcao}</span>}</p>
                    <p className="text-xs text-muted">{fd(b.asOfDate)}</p>
                    <p className="num mt-1 text-sm">{d(b.totalMin)} · PIC {d(b.picMin)} · ☾ {d(b.nightMin)} · IFR {d(b.ifrMin)}</p>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm !px-2" aria-label={tc("delete")} onClick={() => confirm(tc("confirmDelete")) && softDelete("opening_balances", b.id)}><Trash2 size={15} /></button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
