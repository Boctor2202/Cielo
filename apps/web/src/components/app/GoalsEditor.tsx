"use client";

import { Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { GOAL_KINDS, isHourGoal, type Flight, type GoalKind, type PilotGoal } from "@cielo/core";
import { updatePilot } from "@/lib/repo";

/** Editor of the pilot's goals: kind, target (hours or landings), type for "hours on type", optional deadline. */
export function GoalsEditor({ goals, flights, today, onClose }: { goals: PilotGoal[] | undefined; flights: Flight[]; today: string; onClose: () => void }) {
  const t = useTranslations("app.goals");
  const typesFlown = useMemo(() => [...new Set(flights.filter((f) => !f.deletedAt && !f.isFstd && f.aircraftTypeIcao).map((f) => f.aircraftTypeIcao!))].sort(), [flights]);
  const [list, setList] = useState<(PilotGoal & { value: string })[]>(() =>
    (goals ?? []).map((g) => ({ ...g, value: String(isHourGoal(g.kind) ? Math.round(g.target / 60) : g.target) })),
  );
  const [busy, setBusy] = useState(false);
  const set = (i: number, patch: Partial<PilotGoal & { value: string }>) => setList((l) => l.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  const add = () =>
    setList((l) => [...l, { id: crypto.randomUUID(), kind: "total", target: 0, value: "", by: undefined }]);

  const save = async (next: PilotGoal[] | undefined) => {
    setBusy(true);
    try {
      await updatePilot({ goals: next });
      onClose();
    } finally {
      setBusy(false);
    }
  };
  const valid = list.filter((g) => Number(g.value) > 0 && (g.kind !== "type" || g.icao));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal aria-label={t("title")} onClick={onClose}>
      <div className="card max-h-[90svh] w-[min(100%,720px)] overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">{t("title")}</h2>
            <p className="mt-1 text-sm text-muted">{t("intro")}</p>
          </div>
          <button type="button" className="btn btn-ghost !p-2" onClick={onClose} aria-label={t("close")}>
            <X size={16} />
          </button>
        </div>

        {list.length === 0 && <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">{t("empty")}</p>}
        <div className="space-y-3">
          {list.map((g, i) => (
            <div key={g.id} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1.4fr_1fr_0.8fr_1fr_auto] sm:items-end">
              <label className="text-xs text-muted">
                {t("kind")}
                <select className="input mt-1" value={g.kind} onChange={(e) => set(i, { kind: e.target.value as GoalKind })}>
                  {GOAL_KINDS.map((k) => (
                    <option key={k} value={k}>{t(`kinds.${k}`)}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted">
                {t("type")}
                <select className="input mt-1" value={g.icao ?? ""} disabled={g.kind !== "type"} onChange={(e) => set(i, { icao: e.target.value || undefined })}>
                  <option value="">{g.kind === "type" ? t("pickType") : "—"}</option>
                  {typesFlown.map((x) => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted">
                {isHourGoal(g.kind) ? t("targetHours") : t("targetCount")}
                <input className="input num mt-1" inputMode="numeric" value={g.value} onChange={(e) => set(i, { value: e.target.value.replace(/\D/g, "").slice(0, 6) })} />
              </label>
              <label className="text-xs text-muted">
                {t("by")}
                <input type="date" className="input mt-1" min={today} value={g.by ?? ""} onChange={(e) => set(i, { by: e.target.value || undefined })} />
              </label>
              <button type="button" className="btn btn-ghost !p-2 text-muted" onClick={() => setList((l) => l.filter((_, j) => j !== i))} aria-label={t("remove")}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button type="button" className="btn btn-secondary btn-sm" onClick={add}>
            <Plus size={14} /> {t("add")}
          </button>
          <div className="flex flex-wrap gap-2">
            {goals?.length ? (
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void save(undefined)}>
                {t("reset")}
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy || valid.length !== list.length}
              onClick={() =>
                void save(
                  list.length
                    ? list.map(({ value, ...g }) => ({ ...g, icao: g.kind === "type" ? g.icao : undefined, target: isHourGoal(g.kind) ? Number(value) * 60 : Number(value) }))
                    : undefined,
                )
              }
            >
              {t("save")}
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">{t("hint")}</p>
      </div>
    </div>
  );
}
