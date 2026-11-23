"use client";

import { useMemo, useState } from "react";
import { maxDailyFdp, subpartQMaxFdp } from "@cielo/core";
import { Link } from "@/i18n/navigation";

const L = {
  fr: { regime: "Règlement", easa: "EASA ORO.FTL (équipage acclimaté)", q: "EU-OPS Subpart Q", report: "Heure de présentation (heure de référence)", sectors: "Nombre d'étapes", max: "FDP de base maximale", end: "Fin de FDP au plus tard", next: "le lendemain", note: "Sans extension, sans service fractionné ni repos en vol. Le schéma FTL approuvé de votre exploitant prévaut.", cta: "Geardown calcule vos limites FTL à partir de votre carnet et de votre planning.", try: "Essayer 30 jours gratuits" },
  en: { regime: "Rules", easa: "EASA ORO.FTL (acclimatised crew)", q: "EU-OPS Subpart Q", report: "Reporting time (reference time)", sectors: "Number of sectors", max: "Maximum basic FDP", end: "Latest end of FDP", next: "next day", note: "Without extension, split duty or in-flight rest. Your operator's approved FTL scheme prevails.", cta: "Geardown works out your FTL limits from your logbook and roster.", try: "Try 30 days free" },
};
const hm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;

/** Subpart Q's WOCL reduction depends on the FDP itself: the length that is exactly its own limit. */
function subpartQ(start: number, sectors: number): number {
  let fdp = 13 * 60;
  for (let i = 0; i < 20; i++) {
    const next = subpartQMaxFdp(start, fdp, sectors);
    if (next === fdp) break;
    fdp = next;
  }
  return fdp;
}

export function FdpCalculator({ locale }: { locale: "fr" | "en" }) {
  const t = L[locale];
  const [regime, setRegime] = useState<"easa" | "q">("easa");
  const [report, setReport] = useState("06:30");
  const [sectors, setSectors] = useState(2);
  const res = useMemo(() => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(report);
    if (!m || +m[1]! > 23 || +m[2]! > 59) return null;
    const start = +m[1]! * 60 + +m[2]!;
    const max = regime === "easa" ? maxDailyFdp(start, sectors) : subpartQ(start, sectors);
    const end = start + max;
    return { max, end: `${String(Math.floor(end / 60) % 24).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`, nextDay: end >= 1440 };
  }, [regime, report, sectors]);
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="card space-y-4 p-5">
        <label className="block">
          <span className="text-xs font-semibold text-muted">{t.regime}</span>
          <select id="fdp-regime" className="input mt-1" value={regime} onChange={(e) => setRegime(e.target.value as "easa" | "q")}>
            <option value="easa">{t.easa}</option>
            <option value="q">{t.q}</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-muted">{t.report}</span>
          <input id="fdp-report" className="input num mt-1" type="time" value={report} onChange={(e) => setReport(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-muted">{t.sectors}</span>
          <input id="fdp-sectors" className="w-full accent-[var(--accent)]" type="range" min={1} max={10} value={sectors} onChange={(e) => setSectors(+e.target.value)} />
          <span className="num text-lg font-bold">{sectors}</span>
        </label>
      </div>
      <div className="card p-5" aria-live="polite">
        {res && (
          <>
            <p className="text-sm text-muted">{t.max}</p>
            <p className="num text-5xl font-bold text-accent">{hm(res.max)}</p>
            <p className="num mt-2 text-sm">{t.end}: <b>{res.end}</b>{res.nextDay ? ` (${t.next})` : ""}</p>
          </>
        )}
        <p className="mt-4 text-xs text-muted">{t.note}</p>
        <div className="mt-6 border-t border-border pt-4">
          <p className="text-sm">{t.cta}</p>
          <Link href="/inscription" className="btn btn-primary btn-sm mt-3">{t.try} →</Link>
        </div>
      </div>
    </div>
  );
}
