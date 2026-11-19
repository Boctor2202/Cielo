"use client";

import { ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { discoveryBadges, hourLevel, TIERS, type DiscoveryBadge, type Flight, type OpeningBalance } from "@cielo/core";
import { Link } from "@/i18n/navigation";
import { TIER_COLORS as TIER } from "@/lib/badgeArt";
import { Emblem, Wings } from "./Achievements";

/** The pilot's honours on the profile: the wings of their hour level, the way to the next ones, and the best badge of each series. */
export function Honours({ flights, opening, airport }: { flights: Flight[]; opening: OpeningBalance[]; airport: (icao: string) => { country?: string; lat: number; lon: number } | undefined }) {
  const t = useTranslations("app.badges");
  const reduce = useReducedMotion();
  const level = useMemo(() => hourLevel(flights, opening), [flights, opening]);
  const badges = useMemo(() => discoveryBadges(flights, airport), [flights, airport]);
  // the highest badge held in each series, the rarest metal first
  const held = useMemo(() => {
    const best = new Map<string, DiscoveryBadge>();
    for (const b of badges) if (b.unlocked) best.set(b.series, b);
    return [...best.values()].sort((a, b) => TIERS.indexOf(b.tier) - TIERS.indexOf(a.tier) || b.rank - a.rank);
  }, [badges]);
  const earned = badges.filter((b) => b.unlocked).length;
  const h = Math.floor(level.totalMin / 60);
  const tier = level.current?.tier ?? "bronze";
  const [from, to] = TIER[tier];
  const shown = held.slice(0, 6);

  return (
    <motion.aside
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.15, ease: [0.25, 0.8, 0.3, 1] }}
      className="relative w-full overflow-hidden rounded-2xl border border-white/15 bg-[#02040b]/65 p-5 text-white shadow-[0_30px_60px_-20px_rgba(0,0,0,.7)] backdrop-blur-xl sm:w-[400px] sm:justify-self-end"
      aria-label={t("honours")}
    >
      {/* the metal of the level, as a soft light behind the wings */}
      <div className="pointer-events-none absolute -top-16 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full opacity-40 blur-3xl" style={{ background: `radial-gradient(closest-side, ${to}, transparent)` }} />
      <div className="relative flex items-center justify-between">
        <p className="mono-label !text-[10px] !text-white/60">{t("honours")}</p>
        <Link href="/app/statistiques" className="inline-flex items-center gap-0.5 text-xs font-semibold text-white/70 transition hover:text-white">
          {t("allBadges")} <ChevronRight size={14} />
        </Link>
      </div>

      <div className="relative mt-3 flex flex-col items-center text-center">
        {level.current ? <Wings hours={level.current.hours} tier={tier} width={190} /> : <Wings hours={100} tier="bronze" locked width={190} />}
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: level.current ? from : "rgba(255,255,255,.55)" }}>
          {level.current ? t(`title.${level.current.hours}`) : t("noWings")}
        </p>
        <p className="num mt-0.5 font-display text-2xl font-semibold">
          {h.toLocaleString()} <span className="text-base font-normal text-white/60">h</span>
        </p>
        {level.next && (
          <div className="mt-3 w-full">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${to}, ${from})`, boxShadow: `0 0 12px ${from}88` }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(3, level.ratio * 100)}%` }}
                transition={{ duration: reduce ? 0 : 1.1, delay: 0.3, ease: [0.25, 0.8, 0.3, 1] }}
              />
            </div>
            <p className="mt-1.5 text-xs text-white/60">{t("toNext", { left: (level.next.hours - h).toLocaleString(), n: level.next.hours.toLocaleString() })}</p>
          </div>
        )}
      </div>

      <div className="relative mt-4 border-t border-white/10 pt-3">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-semibold text-white/80">{t("distinctions")}</p>
          <p className="num text-xs text-white/50">{earned} / {badges.length}</p>
        </div>
        {shown.length ? (
          <ul className="mt-2.5 flex flex-wrap gap-2">
            {shown.map((b, i) => (
              <motion.li
                key={b.id}
                title={`${t(`d.${b.id}`)} · ${t(`dd.${b.id}`)}`}
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.45 + i * 0.07, type: "spring", stiffness: 260, damping: 18 }}
              >
                <Emblem badge={b} size={46} />
              </motion.li>
            ))}
            {held.length > shown.length && (
              <li className="grid h-[49px] w-[46px] place-items-center text-xs font-semibold text-white/60">+{held.length - shown.length}</li>
            )}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-white/55">{t("noDistinction")}</p>
        )}
      </div>
    </motion.aside>
  );
}
