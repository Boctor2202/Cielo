"use client";

import { CalendarDays, ExternalLink, Footprints, MapPin, Ticket } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Segmented } from "@/components/app/ui";
import type { EventKind, LiveEvent } from "@/lib/events";

/** Concerts and shows near the hotel between arrival and departure, from Ticketmaster. */
export function Events({ center, from, to }: { center: { lat: number; lng: number }; from: string; to: string }) {
  const t = useTranslations("app.layover.activities.events");
  const locale = useLocale();
  const [kind, setKind] = useState<EventKind>("all");
  const [events, setEvents] = useState<LiveEvent[] | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error" | "not_configured">("loading");

  useEffect(() => {
    let alive = true;
    setState("loading");
    fetch(`/api/escale/events?lat=${center.lat}&lng=${center.lng}&from=${from}&to=${to}&kind=${kind}&lang=${locale}`)
      .then(async (r) => ({ ok: r.ok, d: (await r.json()) as { events?: LiveEvent[]; error?: string } }))
      .then(({ ok, d }) => {
        if (!alive) return;
        if (ok && d.events) {
          setEvents(d.events);
          setState("ok");
        } else setState(d.error === "not_configured" ? "not_configured" : "error");
      })
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
  }, [center.lat, center.lng, from, to, kind, locale]);

  const byDay = useMemo(() => {
    const m = new Map<string, LiveEvent[]>();
    for (const e of events ?? []) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return [...m.entries()];
  }, [events]);
  const day = (d: string) => new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
  const money = (v: number, c?: string) => new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-GB", { style: "currency", currency: c || "EUR", maximumFractionDigits: 0 }).format(v);
  const dist = (m: number) => (m < 1200 ? t("walk", { min: Math.max(1, Math.round(m / 80)) }) : t("km", { km: (m / 1000).toFixed(1) }));

  if (state === "not_configured") return <p className="text-muted">{t("notConfigured")}</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <CalendarDays size={14} /> {from === to ? day(from) : t("range", { from: day(from), to: day(to) })}
        </p>
        <Segmented value={kind} onChange={setKind} options={[{ value: "all", label: t("all") }, { value: "concerts", label: t("concerts") }, { value: "shows", label: t("shows") }]} />
      </div>
      {state === "loading" && <p className="text-sm text-muted">{t("loading")}</p>}
      {state === "error" && <p className="text-sm text-[var(--warning)]">{t("error")}</p>}
      {state === "ok" && byDay.length === 0 && <p className="text-sm text-muted">{t("none")}</p>}
      {byDay.map(([d, list]) => (
        <section key={d}>
          <h3 className="mono-label mb-2 !text-[11px]">{day(d)}</h3>
          <ol className="grid gap-2">
            {list.map((e) => (
              <li key={e.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-border p-2.5">
                {e.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.image} alt="" loading="lazy" className="h-14 w-24 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="grid h-14 w-24 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted"><Ticket size={20} /></div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{e.name}</p>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                    {e.time && <span className="num font-semibold text-text">{e.time}</span>}
                    {e.venue && <span className="flex items-center gap-1"><MapPin size={12} /> {e.venue}</span>}
                    {e.distanceM !== undefined && <span className="flex items-center gap-1"><Footprints size={12} /> {dist(e.distanceM)}</span>}
                    {e.genre && <span>{e.genre}</span>}
                    {e.priceFrom !== undefined && e.priceFrom > 0 && <span>{t("from", { price: money(e.priceFrom, e.currency) })}</span>}
                    {e.status && e.status !== "onsale" && <span className="text-[var(--caution)]">{t(`status.${e.status === "offsale" ? "offsale" : "other"}`)}</span>}
                  </p>
                </div>
                {e.url && (
                  <a href={e.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost shrink-0 !px-2.5 text-sm text-accent">
                    {t("tickets")} <ExternalLink size={14} />
                  </a>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
      {byDay.length > 0 && <p className="text-right text-[11px] text-muted">{t("attribution")}</p>}
    </div>
  );
}
