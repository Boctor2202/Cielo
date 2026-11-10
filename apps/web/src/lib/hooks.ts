"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { formatDuration, isoDate, type Locale, type TableMap, type TableName } from "@cielo/core";
import { db } from "./db";
import { allTypes, ensurePilot } from "./repo";

export function useTable<T extends TableName>(table: T): TableMap[T][] | undefined {
  return useLiveQuery(async () => (await db().t(table).toArray()).filter((r) => !(r as { deletedAt?: string | null }).deletedAt), [table]);
}

export function useFlights() {
  return useLiveQuery(async () => {
    const all = await db().t("flights").toArray();
    return all.filter((f) => !f.deletedAt).sort((a, b) => (b.outUtc ?? b.date).localeCompare(a.outUtc ?? a.date));
  }, []);
}

export function usePilot() {
  const locale = useLocale() as Locale;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    ensurePilot(locale).then(() => setReady(true));
  }, [locale]);
  return useLiveQuery(async () => {
    if (!ready) return undefined;
    const id = (await db().meta.get("pilotId"))?.value;
    return id ? db().t("pilots").get(id) : undefined;
  }, [ready]);
}

export function useTypes() {
  return useLiveQuery(() => allTypes(), []);
}

export function useToday() {
  return isoDate(new Date());
}

/** Formats minutes using the pilot's preferred display. */
export function useDuration() {
  const pilot = usePilot();
  const mode = pilot?.timeDisplay === "decimal" ? "decimal" : "hhmm";
  return (min: number | undefined | null, blankZero = false) => formatDuration(min ?? 0, mode, blankZero);
}

export function useFormatDate() {
  const locale = useLocale();
  return (iso: string | undefined | null, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" }) => {
    if (!iso) return "";
    const d = iso.length === 10 ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
    return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { timeZone: "UTC", ...opts }).format(d);
  };
}
