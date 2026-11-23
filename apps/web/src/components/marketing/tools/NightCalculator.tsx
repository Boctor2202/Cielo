"use client";

import { useEffect, useMemo, useState } from "react";
import { computeNight, sunElevation, CIVIL_TWILIGHT_DEG } from "@cielo/core";
import type { AirportIndex } from "@cielo/reference-data";
import { Link } from "@/i18n/navigation";
import { loadAirports } from "@/lib/airports";

const L = {
  fr: { dep: "Départ (OACI ou IATA)", arr: "Arrivée", date: "Date (UTC)", out: "Off-block", off: "Décollage", on: "Atterrissage", in: "On-block", opt: "facultatif", utc: "Heures en UTC", night: "Temps de nuit (bloc)", air: "dont en vol", to: "Décollage de nuit", ldg: "Atterrissage de nuit", yes: "oui", no: "non", unknown: "Aéroport introuvable", fill: "Renseignez les deux aéroports, la date et les heures bloc.", twilight: "Fin du crépuscule civil du soir (UTC)", cta: "Geardown fait ce calcul pour chaque vol de votre carnet, automatiquement.", try: "Essayer 30 jours gratuits", none: "aucune ce jour-là" },
  en: { dep: "Departure (ICAO or IATA)", arr: "Arrival", date: "Date (UTC)", out: "Off-block", off: "Takeoff", on: "Landing", in: "On-block", opt: "optional", utc: "Times in UTC", night: "Night time (block)", air: "of which airborne", to: "Takeoff at night", ldg: "Landing at night", yes: "yes", no: "no", unknown: "Unknown airport", fill: "Enter both airports, the date and the block times.", twilight: "End of evening civil twilight (UTC)", cta: "Geardown works this out for every flight in your logbook, automatically.", try: "Try 30 days free", none: "none that day" },
};

const hm = (m: number) => `${Math.floor(m / 60)}:${String(Math.round(m) % 60).padStart(2, "0")}`;
const okTime = (s: string) => /^([01]\d|2[0-3]):?[0-5]\d$/.test(s.trim());
const norm = (s: string) => (s.includes(":") ? s : `${s.slice(0, 2)}:${s.slice(2)}`);

/** The minute (UTC, HH:MM) the sun goes below −6° in the evening at a place, on a date. */
function duskUtc(lat: number, lon: number, date: string): string | null {
  const day0 = Date.parse(`${date}T00:00:00Z`);
  let prev = sunElevation(lat, lon, day0);
  for (let m = 1; m <= 1440; m++) {
    const e = sunElevation(lat, lon, day0 + m * 60_000);
    if (prev >= CIVIL_TWILIGHT_DEG && e < CIVIL_TWILIGHT_DEG) return new Date(day0 + m * 60_000).toISOString().slice(11, 16);
    prev = e;
  }
  return null;
}

export function NightCalculator({ locale }: { locale: "fr" | "en" }) {
  const t = L[locale];
  const [idx, setIdx] = useState<AirportIndex | null>(null);
  useEffect(() => void loadAirports().then(setIdx).catch(() => null), []);
  const [v, setV] = useState({ dep: "LSGG", arr: "EGLL", date: new Date().toISOString().slice(0, 10), out: "15:40", off: "", on: "", in: "17:25" });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  const dep = idx?.get(v.dep);
  const arr = idx?.get(v.arr);

  const res = useMemo(() => {
    if (!dep || !arr || !/^\d{4}-\d{2}-\d{2}$/.test(v.date) || !okTime(v.out) || !okTime(v.in)) return null;
    // each time after the previous one: a time earlier than the one before is on the next day
    let last = Date.parse(`${v.date}T${norm(v.out)}:00Z`);
    const at = (s: string) => {
      if (!okTime(s)) return null;
      let x = Date.parse(`${v.date}T${norm(s)}:00Z`);
      while (x < last) x += 86_400_000;
      last = x;
      return new Date(x).toISOString();
    };
    const outUtc = new Date(last).toISOString();
    const offUtc = at(v.off);
    const onUtc = at(v.on);
    const inUtc = at(v.in);
    return computeNight({ dep: { lat: dep.lat, lon: dep.lon }, arr: { lat: arr.lat, lon: arr.lon }, outUtc, offUtc, onUtc, inUtc });
  }, [dep, arr, v]);

  const field = (k: keyof typeof v, label: string, extra: { placeholder?: string; type?: string; opt?: boolean } = {}) => (
    <label className="block min-w-0">
      <span className="text-xs font-semibold text-muted">{label}{extra.opt ? ` · ${t.opt}` : ""}</span>
      <input id={`night-${k}`} className="input mt-1 num uppercase" type={extra.type ?? "text"} value={v[k]} onChange={set(k)} placeholder={extra.placeholder} inputMode={k === "dep" || k === "arr" || k === "date" ? undefined : "numeric"} />
    </label>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="card space-y-4 p-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            {field("dep", t.dep)}
            <p className="mt-1 truncate text-xs text-muted">{idx ? (dep ? `${dep.name}` : t.unknown) : "…"}</p>
          </div>
          <div>
            {field("arr", t.arr)}
            <p className="mt-1 truncate text-xs text-muted">{idx ? (arr ? `${arr.name}` : t.unknown) : "…"}</p>
          </div>
        </div>
        {field("date", t.date, { type: "date" })}
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t.utc}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {field("out", t.out, { placeholder: "HH:MM" })}
          {field("off", t.off, { placeholder: "HH:MM", opt: true })}
          {field("on", t.on, { placeholder: "HH:MM", opt: true })}
          {field("in", t.in, { placeholder: "HH:MM" })}
        </div>
      </div>
      <div className="card p-5" aria-live="polite">
        {res ? (
          <>
            <p className="text-sm text-muted">{t.night}</p>
            <p className="num text-5xl font-bold text-accent">{hm(res.nightMin)}</p>
            <p className="num mt-1 text-sm text-muted">{t.air} {hm(res.nightAirMin)}</p>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-surface-2 p-3"><dt className="text-muted">{t.to}</dt><dd className="font-semibold">{res.takeoffAtNight ? t.yes : t.no}</dd></div>
              <div className="rounded-xl bg-surface-2 p-3"><dt className="text-muted">{t.ldg}</dt><dd className="font-semibold">{res.landingAtNight ? t.yes : t.no}</dd></div>
            </dl>
            {dep && arr && (
              <p className="num mt-4 text-xs text-muted">
                {t.twilight}: {dep.icao} {duskUtc(dep.lat, dep.lon, v.date) ?? t.none} · {arr.icao} {duskUtc(arr.lat, arr.lon, v.date) ?? t.none}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">{t.fill}</p>
        )}
        <div className="mt-6 border-t border-border pt-4">
          <p className="text-sm">{t.cta}</p>
          <Link href="/inscription" className="btn btn-primary btn-sm mt-3">{t.try} →</Link>
        </div>
      </div>
    </div>
  );
}
