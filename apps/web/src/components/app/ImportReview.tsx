"use client";

import { AlertTriangle, Check, Pencil, Undo2, X } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatDuration, rowMinutes, type CheckField, type ImportCheck, type ImportChoices, type ImportedRow, type ImportRowEdit } from "@cielo/core";
import { Card, ClockInput, DurationInput, Field, Segmented } from "./ui";

type Row = ImportedRow & { excluded?: boolean; keepDuplicate?: boolean };

/** Totals shown above the flights, in this order (a line only when it has something). */
const TOTALS: CheckField[] = ["total", "pic", "dual", "copilot", "picus", "instructor", "multiPilot", "xc", "vfr", "ifr", "night", "landings", "fstd"];

const fmt = (f: CheckField, n: number | undefined) => (n === undefined ? "—" : f === "landings" ? String(n) : formatDuration(n));
const isoToDmy = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}` : d ?? "");

/**
 * The single check before an import: the totals Geardown will record (live), the choices for every flight
 * (rules, function, cross-country), then the flights one by one — those worth a look first — each editable
 * in place or left out. Nothing is saved before "Import".
 */
export function ImportReview({
  rows,
  check,
  firstRow,
  choices,
  onChoices,
  edits,
  onEdit,
  onConfirm,
  onCancel,
  busy,
  fills = 0,
}: {
  rows: Row[];
  check: ImportCheck | null;
  firstRow: number;
  choices: ImportChoices;
  onChoices: (c: ImportChoices) => void;
  edits: Record<number, ImportRowEdit>;
  onEdit: (rowIndex: number, e: ImportRowEdit) => void;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
  /** flights already logged that get their takeoffs and landings from this document */
  fills?: number;
}) {
  const t = useTranslations("app.import.review");
  const [open, setOpen] = useState<number | null>(null);
  const dupOf = check?.duplicateOf ?? {};
  const reasons = (r: Row): string[] => {
    if (r.excluded) return [];
    if (r.errors.length) return r.errors.map((e) => t(`err.${e === "date" || e === "route" || e === "times" ? e : "other"}`));
    const d = dupOf[r.rowIndex];
    if (d) {
      const f = d.flight;
      const when = (f.outUtc ?? f.offUtc)?.slice(11, 16);
      return [t(d.kind === "exact" ? "dup.exact" : "dup.probable", { flight: `${isoToDmy(f.date)} ${f.depIcao}→${f.arrIcao}${when ? ` ${when}` : ""} · ${fmt("total", f.totalMin)}` })];
    }
    return (check?.flags[r.rowIndex] ?? []).map((f) => (f === "times" ? t("why.times", { total: fmt("total", r.explicit.total) }) : f === "airport" ? t("why.airport") : t("why.diff", { field: t(`f.${f}`) })));
  };
  const toCheck = rows.filter((r) => reasons(r).length > 0);
  // the flights to check first, as soon as the check knows them; "all" once the pilot asks for it
  const [chosen, setFilter] = useState<"check" | "all" | null>(null);
  const filter = chosen ?? (toCheck.length ? "check" : "all");
  const shown = filter === "check" && toCheck.length ? toCheck : rows;
  const flights = rows.filter((r) => !r.excluded && !r.errors.length && r.input && !r.input.isFstd).length;
  const sessions = rows.filter((r) => !r.excluded && !r.errors.length && r.input?.isFstd).length;
  // the usual columns always shown (a zero is an answer too); the others when they hold something
  const ALWAYS: CheckField[] = ["total", "pic", "dual", "copilot", "picus", "xc", "vfr", "ifr", "night", "landings"];
  const lines = TOTALS.map((f) => check?.lines.find((l) => l.field === f)).filter((l): l is NonNullable<typeof l> => !!l && (ALWAYS.includes(l.field) || l.geardown > 0 || (l.file ?? 0) > 0));

  return (
    <Card title={t("title")} action={<span className="text-sm text-muted">{t("counts", { flights, sessions })}</span>}>
      <p className="text-sm text-muted">{t("intro")}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {lines.map((l) => {
          const off = l.file !== undefined && l.rows.length > 0;
          return (
            <div key={l.field} className={`rounded-xl px-3 py-2 ${off ? "bg-[var(--caution)]/12" : "bg-surface-2/60"}`}>
              <p className={`num text-lg font-semibold ${off ? "text-[var(--caution)]" : l.file !== undefined ? "text-accent" : ""}`}>{fmt(l.field, l.geardown)}</p>
              <p className="text-[11.5px] text-muted">
                {t(`f.${l.field}`)}
                {l.file !== undefined && ` · ${t("read", { v: fmt(l.field, l.file) })}`}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-xl border border-border p-3">
        <p className="text-sm text-muted">{t("choicesHelp")}</p>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-3">
          <div>
            <p className="label-caps mb-1">{t("rules")}</p>
            <Segmented value={choices.rules} onChange={(rules) => onChoices({ ...choices, rules })} options={(["doc", "VFR", "IFR"] as const).map((v) => ({ value: v, label: v === "doc" ? t("asRead") : v }))} />
          </div>
          <div>
            <p className="label-caps mb-1">{t("function")}</p>
            <Segmented value={choices.function} onChange={(fn) => onChoices({ ...choices, function: fn })} options={(["doc", "PIC", "SIC", "PICUS", "DUAL"] as const).map((v) => ({ value: v, label: v === "doc" ? t("asRead") : t(`fn.${v}`) }))} />
          </div>
          <div>
            <p className="label-caps mb-1">{t("xc")}</p>
            <Segmented value={choices.xc ?? "doc"} onChange={(xc) => onChoices({ ...choices, xc })} options={(["doc", "other", "none"] as const).map((v) => ({ value: v, label: v === "doc" ? t("asRead") : t(`xc_${v}`) }))} />
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <Segmented value={filter} onChange={setFilter} options={[{ value: "check", label: t("filterCheck", { count: toCheck.length }) }, { value: "all", label: t("filterAll", { count: rows.length }) }]} />
      </div>
      <ul className="mt-3 space-y-2">
        {shown.slice(0, 300).map((r) => {
          const why = reasons(r);
          const i = r.input;
          const min = rowMinutes(r);
          return (
            <li key={r.rowIndex} className={`rounded-xl border p-3 ${r.excluded ? "border-border opacity-55" : why.length ? "border-[var(--caution)]/70 bg-[var(--caution)]/8" : "border-border"}`}>
              <button type="button" className="flex w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-left" onClick={() => setOpen(open === r.rowIndex ? null : r.rowIndex)}>
                <span className="num font-semibold">
                  {r.rowIndex + firstRow} · {isoToDmy(i?.date)} {i?.isFstd ? `· ${i.fstdType ?? t("sim")}` : `· ${i?.depIcao ?? "?"} → ${i?.arrIcao ?? "?"}`}
                </span>
                <span className="num flex flex-wrap items-center gap-x-3 text-sm text-muted">
                  {!i?.isFstd && (i?.out || i?.in) && <span>{[i?.out, i?.in].filter(Boolean).join("–")}</span>}
                  <span>{fmt("total", i?.isFstd ? i.fstdMin : min)}</span>
                  {!i?.isFstd && <span>{[i?.registration, i?.aircraftTypeIcao].filter(Boolean).join(" · ")}</span>}
                  <span>{i?.function === "DUAL" ? "Dual" : i?.function}{!i?.isFstd && ` · ${i?.ifr ? "IFR" : "VFR"}`}{i?.xcMin ? ` · XC ${formatDuration(i.xcMin)}` : ""}</span>
                  {r.excluded ? <span className="text-[var(--warning)]">{t("excluded")}</span> : <Pencil size={13} aria-label={t("edit")} />}
                </span>
              </button>
              {why.length > 0 && (
                <p className="mt-1 flex items-start gap-1.5 text-sm text-[var(--caution)]">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {why.join(" · ")}
                </p>
              )}
              {dupOf[r.rowIndex] && !r.excluded && (
                <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={() => onEdit(r.rowIndex, { ...(edits[r.rowIndex] ?? {}), keepDuplicate: true })}>{t("dup.keep")}</button>
              )}
              {r.keepDuplicate && !dupOf[r.rowIndex] && (
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                  {t("dup.kept")}
                  <button type="button" className="underline" onClick={() => onEdit(r.rowIndex, { ...(edits[r.rowIndex] ?? {}), keepDuplicate: false })}>{t("dup.undo")}</button>
                </p>
              )}
              {open === r.rowIndex && i && <RowEditor row={r} edit={edits[r.rowIndex] ?? {}} onEdit={(e) => onEdit(r.rowIndex, e)} onClose={() => setOpen(null)} />}
            </li>
          );
        })}
      </ul>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>{t("cancel")}</button>
        <button type="button" className="btn btn-primary" disabled={busy || !check || (check.kept === 0 && !fills)} onClick={onConfirm}>{check && check.kept === 0 && fills ? t("confirmFills", { count: fills }) : t("confirm", { count: check?.kept ?? 0 })}</button>
      </div>
    </Card>
  );
}

/** One flight (or simulator session) edited in place; every change is kept as the pilot's correction. */
function RowEditor({ row, edit, onEdit, onClose }: { row: Row; edit: ImportRowEdit; onEdit: (e: ImportRowEdit) => void; onClose: () => void }) {
  const t = useTranslations("app.import.review");
  const i = row.input!;
  const set = (patch: ImportRowEdit) => onEdit({ ...edit, ...patch });
  const text = (key: "date" | "dep" | "arr" | "registration" | "type" | "fstdType", value: string | undefined, upper = true) => (
    <Field label={t(`fld.${key}`)}>
      <input
        className="input num"
        defaultValue={value ?? ""}
        type={key === "date" ? "date" : "text"}
        onBlur={(e) => {
          const v = upper ? e.target.value.toUpperCase() : e.target.value;
          if (v !== (value ?? "")) set({ [key]: v });
        }}
      />
    </Field>
  );
  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {text("date", i.date, false)}
        {i.isFstd ? (
          <>
            {text("fstdType", i.fstdType)}
            <Field label={t("fld.fstdMin")}><DurationInput value={i.fstdMin} onChange={(m) => set({ fstdMin: m ?? 0 })} /></Field>
          </>
        ) : (
          <>
            {text("dep", i.depIcao)}
            {text("arr", i.arrIcao)}
            <Field label={t("fld.out")}><ClockInput value={i.out} onChange={(v) => set({ out: v ?? "" })} /></Field>
            <Field label={t("fld.in")}><ClockInput value={i.in} onChange={(v) => set({ in: v ?? "" })} /></Field>
            <Field label={t("fld.total")}><DurationInput value={row.explicit.total} onChange={(m) => set({ total: m })} /></Field>
            {text("registration", i.registration)}
            {text("type", i.aircraftTypeIcao)}
            <Field label={t("fld.landings")}>
              <input className="input num" inputMode="numeric" defaultValue={String((i.landingsDay ?? 0) + (i.landingsNight ?? 0))} onBlur={(e) => set({ landings: Math.max(0, Number(e.target.value) || 0) })} />
            </Field>
            <Field label={t("fld.night")}><DurationInput value={i.nightOverrideMin} onChange={(m) => set({ night: m ?? 0 })} /></Field>
            <Field label={t("fld.xc")}><DurationInput value={i.xcMin} onChange={(m) => set({ xc: m ?? 0 })} /></Field>
          </>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
        {!i.isFstd && (
          <div>
            <p className="label-caps mb-1">{t("rules")}</p>
            <Segmented value={i.ifr ? "IFR" : "VFR"} onChange={(v) => set({ rules: v })} options={[{ value: "VFR", label: "VFR" }, { value: "IFR", label: "IFR" }]} />
          </div>
        )}
        <div>
          <p className="label-caps mb-1">{t("function")}</p>
          <Segmented
            value={(["PIC", "SIC", "PICUS", "DUAL"].includes(i.function) ? i.function : "PIC") as "PIC" | "SIC" | "PICUS" | "DUAL"}
            onChange={(v) => set({ function: v })}
            options={(["PIC", "SIC", "PICUS", "DUAL"] as const).map((v) => ({ value: v, label: t(`fn.${v}`) }))}
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-between gap-2">
        {row.excluded ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ excluded: false })}><Undo2 size={14} /> {t("include")}</button>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm text-[var(--warning)]" onClick={() => { set({ excluded: true }); onClose(); }}><X size={14} /> {t("exclude")}</button>
        )}
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}><Check size={14} /> {t("ok")}</button>
      </div>
    </div>
  );
}
