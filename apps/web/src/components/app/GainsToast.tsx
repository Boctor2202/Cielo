"use client";

import { Clock, Globe2, MapPin, Moon, Plane, Route, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { logbookGains, type LogbookGains } from "@cielo/core";
import { useAirports } from "@/lib/airports";
import { db } from "@/lib/db";
import { GAINS_EVENT } from "@/lib/gains";
import { useDuration } from "@/lib/hooks";
import { TIER_COLORS } from "@/lib/badgeArt";
import { Emblem, Wings } from "./Achievements";
import { BadgeCelebration } from "./BadgeCelebration";
import { Meter } from "./ui";

/** After a flight is saved or a file imported: what it brought to the logbook, and the badges it unlocked. */
export function GainsToast() {
  const t = useTranslations("app.gains");
  const tb = useTranslations("app.badges");
  const airports = useAirports();
  const dur = useDuration();
  const reduce = useReducedMotion();
  const [g, setG] = useState<LogbookGains | null>(null);
  // badges just unlocked: celebrated full screen first, then the summary of the gains
  const [party, setParty] = useState<LogbookGains | null>(null);

  useEffect(() => {
    const on = async (e: Event) => {
      const ids = (e as CustomEvent<string[]>).detail;
      if (!airports || !ids?.length) return;
      const [flights, opening] = await Promise.all([db().t("flights").toArray(), db().t("opening_balances").toArray()]);
      const gains = logbookGains(flights, ids, (icao) => airports.get(icao), opening);
      if (!gains.flights) return;
      if (gains.badges.length) setParty(gains);
      else setG(gains);
    };
    window.addEventListener(GAINS_EVENT, on);
    return () => window.removeEventListener(GAINS_EVENT, on);
  }, [airports]);

  // stays longer when there is something to celebrate
  useEffect(() => {
    if (!g) return;
    const id = setTimeout(() => setG(null), g.badges.length || g.level ? 14_000 : 9_000);
    return () => clearTimeout(id);
  }, [g]);

  const chips = g
    ? [
        { icon: Clock, text: `+${dur(g.minutes)}`, sub: t("hours") },
        g.nm > 0 && { icon: Route, text: `+${g.nm.toLocaleString()}`, sub: "NM" },
        g.newAirports.length > 0 && { icon: MapPin, text: `+${g.newAirports.length}`, sub: t("airports", { count: g.newAirports.length }), detail: g.newAirports.slice(0, 4).join(" · ") },
        g.newCountries.length > 0 && { icon: Globe2, text: `+${g.newCountries.length}`, sub: t("countries", { count: g.newCountries.length }), detail: g.newCountries.slice(0, 4).join(" · ") },
        g.newTypes.length > 0 && { icon: Plane, text: `+${g.newTypes.length}`, sub: t("types", { count: g.newTypes.length }), detail: g.newTypes.slice(0, 4).join(" · ") },
        g.nightMinutes > 0 && { icon: Moon, text: `+${dur(g.nightMinutes)}`, sub: t("night") },
      ].filter(Boolean) as { icon: typeof Clock; text: string; sub: string; detail?: string }[]
    : [];

  if (party) return <BadgeCelebration badges={party.badges} onDone={() => { setG(party); setParty(null); }} />;
  return (
    <AnimatePresence>
      {g && (
        <motion.aside
          role="status"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md overflow-hidden rounded-2xl border border-white/15 bg-[#061226]/95 text-white shadow-[0_30px_80px_-20px_rgba(0,0,0,.8)] backdrop-blur-xl lg:inset-x-auto lg:bottom-6 lg:right-6"
        >
          <div className="pointer-events-none absolute -top-20 left-1/2 h-40 w-80 -translate-x-1/2 rounded-full bg-[var(--accent)] opacity-25 blur-3xl" />
          <div className="relative p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles size={16} className="text-[var(--accent)]" />
                {g.flights === 1 ? t("titleOne") : t("titleMany", { count: g.flights })}
              </p>
              <button type="button" onClick={() => setG(null)} aria-label={t("close")} className="rounded-md p-1 text-white/60 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <ul className="mt-3 grid grid-cols-3 gap-2">
              {chips.map((c, i) => (
                <motion.li
                  key={c.sub}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.06 }}
                  className="rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-2"
                  title={c.detail}
                >
                  <c.icon size={14} className="text-[var(--accent)]" aria-hidden />
                  <p className="num mt-1 text-lg font-bold leading-none">{c.text}</p>
                  <p className="mt-0.5 truncate text-[11px] text-white/60">{c.sub}</p>
                  {c.detail && <p className="num truncate text-[10px] text-white/45">{c.detail}</p>}
                </motion.li>
              ))}
            </ul>

            {g.level && (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.05] p-2.5">
                <Wings hours={g.level.hours} tier={g.level.tier} width={90} />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: TIER_COLORS[g.level.tier][0] }}>{t("newWings")}</p>
                  <p className="font-semibold">{tb(`title.${g.level.hours}`)}</p>
                </div>
              </div>
            )}

            {g.badges.length > 0 && (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.05] p-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--accent)]">{t("unlocked", { count: g.badges.length })}</p>
                <ul className="mt-2 space-y-2">
                  {g.badges.slice(0, 3).map((b, i) => (
                    <motion.li key={b.id} className="flex items-center gap-3" initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35 + i * 0.12, type: "spring", stiffness: 300, damping: 16 }}>
                      <Emblem badge={b} size={40} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{tb(`d.${b.id}`)}</span>
                        <span className="block truncate text-xs text-white/60">{tb(`dd.${b.id}`)}</span>
                      </span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            )}

            {g.next && (
              <div className="mt-3">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate text-white/70">
                    {t("next")} <span className="font-semibold text-white">{tb(`d.${g.next.id}`)}</span>
                  </span>
                  <span className="num shrink-0 text-white/50">
                    {Math.floor(g.next.value).toLocaleString()} / {g.next.target.toLocaleString()}
                  </span>
                </div>
                <div className="mt-1.5">
                  <Meter value={g.next.value} max={g.next.target} level="ok" />
                </div>
              </div>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
