"use client";

import { Plane, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { AircraftCategory, EngineType, OperationMode } from "@cielo/core";
import { Card, Empty, Field, Modal, PageTitle, Segmented, Toggle } from "@/components/app/ui";
import { useDuration, useFlights, useTable, useTypes } from "@/lib/hooks";
import { findType, saveAircraft, saveCustomType, softDelete } from "@/lib/repo";

export default function AircraftPage() {
  const t = useTranslations("app.aircraft");
  const tc = useTranslations("common");
  const tf = useTranslations("app.form");
  const aircraft = useTable("aircraft");
  const types = useTypes();
  const flights = useFlights();
  const d = useDuration();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [form, setForm] = useState({ registration: "", typeIcao: "", variant: "", operator: "", defaultOperation: "single_pilot" as OperationMode, complex: false, highPerformance: false, tailwheel: false });
  const [ct, setCt] = useState({ icao: "", manufacturer: "", model: "", category: "airplane" as AircraftCategory, engineType: "piston" as EngineType, engineCount: 1, multiPilot: false, classOrTypeRating: "" });

  const stats = useMemo(() => {
    const m = new Map<string, { n: number; min: number }>();
    for (const f of flights ?? []) {
      if (!f.registration) continue;
      const e = m.get(f.registration) ?? { n: 0, min: 0 };
      e.n++;
      e.min += f.totalMin;
      m.set(f.registration, e);
    }
    return m;
  }, [flights]);

  async function save() {
    let type = findType(types ?? [], form.typeIcao);
    if (custom) type = await saveCustomType({ ...ct, classOrTypeRating: ct.classOrTypeRating || undefined });
    if (!type || !form.registration) return;
    await saveAircraft({ registration: form.registration, aircraftTypeId: type.id, variant: form.variant || undefined, operator: form.operator || undefined, defaultOperation: form.defaultOperation, complex: form.complex, highPerformance: form.highPerformance, tailwheel: form.tailwheel });
    setOpen(false);
  }

  return (
    <>
      <PageTitle title={t("title")} subtitle={t("subtitle")} actions={<button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(true)}><Plus size={15} /> {t("add")}</button>} />
      {aircraft && aircraft.length === 0 ? (
        <Card><Empty icon={<Plane size={36} />} text={t("empty")} /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {aircraft?.sort((a, b) => (stats.get(b.registration)?.min ?? 0) - (stats.get(a.registration)?.min ?? 0)).map((a) => {
            const ty = findType(types ?? [], a.aircraftTypeId);
            const s = stats.get(a.registration);
            return (
              <div key={a.id} className="card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="num text-xl font-semibold">{a.registration}</p>
                    <p className="text-sm text-muted">{ty ? `${ty.manufacturer} ${ty.model}` : a.aircraftTypeId}{a.variant ? ` · ${a.variant}` : ""}</p>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm !px-2" aria-label={tc("delete")} onClick={() => confirm(tc("confirmDelete")) && softDelete("aircraft", a.id)}><Trash2 size={15} /></button>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5 text-xs">
                  <span className="num rounded bg-surface-2 px-2 py-0.5 font-semibold">{ty?.icao}</span>
                  {ty?.classOrTypeRating && <span className="rounded bg-surface-2 px-2 py-0.5">{ty.classOrTypeRating}</span>}
                  <span className="rounded bg-surface-2 px-2 py-0.5">{a.defaultOperation === "multi_pilot" ? tf("multiPilot") : tf("singlePilot")}</span>
                  {a.operator && <span className="rounded bg-surface-2 px-2 py-0.5">{a.operator}</span>}
                </div>
                <p className="num mt-4 text-sm"><span className="font-semibold">{d(s?.min ?? 0)}</span> <span className="text-muted">· {t("flights", { count: s?.n ?? 0 })}</span></p>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={t("add")}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("registration")}><input className="input num uppercase" value={form.registration} onChange={(e) => setForm({ ...form, registration: e.target.value.toUpperCase() })} /></Field>
            {!custom && (
              <Field label={t("type")} hint={findType(types ?? [], form.typeIcao)?.model}>
                <input className="input num uppercase" list="types-dl" placeholder={t("searchType")} value={form.typeIcao} onChange={(e) => setForm({ ...form, typeIcao: e.target.value.toUpperCase() })} />
                <datalist id="types-dl">{types?.map((ty) => <option key={ty.id} value={ty.icao}>{ty.manufacturer} {ty.model}</option>)}</datalist>
              </Field>
            )}
            <Field label={t("variant")}><input className="input" value={form.variant} onChange={(e) => setForm({ ...form, variant: e.target.value })} /></Field>
            <Field label={t("operator")}><input className="input" value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value })} /></Field>
          </div>
          <Field label={t("defaultOperation")}>
            <Segmented value={form.defaultOperation} onChange={(v) => setForm({ ...form, defaultOperation: v })} options={[{ value: "single_pilot", label: tf("singlePilot") }, { value: "multi_pilot", label: tf("multiPilot") }]} />
          </Field>
          <div className="flex flex-wrap gap-5">
            <Toggle checked={form.complex} onChange={(v) => setForm({ ...form, complex: v })} label={t("complex")} />
            <Toggle checked={form.highPerformance} onChange={(v) => setForm({ ...form, highPerformance: v })} label={t("highPerf")} />
            <Toggle checked={form.tailwheel} onChange={(v) => setForm({ ...form, tailwheel: v })} label={t("tailwheel")} />
          </div>
          <Toggle checked={custom} onChange={setCustom} label={t("customType")} />
          {custom && (
            <div className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
              <Field label={t("icao")}><input className="input num uppercase" value={ct.icao} onChange={(e) => setCt({ ...ct, icao: e.target.value.toUpperCase() })} /></Field>
              <Field label={t("manufacturer")}><input className="input" value={ct.manufacturer} onChange={(e) => setCt({ ...ct, manufacturer: e.target.value })} /></Field>
              <Field label={t("model")}><input className="input" value={ct.model} onChange={(e) => setCt({ ...ct, model: e.target.value })} /></Field>
              <Field label={t("rating")}><input className="input" value={ct.classOrTypeRating} onChange={(e) => setCt({ ...ct, classOrTypeRating: e.target.value })} /></Field>
              <Field label={t("category")}>
                <select className="input" value={ct.category} onChange={(e) => setCt({ ...ct, category: e.target.value as AircraftCategory })}>
                  {["airplane", "helicopter", "glider", "tmg", "ulm", "balloon", "airship"].map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label={t("engineType")}>
                <select className="input" value={ct.engineType} onChange={(e) => setCt({ ...ct, engineType: e.target.value as EngineType })}>
                  {["piston", "turboprop", "jet", "turboshaft", "electric", "none"].map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label={t("engines")}><input type="number" min={0} max={8} className="input num" value={ct.engineCount} onChange={(e) => setCt({ ...ct, engineCount: +e.target.value || 0 })} /></Field>
              <div className="flex items-end pb-2"><Toggle checked={ct.multiPilot} onChange={(v) => setCt({ ...ct, multiPilot: v })} label={t("multiPilotCert")} /></div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>{tc("cancel")}</button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={!form.registration || (custom ? !ct.icao || !ct.model : !findType(types ?? [], form.typeIcao))}>{tc("save")}</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
