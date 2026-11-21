"use client";

/* eslint-disable @next/next/no-img-element -- aircraft photos are shown from Planespotters' servers, unmodified */
import { Plane } from "lucide-react";
import { useTranslations } from "next-intl";
import { countryName } from "@cielo/core";
import { Roll } from "@/components/ui/Roll";
import { Flag } from "./LayoverNights";
import { useAircraftPhoto } from "./AircraftPhoto";

/** Gold, silver, bronze for the podium; the accent after. */
const PODIUM = ["linear-gradient(135deg,#F5D06F,#B8860B)", "linear-gradient(135deg,#E5E7EB,#9CA3AF)", "linear-gradient(135deg,#E8A87C,#9A5B2E)"];

/** The most visited airports: podium ranks, flag, name and city, and a bar for the movements. */
export function TopAirports({ items, airport, locale }: { items: { key: string; flights: number }[]; airport: (icao: string) => { name: string; city?: string; country: string } | undefined; locale: string }) {
  const t = useTranslations("app.stats");
  const max = Math.max(1, ...items.map((x) => x.flights));
  return (
    <ul className="grid gap-x-6 gap-y-1 p-3 lg:grid-cols-2 lg:grid-flow-col lg:grid-rows-5">
      {items.map((a, i) => {
        const ap = airport(a.key);
        return (
          <li key={a.key} className="group rounded-xl px-2 py-2 transition hover:bg-[color:var(--text)]/[0.04]">
            <div className="flex items-center gap-3">
              <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold" style={i < 3 ? { background: PODIUM[i], color: "#1a1206" } : undefined}>
                {i < 3 ? i + 1 : <span className="text-muted">{i + 1}</span>}
              </span>
              {ap ? <Flag code={ap.country} /> : <span className="h-5 w-5 shrink-0" />}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="num font-bold tracking-wide">{a.key}</span>
                  <span className="min-w-0 truncate text-sm">{ap?.city || ap?.name}</span>
                </div>
                <p className="truncate text-[11px] text-muted">{[ap?.name !== ap?.city ? ap?.name : "", ap ? countryName(ap.country, locale) : ""].filter(Boolean).join(" · ")}</p>
              </div>
              <span className="shrink-0 text-right">
                <span className="num block text-base font-bold leading-none"><Roll>{a.flights.toLocaleString(locale)}</Roll></span>
                <span className="text-[10px] uppercase tracking-wider text-muted">{t("movementsShort")}</span>
              </span>
            </div>
            <div className="ml-10 mt-1.5 h-1.5 overflow-hidden rounded-full bg-[color:var(--text)]/[0.07]">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-400 transition-[width] duration-700" style={{ width: `${Math.max(3, (a.flights / max) * 100)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export interface FleetItem {
  reg: string;
  minutes: number;
  flights: number;
  type?: string;
  model?: string;
}

/** The aircraft flown most: a photo of each one (Planespotters, credited), its hours, flights and share. */
export function Fleet({ items, format, locale }: { items: FleetItem[]; format: (m: number) => string; locale: string }) {
  const total = items.reduce((x, r) => x + r.minutes, 0) || 1;
  return (
    <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((r, i) => (
        <AircraftTile key={r.reg} item={r} rank={i} share={r.minutes / total} format={format} locale={locale} />
      ))}
    </div>
  );
}

function AircraftTile({ item: r, rank, share, format, locale }: { item: FleetItem; rank: number; share: number; format: (m: number) => string; locale: string }) {
  const t = useTranslations("app.stats");
  const tp = useTranslations("app.photo");
  const photo = useAircraftPhoto(r.reg);
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-[color:var(--text)]/[0.03] transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-[3/2] w-full overflow-hidden bg-gradient-to-br from-sky-900/60 via-slate-900/70 to-emerald-900/50">
        {photo ? (
          <a href={photo.link} target="_blank" rel="noopener" title={tp("open")}>
            <img src={photo.src} width={photo.width} height={photo.height} alt={tp("alt", { reg: r.reg })} className="h-full w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          </a>
        ) : (
          <div className={`grid h-full w-full place-items-center ${photo === undefined ? "animate-pulse" : ""}`}>
            <div className="flex flex-col items-center gap-1 text-white/70">
              <Plane size={36} strokeWidth={1.4} className="-rotate-45" />
              {r.type ? <span className="num text-xs font-semibold tracking-[0.2em]">{r.type}</span> : null}
            </div>
          </div>
        )}
        {rank === 0 ? <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 backdrop-blur">{t("mostFlown")}</span> : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="num text-lg font-bold tracking-wide">{r.reg}</span>
          {r.type ? <span className="num rounded-md bg-[color:var(--text)]/[0.07] px-1.5 py-0.5 text-[11px] font-semibold text-muted">{r.type}</span> : null}
        </div>
        {r.model ? <p className="-mt-1.5 truncate text-xs text-muted">{r.model}</p> : null}
        <div className="flex items-end justify-between">
          <span>
            <span className="num block text-base font-bold leading-none"><Roll>{format(r.minutes)}</Roll></span>
            <span className="text-[10px] uppercase tracking-wider text-muted">{t("hoursShort")}</span>
          </span>
          <span className="text-right">
            <span className="num block text-base font-bold leading-none">{r.flights.toLocaleString(locale)}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted">{t("flightsShort", { count: r.flights })}</span>
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-[color:var(--text)]/[0.07]" title={`${Math.round(share * 100)} %`}>
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-400" style={{ width: `${Math.max(2, share * 100)}%` }} />
        </div>
        {photo ? (
          <p className="truncate text-[10px] text-muted">
            {tp("credit", { name: photo.photographer })}{" "}
            <a href={photo.link} target="_blank" rel="noopener" className="underline">Planespotters.net</a>
          </p>
        ) : null}
      </div>
    </div>
  );
}
