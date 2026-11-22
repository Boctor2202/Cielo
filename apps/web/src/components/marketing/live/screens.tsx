"use client";

import { motion } from "motion/react";
import { useLocale } from "next-intl";
import { AppWindow, C, Check, Count, Label, hm, useFr, useLive } from "./kit";
import { EUROPE_AIRPORTS, EUROPE_H, EUROPE_LAND, EUROPE_W } from "./europe";

const ease = [0.2, 0.8, 0.2, 1] as const;

/** Overview: total time counting up, the goal ring filling, the twelve months growing. */
export function DashboardLive({ className = "" }: { className?: string }) {
  const { ref, on } = useLive<HTMLDivElement>();
  const locale = useLocale();
  const f = useFr();
  const months = [14, 47, 38, 33, 65, 36, 47, 42, 56, 54, 61, 28];
  return (
    <div ref={ref} className={className}>
      <AppWindow title={f ? "Vue d'ensemble" : "Overview"}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label>{f ? "Temps total" : "Total time"}</Label>
            <p className="mt-1 text-[38px] font-extrabold leading-none tracking-tight"><Count to={110884} on={on} format={hm(locale)} /></p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[["PIC", 14092], [f ? "Nuit" : "Night", 16911], ["IFR", 94392]].map(([k, v], i) => (
                <div key={k} className="rounded-lg px-2.5 py-1.5 text-[11px]" style={{ background: C.surface, color: C.muted }}>
                  {k}
                  <b className="block text-[15px]" style={{ color: C.text }}><Count to={v as number} on={on} format={hm(locale)} delay={0.1 * i} /></b>
                </div>
              ))}
            </div>
          </div>
          <svg width="92" height="92" viewBox="0 0 96 96" className="shrink-0" aria-hidden>
            <circle cx="48" cy="48" r="40" stroke="#ffffff14" strokeWidth="9" fill="none" />
            <motion.circle cx="48" cy="48" r="40" stroke={C.accent} strokeWidth="9" fill="none" strokeLinecap="round" transform="rotate(-90 48 48)" initial={{ pathLength: 0 }} animate={{ pathLength: on ? 0.92 : 0 }} transition={{ duration: 1.6, ease }} />
            <text x="48" y="54" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="800">
              {on ? "92%" : ""}
            </text>
          </svg>
        </div>
        <div className="mt-4 flex h-28 items-end gap-1.5">
          {months.map((h, i) => (
            <motion.i key={i} className="flex-1 rounded-t-[4px]" style={{ background: `linear-gradient(${C.accent2}, #16a34a)`, originY: 1 }} initial={{ height: 0 }} animate={{ height: on ? `${(h / 65) * 100}%` : 0 }} transition={{ duration: 0.7, delay: 0.15 + i * 0.06, ease }} />
          ))}
        </div>
      </AppWindow>
    </div>
  );
}

const FLIGHTS = [
  ["LFPO", "LIRF", 125, "F-HGDY"],
  ["LIRF", "LFPO", 132, "F-HGDY"],
  ["LFPO", "LEBL", 101, "F-HGDW"],
  ["LEBL", "LFPO", 106, "F-HGDW"],
  ["LFPO", "EGLL", 72, "F-HGDN"],
  ["EGLL", "LFPO", 69, "F-HGDN"],
] as const;

/** Import of a paper logbook page: the page is scanned, each line comes in checked, the totals add up. */
export function ImportLive({ className = "" }: { className?: string }) {
  const { ref, on, reduce } = useLive<HTMLDivElement>();
  const locale = useLocale();
  const f = useFr();
  const total = FLIGHTS.reduce((x, r) => x + r[2], 0);
  return (
    <div ref={ref} className={className}>
      <AppWindow title={f ? "Importer · photo du carnet papier" : "Import · photo of the paper logbook"}>
        <div className="grid grid-cols-[92px_1fr] gap-3">
          {/* the paper page, scanned */}
          <div className="relative h-[214px] overflow-hidden rounded-md bg-[#f4efe3]">
            {Array.from({ length: 14 }, (_, i) => (
              <div key={i} className="mx-2 mt-[13px] h-[2px] rounded" style={{ background: i % 3 ? "#cdbf9f" : "#9c8b66", width: `${60 + ((i * 37) % 35)}%` }} />
            ))}
            {!reduce && <motion.div className="absolute inset-x-0 h-8" style={{ background: "linear-gradient(transparent, rgba(34,197,94,.45), transparent)" }} initial={{ top: "-20%" }} animate={on ? { top: "110%" } : {}} transition={{ duration: 2.4, ease: "linear" }} />}
          </div>
          <div className="space-y-1.5">
            {FLIGHTS.map(([a, b, m, reg], i) => (
              <motion.div key={i} className="flex items-center gap-2 rounded-lg px-2.5 py-[7px] text-[12px]" style={{ background: C.surface }} initial={{ opacity: 0, y: 8 }} animate={on ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.35, delay: 0.4 + i * 0.32 }}>
                <Check on={on} delay={0.55 + i * 0.32} />
                <b className="font-mono">{a} → {b}</b>
                <span className="hidden text-[10px] sm:inline" style={{ color: C.muted }}>A320 · {reg}</span>
                <span className="ml-auto tabular-nums">{hm(locale)(m)}</span>
              </motion.div>
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-lg border px-3 py-2 text-[13px]" style={{ background: "#22c55e1c", borderColor: "#22c55e55" }}>
          <span>✓ <b><Count to={FLIGHTS.length} on={on} duration={2.2} delay={0.4} /></b> {f ? "vols lus, prêts à importer" : "flights read, ready to import"}</span>
          <b><Count to={total} on={on} duration={2.2} delay={0.4} format={hm(locale)} /></b>
        </div>
      </AppWindow>
    </div>
  );
}

/** The logbook: lines slide in with their night and IFR, the page totals run. */
export function LogbookLive({ className = "" }: { className?: string }) {
  const { ref, on } = useLive<HTMLDivElement>();
  const locale = useLocale();
  const f = useFr();
  const rows = [
    ["16/11", "LSGG", "LFPO", 77, 0, 77, "PICUS"],
    ["16/11", "LFPO", "LSGG", 70, 0, 70, "PICUS"],
    ["15/11", "LPPT", "LFPO", 153, 41, 153, "SIC"],
    ["15/11", "LFPO", "LPPT", 152, 0, 152, "SIC"],
    ["14/11", "LFLL", "LFPO", 66, 66, 66, "PICUS"],
  ] as const;
  return (
    <div ref={ref} className={className}>
      <AppWindow title={f ? "Carnet de vol" : "Logbook"} bodyClass="p-0">
        <div className="grid grid-cols-[48px_1fr_56px_56px_56px] gap-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.muted, background: C.surface }}>
          <span>Date</span><span>{f ? "Route" : "Route"}</span><span className="text-right">{f ? "Nuit" : "Night"}</span><span className="text-right">IFR</span><span className="text-right">Total</span>
        </div>
        {rows.map(([d, a, b, t, n, ifr, fn], i) => (
          <motion.div key={i} className="grid grid-cols-[48px_1fr_56px_56px_56px] items-center gap-2 border-b px-4 py-2.5 text-[12.5px]" style={{ borderColor: C.line }} initial={{ opacity: 0, x: -14 }} animate={on ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.4, delay: 0.2 + i * 0.18, ease }}>
            <span style={{ color: C.muted }}>{d}</span>
            <span className="flex items-center gap-2"><b className="font-mono">{a} → {b}</b><span className="rounded px-1.5 text-[10px] font-bold" style={{ background: "#22c55e26", color: C.accent2 }}>{fn}</span></span>
            <span className="text-right tabular-nums" style={{ color: n ? C.indigo : C.muted }}>{n ? hm(locale)(n) : "—"}</span>
            <span className="text-right tabular-nums" style={{ color: C.sky }}>{hm(locale)(ifr)}</span>
            <b className="text-right tabular-nums">{hm(locale)(t)}</b>
          </motion.div>
        ))}
        <div className="grid grid-cols-[48px_1fr_56px_56px_56px] gap-2 px-4 py-3 text-[12.5px] font-bold" style={{ background: "#22c55e14" }}>
          <span />
          <span>{f ? "Total de la page" : "Page total"}</span>
          <span className="text-right" style={{ color: C.indigo }}><Count to={107} on={on} format={hm(locale)} delay={0.3} /></span>
          <span className="text-right" style={{ color: C.sky }}><Count to={518} on={on} format={hm(locale)} delay={0.3} /></span>
          <span className="text-right"><Count to={518} on={on} format={hm(locale)} delay={0.3} /></span>
        </div>
      </AppWindow>
    </div>
  );
}

/** Flight map: airports appear, routes draw themselves from Paris, the counters run. */
export function MapLive({ className = "" }: { className?: string }) {
  const { ref, on } = useLive<HTMLDivElement>();
  const f = useFr();
  const P = EUROPE_AIRPORTS;
  const routes: [string, string][] = [["LFPG", "EGLL"], ["LFPG", "LIRF"], ["LFPG", "LEBL"], ["LFPG", "LSGG"], ["LFPG", "EHAM"], ["LFPG", "LPPT"], ["LFPG", "ESSA"], ["LFPG", "LGAV"], ["LFPG", "GMMN"], ["LFPG", "EDDM"], ["LFPG", "LFMN"], ["LFPG", "EIDW"], ["EGLL", "LIRF"], ["LFPG", "LKPR"]];
  const arc = (a: [number, number], b: [number, number]) => {
    const [x1, y1] = a;
    const [x2, y2] = b;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * 0.22;
    return `M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`;
  };
  return (
    <div ref={ref} className={className}>
      <AppWindow title={f ? "Carte des vols" : "Flight map"} bodyClass="relative p-0">
        <svg viewBox={`0 0 ${EUROPE_W} ${EUROPE_H}`} className="block w-full" style={{ background: "#0a1626" }} aria-hidden>
          <path d={EUROPE_LAND} fill="#1b3a60" stroke="#2c5a8c" strokeWidth="0.8" />
          {routes.map(([a, b], i) => (
            <motion.path key={i} d={arc(P[a]!, P[b]!)} fill="none" stroke={C.accent2} strokeWidth="2" strokeLinecap="round" initial={{ pathLength: 0, opacity: 0 }} animate={on ? { pathLength: 1, opacity: 0.95 } : {}} transition={{ duration: 0.9, delay: 0.5 + i * 0.12, ease: "easeOut" }} />
          ))}
          {Object.entries(P).map(([k, [x, y]], i) => (
            <motion.circle key={k} cx={x} cy={y} fill="#fff" stroke="#07101f" strokeWidth="2" initial={{ r: 0 }} animate={on ? { r: k === "LFPG" ? 7 : 4.5 } : {}} transition={{ type: "spring", stiffness: 400, damping: 14, delay: 0.3 + i * 0.08 }} />
          ))}
        </svg>
        <div className="absolute bottom-3 left-3 flex gap-2">
          {[[f ? "vols" : "flights", 584], [f ? "aéroports" : "airports", 110], ["NM", 126993], [f ? "pays" : "countries", 20]].map(([k, v]) => (
            <div key={k} className="rounded-lg px-2.5 py-1.5 text-[10.5px] backdrop-blur" style={{ background: "#0b1626dd", color: C.muted }}>
              <b className="block text-[15px]" style={{ color: C.text }}><Count to={v as number} on={on} duration={2.2} delay={0.4} /></b>
              {k}
            </div>
          ))}
        </div>
      </AppWindow>
    </div>
  );
}

/** Flight time limitations: the gauges fill to where the pilot stands. */
export function FtlLive({ className = "" }: { className?: string }) {
  const { ref, on } = useLive<HTMLDivElement>();
  const locale = useLocale();
  const f = useFr();
  const rows = [
    [f ? "Temps de vol, 28 jours" : "Flight time, 28 days", 2051, 6000],
    [f ? "Temps de vol, année civile" : "Flight time, calendar year", 29513, 54000],
    [f ? "Temps de vol, 12 mois" : "Flight time, 12 months", 33136, 60000],
    [f ? "Service, 28 jours" : "Duty, 28 days", 3496, 11400],
    [f ? "Service, 7 jours" : "Duty, 7 days", 2580, 3600],
  ] as const;
  return (
    <div ref={ref} className={className}>
      <AppWindow title={f ? "Limites de temps de vol (FTL)" : "Flight time limitations (FTL)"}>
        <Label>ORO.FTL.210</Label>
        <p className="mt-1 text-[30px] font-extrabold leading-none"><Count to={2051} on={on} format={hm(locale)} /> <span className="text-base font-semibold" style={{ color: C.muted }}>/ 100:00</span></p>
        <div className="mt-4 space-y-3">
          {rows.map(([k, v, max], i) => {
            const r = v / max;
            const col = r > 0.65 ? C.amber : C.accent;
            return (
              <div key={k}>
                <div className="flex justify-between text-[12px]"><span>{k}</span><span className="tabular-nums" style={{ color: r > 0.65 ? C.amber : C.muted }}><Count to={v} on={on} format={hm(locale)} delay={i * 0.12} /> / {hm(locale)(max)}</span></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full" style={{ background: "#ffffff10" }}>
                  <motion.div className="h-full rounded-full" style={{ background: col }} initial={{ width: 0 }} animate={{ width: on ? `${r * 100}%` : 0 }} transition={{ duration: 1.1, delay: 0.2 + i * 0.12, ease }} />
                </div>
              </div>
            );
          })}
        </div>
      </AppWindow>
    </div>
  );
}

/** Licences and medical: the next expiries come in, the one due soon lights up. */
export function LicencesLive({ className = "" }: { className?: string }) {
  const { ref, on } = useLive<HTMLDivElement>();
  const f = useFr();
  const rows = [
    ["Class 1", f ? "Médical" : "Medical", 25, C.amber],
    ["TR A320 + IR", f ? "Qualification" : "Rating", 139, C.accent],
    ["SEP (land)", f ? "Qualification" : "Rating", 299, C.accent],
    ["ATPL(A)", "Licence", null, C.accent],
  ] as const;
  return (
    <div ref={ref} className={className}>
      <AppWindow title={f ? "Licences, médical et qualifications" : "Licences, medical and ratings"}>
        <div className="space-y-2">
          {rows.map(([code, kind, days, col], i) => (
            <motion.div key={code} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: C.surface }} initial={{ opacity: 0, y: 10 }} animate={on ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.35, delay: 0.2 + i * 0.15 }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: col }} />
              <div className="flex-1">
                <b className="text-[14px]">{code}</b>
                <p className="text-[11px]" style={{ color: C.muted }}>{kind}</p>
              </div>
              <motion.span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: `${col}26`, color: col }} initial={{ scale: 0 }} animate={on ? { scale: days === 25 ? [0, 1.25, 1] : 1 } : {}} transition={{ duration: 0.5, delay: 0.5 + i * 0.15 }}>
                {days === null ? (f ? "sans échéance" : "no expiry") : f ? `${days} j restants` : `${days} d left`}
              </motion.span>
            </motion.div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-[12px]" style={{ color: C.accent2 }}>
          <Check on={on} delay={1.2} /> {f ? "Expérience récente : à jour (3 atterrissages en 90 jours)" : "Recent experience: current (3 landings in 90 days)"}
        </div>
      </AppWindow>
    </div>
  );
}

/** Signing: the flights are ticked, the signature draws itself, the flights are signed. */
export function SignatureLive({ className = "" }: { className?: string }) {
  const { ref, on } = useLive<HTMLDivElement>();
  const locale = useLocale();
  const f = useFr();
  return (
    <div ref={ref} className={className}>
      <AppWindow title={f ? "Signer mes vols" : "Sign my flights"}>
        {[["LSGG", "LFPO", 77], ["LFPO", "LSGG", 70], ["LFLL", "LFPO", 66]].map(([a, b, m], i) => (
          <div key={i} className="mb-1.5 flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12.5px]" style={{ background: C.surface }}>
            <Check on={on} delay={0.2 + i * 0.2} />
            <b className="font-mono">{a} → {b}</b>
            <span className="ml-auto tabular-nums">{hm(locale)(m as number)}</span>
          </div>
        ))}
        <div className="relative mt-3 rounded-xl bg-white">
          <svg viewBox="0 0 520 120" className="block w-full" aria-hidden>
            <motion.path
              d="M30 80 C55 20 80 18 72 72 S95 104 120 52 C130 32 145 34 141 64 C137 88 165 84 178 54 C186 34 196 40 193 64 C190 84 214 78 228 50 C236 34 250 40 247 64 C244 84 268 82 284 56 L300 34 C292 64 298 88 318 80 C340 70 360 54 395 46 M90 98 C170 90 260 92 410 80"
              fill="none" stroke="#0a1626" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: on ? 1 : 0 }} transition={{ duration: 1.8, delay: 0.8, ease: "easeInOut" }}
            />
          </svg>
          <motion.span className="absolute right-3 top-3 rounded-full px-3 py-1 text-[12px] font-extrabold" style={{ background: C.accent, color: "#04140a" }} initial={{ scale: 0 }} animate={on ? { scale: 1 } : {}} transition={{ type: "spring", stiffness: 380, damping: 14, delay: 2.7 }}>
            ✓ {f ? "3 vols signés" : "3 flights signed"}
          </motion.span>
          <p className="px-3 pb-2 text-[10.5px] text-[#5b6878]">Thomas Mercier · {f ? "Commandant" : "Captain"} · FRA.FCL.PA.012345</p>
        </div>
      </AppWindow>
    </div>
  );
}

/** Jobs: offers come in with how well the pilot's hours match them. */
export function JobsLive({ className = "" }: { className?: string }) {
  const { ref, on } = useLive<HTMLDivElement>();
  const f = useFr();
  const jobs = [
    ["NetJets", f ? "Commandant · Citation Latitude" : "Captain · Citation Latitude", 100],
    ["Luxaviation", f ? "Copilote · Falcon 7X" : "First Officer · Falcon 7X", 86],
    ["Transavia", f ? "Copilote · B737" : "First Officer · B737", 71],
  ] as const;
  return (
    <div ref={ref} className={className}>
      <AppWindow title={f ? "Offres d'emploi pilote" : "Pilot jobs"}>
        <div className="space-y-2">
          {jobs.map(([co, role, pct], i) => (
            <motion.div key={co} className="rounded-xl px-3 py-2.5" style={{ background: C.surface }} initial={{ opacity: 0, y: 10 }} animate={on ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.35, delay: 0.15 + i * 0.18 }}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <b className="text-[13.5px]">{co}</b>
                  <p className="truncate text-[11.5px]" style={{ color: C.muted }}>{role}</p>
                </div>
                <b className="text-[17px] tabular-nums" style={{ color: pct === 100 ? C.accent2 : C.text }}><Count to={pct} on={on} delay={0.3 + i * 0.18} />%</b>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: "#ffffff10" }}>
                <motion.div className="h-full rounded-full" style={{ background: pct === 100 ? C.accent : C.sky }} initial={{ width: 0 }} animate={{ width: on ? `${pct}%` : 0 }} transition={{ duration: 1.1, delay: 0.3 + i * 0.18, ease }} />
              </div>
            </motion.div>
          ))}
        </div>
        <p className="mt-3 text-[11.5px]" style={{ color: C.muted }}>{f ? "Triées selon vos heures de vol, votre type et vos licences." : "Sorted by your flight hours, type and licences."}</p>
      </AppWindow>
    </div>
  );
}

/** The iPhone app's overview, in a phone. */
export function PhoneLive({ className = "", variant = "home" }: { className?: string; variant?: "home" | "map" }) {
  const { ref, on } = useLive<HTMLDivElement>();
  const locale = useLocale();
  const f = useFr();
  return (
    <div ref={ref} className={`rounded-[40px] border-[8px] border-[#0b0b0e] shadow-[0_40px_80px_-25px_rgba(0,0,0,.7)] ${className}`} style={{ background: "linear-gradient(170deg,#0b1830,#060d1c 55%,#03060f)" }}>
      <div className="relative h-full overflow-hidden rounded-[32px] px-3.5 pb-4 pt-9 text-left" style={{ color: C.text, background: "radial-gradient(90% 55% at 85% 8%, #22c55e33, transparent 60%)" }}>
        <div className="absolute left-1/2 top-2 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
        <p className="text-[20px] font-bold">{f ? "Vue d'ensemble" : "Overview"}</p>
        {variant === "home" ? (
          <>
            <div className="mt-3 rounded-2xl border p-3" style={{ borderColor: "#ffffff1a", background: "#ffffff0d" }}>
              <Label>{f ? "Temps total" : "Total time"}</Label>
              <p className="whitespace-nowrap text-[22px] font-extrabold"><Count to={110884} on={on} format={hm(locale)} /></p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full" style={{ background: C.accent }} initial={{ width: 0 }} animate={{ width: on ? "92%" : 0 }} transition={{ duration: 1.4, ease }} /></div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[[f ? "28 jours" : "28 days", 2051, C.sky], [f ? "Prochain" : "Next duty", null, C.indigo]].map(([k, v, col], i) => (
                <div key={i} className="rounded-2xl border p-2.5" style={{ borderColor: "#ffffff1a", background: "#ffffff0d" }}>
                  <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>{k as string}</p>
                  {v ? <b className="whitespace-nowrap text-[15px]" style={{ color: col as string }}><Count to={v as number} on={on} format={hm(locale)} /></b> : <b className="whitespace-nowrap text-[12px]">LFPO → LIRF</b>}
                </div>
              ))}
            </div>
            <div className="mt-2 rounded-2xl border p-2.5" style={{ borderColor: "#ffffff1a", background: "#ffffff0d" }}>
              <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>{f ? "Derniers vols" : "Latest flights"}</p>
              {[["LSGG → LFPO", 77], ["LFPO → LSGG", 70], ["LPPT → LFPO", 153]].map(([r, m], i) => (
                <motion.div key={i} className="mt-1.5 flex justify-between text-[11.5px]" initial={{ opacity: 0, x: -8 }} animate={on ? { opacity: 1, x: 0 } : {}} transition={{ delay: 0.4 + i * 0.15 }}>
                  <b className="font-mono">{r}</b>
                  <span className="tabular-nums" style={{ color: C.accent2 }}>{hm(locale)(m as number)}</span>
                </motion.div>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl">
            <MapMini on={on} />
          </div>
        )}
      </div>
    </div>
  );
}

function MapMini({ on }: { on: boolean }) {
  const P = EUROPE_AIRPORTS;
  return (
    <svg viewBox="80 20 420 330" className="block w-full" style={{ background: "#0a1626" }} aria-hidden>
      <path d={EUROPE_LAND} fill="#1b3a60" stroke="#2c5a8c" strokeWidth="1" />
      {(["EGLL", "LIRF", "LEBL", "LSGG", "EHAM", "ESSA", "LGAV", "EDDM", "LFMN"] as const).map((k, i) => (
        <motion.path key={k} d={`M${P.LFPG![0]} ${P.LFPG![1]} L${P[k]![0]} ${P[k]![1]}`} stroke={C.accent2} strokeWidth="2.5" fill="none" initial={{ pathLength: 0 }} animate={on ? { pathLength: 1 } : {}} transition={{ duration: 0.8, delay: 0.3 + i * 0.12 }} />
      ))}
    </svg>
  );
}
