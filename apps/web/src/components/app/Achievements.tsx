"use client";

import { BadgeCheck, Compass, Earth, Flame, Globe2, Lock, Map, Moon, MoonStar, Plane, Stamp, type LucideIcon } from "lucide-react";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { discoveryBadges, HOUR_LEVELS, hourLevel, loggingStreak, type DiscoveryId, type Flight, type OpeningBalance, type Tier } from "@cielo/core";
import { useFormatDate } from "@/lib/hooks";
import { Card } from "./ui";

const TIER: Record<Tier, [string, string]> = {
  bronze: ["#E7A46B", "#9A5B2C"],
  silver: ["#E6EBF2", "#8C99AB"],
  gold: ["#F6D77A", "#B8871F"],
  platinum: ["#C7F0FF", "#5B8DB8"],
};

// each badge: its emblem colours (light, dark), its symbol, and its rank in a series (stars)
const DISCOVERY: Record<DiscoveryId, { icon: LucideIcon; from: string; to: string; stars?: number }> = {
  firstNight: { icon: Moon, from: "#A5B4FC", to: "#3730A3" },
  nightLandings100: { icon: MoonStar, from: "#C4B5FD", to: "#4C1D95" },
  airports10: { icon: Compass, from: "#7DD3FC", to: "#0369A1", stars: 1 },
  airports50: { icon: Compass, from: "#67E8F9", to: "#0E7490", stars: 2 },
  airports100: { icon: Map, from: "#5EEAD4", to: "#115E59", stars: 3 },
  countries5: { icon: Stamp, from: "#FCD34D", to: "#B45309", stars: 1 },
  countries10: { icon: Globe2, from: "#FDBA74", to: "#C2410C", stars: 2 },
  countries25: { icon: Globe2, from: "#FCA5A5", to: "#B91C1C", stars: 3 },
  earthLap: { icon: Earth, from: "#86EFAC", to: "#15803D" },
  types3: { icon: Plane, from: "#F9A8D4", to: "#9D174D" },
  firstSigned: { icon: BadgeCheck, from: "#F0ABFC", to: "#86198F" },
};

/** A hexagonal emblem: glossy when earned, a dark silhouette with a lock while it is still to earn. */
function Emblem({ id, size = 64, locked }: { id: DiscoveryId; size?: number; locked?: boolean }) {
  const look = DISCOVERY[id];
  const g = `e-${id}-${locked ? "l" : "u"}`;
  const hex = "M32 2 L59 17.5 V50.5 L32 66 L5 50.5 V17.5 Z";
  const inner = "M32 8 L54 20.7 V47.3 L32 60 L10 47.3 V20.7 Z";
  return (
    <div className="relative shrink-0" style={{ width: size, height: (size * 68) / 64 }}>
      <svg viewBox="0 0 64 68" width={size} height={(size * 68) / 64} aria-hidden style={locked ? undefined : { filter: `drop-shadow(0 8px 14px ${look.to}66)` }}>
        <defs>
          <linearGradient id={g} x1="0" y1="0" x2="0.6" y2="1">
            <stop offset="0" stopColor={locked ? "#3B4657" : look.from} />
            <stop offset="1" stopColor={locked ? "#151C27" : look.to} />
          </linearGradient>
          <linearGradient id={`${g}-s`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity={locked ? 0.08 : 0.45} />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={hex} fill={`url(#${g})`} stroke={locked ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.55)"} strokeWidth="1.5" />
        <path d={inner} fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1" strokeDasharray={locked ? "2 3" : undefined} />
        {/* the shine on the upper half */}
        <path d="M5 17.5 L32 2 L59 17.5 V30 C44 24 20 24 5 30 Z" fill={`url(#${g}-s)`} />
        {look.stars && !locked
          ? Array.from({ length: look.stars }, (_, i) => {
              const cx = 32 + (i - (look.stars! - 1) / 2) * 8;
              return <path key={i} d={`M${cx} 47 l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z`} fill="#FFF7D6" opacity=".95" />;
            })
          : null}
      </svg>
      <look.icon
        className="absolute left-1/2 -translate-x-1/2"
        style={{ top: look.stars && !locked ? "22%" : "30%", width: size * 0.4, height: size * 0.4, color: locked ? "rgba(255,255,255,.28)" : "#fff", filter: locked ? undefined : "drop-shadow(0 2px 3px rgba(0,0,0,.35))" }}
        strokeWidth={2.2}
      />
      {locked && (
        <span className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full border border-white/15 bg-[#0b1526] text-white/70">
          <Lock size={12} />
        </span>
      )}
    </div>
  );
}

/** A round medal with the hours on it; grey and dimmed while locked. */
function Medal({ hours, tier, locked, size = 56 }: { hours: number; tier: Tier; locked?: boolean; size?: number }) {
  const [a, b] = locked ? ["#3A4658", "#1E2836"] : TIER[tier];
  const id = `m-${hours}-${locked ? "l" : "u"}`;
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" style={{ opacity: locked ? 0.45 : 1 }} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <circle cx="28" cy="28" r="26" fill={`url(#${id})`} />
      <circle cx="28" cy="28" r="21" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="1.2" strokeDasharray="2 2.5" />
      {/* wings */}
      <path d="M28 17c-2 0-3 1.4-3 1.4H13.5c1 1.8 3 2.6 5 2.6h6.3s1.2 1 3.2 1 3.2-1 3.2-1h6.3c2 0 4-.8 5-2.6H31S30 17 28 17z" fill="rgba(10,22,38,.55)" />
      <text x="28" y="38" textAnchor="middle" fontSize={hours >= 10000 ? 10 : 12} fontWeight="800" fill="rgba(10,22,38,.8)" fontFamily="var(--font-sans)">
        {hours >= 1000 ? `${hours / 1000}k` : hours}
      </text>
    </svg>
  );
}

export function Achievements({ flights, opening, airport }: { flights: Flight[]; opening: OpeningBalance[]; airport: (icao: string) => { country?: string; lat: number; lon: number } | undefined }) {
  const t = useTranslations("app.badges");
  const level = useMemo(() => hourLevel(flights, opening), [flights, opening]);
  const streak = useMemo(() => loggingStreak(flights), [flights]);
  const h = Math.floor(level.totalMin / 60);
  const discoveries = useMemo(() => discoveryBadges(flights, airport), [flights, airport]);
  const fd = useFormatDate();
  const nf = (n: number) => Math.floor(n).toLocaleString();

  return (
    <div className="space-y-5">
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title={t("levels")}>
        <div className="flex items-center gap-4">
          {level.current ? <Medal hours={level.current.hours} tier={level.current.tier} size={76} /> : <Medal hours={100} tier="bronze" locked size={76} />}
          <div className="min-w-0 flex-1">
            {level.current ? <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: TIER[level.current.tier][1] }}>{t(`title.${level.current.hours}`)}</p> : null}
            <p className="text-lg font-bold">{level.current ? t("club", { n: level.current.hours.toLocaleString() }) : t("noLevel")}</p>
            {level.next ? (
              <>
                <p className="text-sm text-muted">{t("toNext", { left: (level.next.hours - h).toLocaleString(), n: level.next.hours.toLocaleString() })}</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[color:var(--text)]/10">
                  <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(2, level.ratio * 100)}%`, background: `linear-gradient(90deg, ${TIER[level.next.tier][1]}, ${TIER[level.next.tier][0]})` }} />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">{t("allLevels")}</p>
            )}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {HOUR_LEVELS.map((l) => (
            <div key={l.hours} className="flex flex-col items-center gap-1" title={`${t(`title.${l.hours}`)} · ${t("club", { n: l.hours.toLocaleString() })}`}>
              <Medal hours={l.hours} tier={l.tier} locked={h < l.hours} size={40} />
            </div>
          ))}
        </div>
      </Card>

      <Card title={t("streak")}>
        <div className="flex items-center gap-4">
          <span className="grid h-[76px] w-[76px] shrink-0 place-items-center rounded-full" style={{ background: streak.current ? "radial-gradient(circle at 50% 60%, rgba(251,146,60,.35), rgba(251,146,60,.08))" : "color-mix(in srgb, var(--text) 8%, transparent)" }}>
            <Flame size={38} className={streak.current ? "text-orange-500 dark:text-orange-400" : "text-muted"} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold">{t("weeks", { n: streak.current })}</p>
            <p className="text-sm text-muted">
              {t("best", { n: streak.best })}
              {streak.onTimeRate !== undefined ? ` · ${t("onTime", { p: Math.round(streak.onTimeRate * 100) })}` : ""}
            </p>
          </div>
        </div>
        <div className="mt-5 flex items-end gap-1.5" aria-label={t("last12")}>
          {streak.weeks.map((w) => (
            <span
              key={w.monday}
              title={w.monday}
              className="h-6 flex-1 rounded-md"
              style={{ background: w.state === "onTime" ? "#22C55E" : w.state === "late" ? "#EF4444" : "color-mix(in srgb, var(--text) 10%, transparent)" }}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">{t("hint")}</p>
      </Card>
    </div>
    <Card title={`${t("discoveries")} · ${discoveries.filter((b) => b.unlocked).length}/${discoveries.length}`}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {discoveries.map((b) => {
          const look = DISCOVERY[b.id];
          return (
            <div
              key={b.id}
              className={`group relative flex flex-col items-center overflow-hidden rounded-2xl border p-4 text-center transition hover:-translate-y-0.5 ${b.unlocked ? "border-border bg-surface/60" : "border-dashed border-border/70 bg-surface/30"}`}
            >
              {b.unlocked && <div aria-hidden className="pointer-events-none absolute -top-10 left-1/2 h-24 w-24 -translate-x-1/2 rounded-full blur-2xl" style={{ background: look.from, opacity: 0.28 }} />}
              <Emblem id={b.id} locked={!b.unlocked} size={60} />
              <p className="relative mt-3 text-[15px] font-bold leading-tight">{t(`d.${b.id}`)}</p>
              <p className="relative mt-1 text-xs leading-snug text-muted">{t(`dd.${b.id}`)}</p>
              {b.unlocked ? (
                <p className="relative mt-2 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `color-mix(in srgb, ${look.from} 22%, transparent)`, color: `color-mix(in srgb, ${look.to} 55%, var(--text))` }}>
                  {t("earned", { date: fd(b.on!) })}
                </p>
              ) : (
                <div className="mt-2 w-full">
                  <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--text)]/10">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(3, (b.value / b.target) * 100)}%`, background: `linear-gradient(90deg, ${look.to}, ${look.from})` }} />
                  </div>
                  <p className="num mt-1 text-[11px] text-muted">{b.id === "earthLap" ? `${nf(b.value)} / ${nf(b.target)} NM` : `${nf(b.value)} / ${nf(b.target)}`}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
    </div>
  );
}
