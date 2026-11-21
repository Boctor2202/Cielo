"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslations } from "next-intl";
import { db } from "@/lib/db";
import { restore } from "@/lib/repo";
import { useDuration, useFormatDate } from "@/lib/hooks";
import { Modal } from "./ui";

/** The flights deleted from the logbook (kept, synced), most recently deleted first. */
export function useDeletedFlights() {
  return useLiveQuery(async () => {
    const all = await db().t("flights").toArray();
    return all.filter((f) => !!f.deletedAt).sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""));
  }, []);
}

/** "Deleted flights": a flight deleted by mistake goes back to the logbook in one click. */
export function TrashButton() {
  const t = useTranslations("app.trash");
  const deleted = useDeletedFlights();
  const [open, setOpen] = useState(false);
  if (!deleted?.length) return null;
  return (
    <>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>
        <Trash2 size={15} /> {t("button", { n: deleted.length })}
      </button>
      <TrashModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function TrashModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("app.trash");
  const fd = useFormatDate();
  const d = useDuration();
  const deleted = useDeletedFlights() ?? [];
  const [busy, setBusy] = useState(false);
  const back = async (ids: string[]) => {
    setBusy(true);
    try {
      for (const id of ids) await restore("flights", id);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={t("title")}>
      <div className="space-y-3">
        <p className="text-sm text-muted">{t("hint")}</p>
        {deleted.length ? (
          <>
            <ul className="max-h-[50vh] divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {deleted.map((f) => (
                <li key={f.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="num font-semibold">{f.isFstd ? f.fstdType || "FSTD" : `${f.depIcao} → ${f.arrIcao}`} <span className="font-normal text-muted">· {d(f.totalMin || f.fstdMin)}</span></p>
                    <p className="truncate text-xs text-muted">
                      {fd(f.date, { day: "numeric", month: "short", year: "numeric" })}
                      {f.aircraftTypeIcao ? ` · ${f.aircraftTypeIcao}` : ""}
                      {f.registration ? ` · ${f.registration}` : ""} · {t("deletedOn", { date: fd(f.deletedAt!.slice(0, 10), { day: "numeric", month: "short" }) })}
                    </p>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void back([f.id])}>
                    <RotateCcw size={14} /> {t("restore")}
                  </button>
                </li>
              ))}
            </ul>
            {deleted.length > 1 ? (
              <button type="button" className="btn btn-secondary w-full" disabled={busy} onClick={() => void back(deleted.map((f) => f.id))}>
                <RotateCcw size={15} /> {t("restoreAll", { n: deleted.length })}
              </button>
            ) : null}
          </>
        ) : (
          <p className="text-sm">{t("empty")}</p>
        )}
      </div>
    </Modal>
  );
}
