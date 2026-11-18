"use client";

import { Flame } from "lucide-react";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { HOUR_LEVELS, hourLevel, loggingStreak, type Flight, type OpeningBalance, type Tier } from "@cielo/core";
import { Card } from "./ui";

const TIER: Record<Tier, [string, string]> = {
  bronze: ["#E7A46B", "#9A5B2C"],
  silver: ["#E6EBF2", "#8C99AB"],
  gold: ["#F6D77A", "#B8871F"],
  platinum: ["#C7F0FF", "#5B8DB8"],
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

export function Achievements({ flights, opening }: { flights: Flight[]; opening: OpeningBalance[] }) {
  const t = useTranslations("app.badges");
  const level = useMemo(() => hourLevel(flights, opening), [flights, opening]);
  const streak = useMemo(() => loggingStreak(flights), [flights]);
  const h = Math.floor(level.totalMin / 60);

  return (
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
  );
}
