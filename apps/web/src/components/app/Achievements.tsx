"use client";

import { Earth, Flame, Globe2, MapPin, Moon, MoonStar, PenLine, Plane, type LucideIcon } from "lucide-react";
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

const DISCOVERY: Record<DiscoveryId, { icon: LucideIcon; tone: string }> = {
  firstNight: { icon: Moon, tone: "#818CF8" },
  nightLandings100: { icon: MoonStar, tone: "#6366F1" },
  airports10: { icon: MapPin, tone: "#38BDF8" },
  airports50: { icon: MapPin, tone: "#0EA5E9" },
  airports100: { icon: MapPin, tone: "#0284C7" },
  countries5: { icon: Globe2, tone: "#F59E0B" },
  countries10: { icon: Globe2, tone: "#F97316" },
  countries25: { icon: Globe2, tone: "#EF4444" },
  earthLap: { icon: Earth, tone: "#22C55E" },
  types3: { icon: Plane, tone: "#2DD4BF" },
  firstSigned: { icon: PenLine, tone: "#E879F9" },
};

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
            <div key={l.hours} className="flex flex-col items-center gap-1" title={t("club", { n: l.hours.toLocaleString() })}>
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
            <div key={b.id} className={`rounded-2xl border p-3.5 transition ${b.unlocked ? "border-border bg-surface/60" : "border-dashed border-border/70 opacity-70"}`}>
              <span
                className="grid h-11 w-11 place-items-center rounded-full"
                style={b.unlocked ? { background: `radial-gradient(circle at 35% 30%, ${look.tone}, color-mix(in srgb, ${look.tone} 55%, #000))`, color: "#fff", boxShadow: `0 6px 18px -6px ${look.tone}` } : { background: "color-mix(in srgb, var(--text) 8%, transparent)", color: "var(--muted)" }}
              >
                <look.icon size={20} />
              </span>
              <p className="mt-2.5 text-sm font-semibold leading-tight">{t(`d.${b.id}`)}</p>
              {b.unlocked ? (
                <p className="mt-1 text-xs text-muted">{t("earned", { date: fd(b.on!) })}</p>
              ) : (
                <>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color:var(--text)]/10">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(3, (b.value / b.target) * 100)}%`, background: look.tone }} />
                  </div>
                  <p className="num mt-1 text-xs text-muted">{b.id === "earthLap" ? `${nf(b.value)} / ${nf(b.target)} NM` : `${nf(b.value)} / ${nf(b.target)}`}</p>
                </>
              )}
            </div>
          );
        })}
      </div>
    </Card>
    </div>
  );
}
