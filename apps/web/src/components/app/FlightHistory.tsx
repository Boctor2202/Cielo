"use client";

import { History, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useLocale, useTranslations } from "next-intl";
import { revertRevision, revisionFieldLabel, revisionValue, visibleChanges, type Flight } from "@cielo/core";
import { db } from "@/lib/db";
import { useFormatDate } from "@/lib/hooks";
import { put } from "@/lib/repo";

/** The flight's audit trail: every change, field by field, newest first; a change can be undone. */
export function FlightHistory({ flight }: { flight: Flight }) {
  const t = useTranslations("app.history");
  const locale = useLocale();
  const fd = useFormatDate();
  const [open, setOpen] = useState(false);
  const revs = useLiveQuery(async () => (await db().t("flight_revisions").where("flightId").equals(flight.id).toArray()).sort((a, b) => b.at.localeCompare(a.at)), [flight.id]);
  if (!revs?.length) return null;
  const shown = open ? revs : revs.slice(0, 3);
  return (
    <div className="space-y-2 border-t border-border pt-3">
      <p className="flex items-center gap-2 text-sm font-semibold"><History size={15} /> {t("title", { n: revs.length })}</p>
      <ol className="space-y-2">
        {shown.map((r) => {
          const ch = visibleChanges(r);
          return (
            <li key={r.id} className="rounded-lg bg-surface-2 px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{t(`action.${r.action}`)}</span>
                <span className="text-muted">{fd(r.at, { dateStyle: "medium", timeStyle: "short" })} · {t(`source.${r.source}`)}</span>
              </div>
              {ch.length ? (
                <ul className="mt-1 space-y-0.5">
                  {ch.map((c) => (
                    <li key={c.field} className="num">
                      <span className="text-muted">{revisionFieldLabel(c.field, locale)} :</span> <s className="opacity-60">{revisionValue(c.field, c.from, locale)}</s> → <b>{revisionValue(c.field, c.to, locale)}</b>
                    </li>
                  ))}
                </ul>
              ) : null}
              {r.action === "update" && ch.length && !flight.locked && !flight.deletedAt ? (
                <button
                  type="button"
                  className="mt-1 inline-flex items-center gap-1 font-semibold text-muted underline"
                  onClick={async () => {
                    if (!confirm(t("undoConfirm"))) return;
                    const cur = await db().t("flights").get(flight.id);
                    if (cur) await put("flights", revertRevision(cur, r));
                  }}
                >
                  <RotateCcw size={12} /> {t("undo")}
                </button>
              ) : null}
            </li>
          );
        })}
      </ol>
      {revs.length > 3 ? (
        <button type="button" className="text-xs font-semibold text-muted underline" onClick={() => setOpen((x) => !x)}>
          {open ? t("less") : t("more", { n: revs.length - 3 })}
        </button>
      ) : null}
    </div>
  );
}
