"use client";

import { DateInput } from "@/components/app/DateInput";
import { useMemo, useState } from "react";
import { computeRecency, type Flight } from "@cielo/core";
import { Link } from "@/i18n/navigation";

const L = {
  fr: {
    today: "Date du jour", date: "Date du vol", to: "Décollages", ldg: "Atterrissages", night: "dont de nuit", add: "Ajouter un vol", remove: "Retirer",
    pax: "Passagers (3 décollages, approches et atterrissages en 90 jours)", nightRule: "Nuit, commandant de bord (1 décollage, 1 approche et 1 atterrissage de nuit en 90 jours, sauf IR)",
    valid: "Valide jusqu'au", lapsed: "Non valide", missing: (t: number, l: number) => `Il manque ${t} décollage(s) et ${l} atterrissage(s) dans les 90 derniers jours.`,
    note: "Règle EASA FCL.060(b), pour un type ou une classe donnés : les décollages, approches et atterrissages comptent faits comme pilote aux commandes, sur un aéronef du même type ou de la même classe, ou sur un FFS qui le représente.",
    cta: "Geardown suit votre expérience récente pour chaque type, à partir du carnet, et vous prévient avant l'échéance.", try: "Essayer 30 jours gratuits",
  },
  en: {
    today: "Today", date: "Flight date", to: "Takeoffs", ldg: "Landings", night: "of which at night", add: "Add a flight", remove: "Remove",
    pax: "Passengers (3 takeoffs, approaches and landings in 90 days)", nightRule: "Night, as PIC (1 takeoff, approach and landing at night in 90 days, unless IR)",
    valid: "Valid until", lapsed: "Not valid", missing: (t: number, l: number) => `${t} takeoff(s) and ${l} landing(s) missing in the last 90 days.`,
    note: "EASA FCL.060(b), for one type or class: takeoffs, approaches and landings count when flown as pilot flying, in an aircraft of the same type or class, or in an FFS representing it.",
    cta: "Geardown follows your recent experience for each type, from your logbook, and warns you before it lapses.", try: "Try 30 days free",
  },
};

type Row = { date: string; to: number; ldg: number; night: number };
const iso = (d: Date) => d.toISOString().slice(0, 10);
const back = (days: number) => iso(new Date(Date.now() - days * 86_400_000));

export function RecencyCalculator({ locale }: { locale: "fr" | "en" }) {
  const t = L[locale];
  const [today, setToday] = useState(iso(new Date()));
  const [rows, setRows] = useState<Row[]>([
    { date: back(10), to: 1, ldg: 1, night: 0 },
    { date: back(25), to: 1, ldg: 1, night: 1 },
    { date: back(60), to: 1, ldg: 1, night: 0 },
  ]);
  const set = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  // the logbook's own calculation (packages/core), on flights made of the rows
  const res = useMemo(() => {
    const flights = rows
      .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date))
      .map((r, i) => {
        const n = Math.min(r.night, r.to, r.ldg);
        return { id: String(i), date: r.date, takeoffsDay: r.to - Math.min(n, r.to), takeoffsNight: Math.min(n, r.to), landingsDay: r.ldg - Math.min(n, r.ldg), landingsNight: Math.min(n, r.ldg), isFstd: false } as unknown as Flight;
      });
    return computeRecency(flights, today);
  }, [rows, today]);
  const fd = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
  const num = (v: string) => Math.max(0, Math.min(20, Math.round(Number(v) || 0)));
  const Check = ({ label, c, req }: { label: string; c: typeof res.passengers; req: number }) => (
    <div className="border-t border-border py-3 first:border-t-0 first:pt-0">
      <p className="text-sm text-muted">{label}</p>
      {c.valid && c.validUntil ? (
        <p className="text-2xl font-bold text-accent">{t.valid} {fd(c.validUntil)}</p>
      ) : (
        <>
          <p className="text-2xl font-bold text-[var(--warning)]">{t.lapsed}</p>
          <p className="text-sm">{t.missing(Math.max(0, req - c.takeoffs), Math.max(0, req - c.landings))}</p>
        </>
      )}
    </div>
  );
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="card space-y-4 p-5">
        <label className="block max-w-xs">
          <span className="text-xs font-semibold text-muted">{t.today}</span>
          <DateInput className="input num mt-1" value={today} onChange={(e) => setToday(e.target.value)} />
        </label>
        <div className="space-y-2">
          <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr_auto] gap-2 text-xs font-semibold text-muted">
            <span>{t.date}</span><span>{t.to}</span><span>{t.ldg}</span><span>{t.night}</span><span className="sr-only">{t.remove}</span>
          </div>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1.6fr_1fr_1fr_1fr_auto] items-center gap-2">
              <DateInput aria-label={t.date} className="input num" value={r.date} onChange={(e) => set(i, { date: e.target.value })} />
              <input aria-label={t.to} className="input num" type="number" min={0} max={20} value={r.to} onChange={(e) => set(i, { to: num(e.target.value) })} />
              <input aria-label={t.ldg} className="input num" type="number" min={0} max={20} value={r.ldg} onChange={(e) => set(i, { ldg: num(e.target.value) })} />
              <input aria-label={t.night} className="input num" type="number" min={0} max={20} value={r.night} onChange={(e) => set(i, { night: num(e.target.value) })} />
              <button type="button" className="btn btn-ghost btn-sm" aria-label={t.remove} onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRows((x) => [...x, { date: today, to: 1, ldg: 1, night: 0 }])}>+ {t.add}</button>
        </div>
      </div>
      <div className="card p-5" aria-live="polite">
        <Check label={t.pax} c={res.passengers} req={3} />
        <Check label={t.nightRule} c={res.night} req={1} />
        <p className="mt-4 text-xs text-muted">{t.note}</p>
        <div className="mt-6 border-t border-border pt-4">
          <p className="text-sm">{t.cta}</p>
          <Link href="/inscription" className="btn btn-primary btn-sm mt-3">{t.try} →</Link>
        </div>
      </div>
    </div>
  );
}
