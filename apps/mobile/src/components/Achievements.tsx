import React, { useMemo } from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop, Text as SvgText } from "react-native-svg";
import Ionicons from "@expo/vector-icons/Ionicons";
import { HOUR_LEVELS, hourLevel, loggingStreak, type Flight, type OpeningBalance, type Tier } from "@cielo/core";
import { Card, Row, Txt } from "./ui";
import { useTheme } from "../theme";
import type { I18nKey } from "../i18n";

const TIER: Record<Tier, [string, string]> = {
  bronze: ["#E7A46B", "#9A5B2C"],
  silver: ["#E6EBF2", "#8C99AB"],
  gold: ["#F6D77A", "#B8871F"],
  platinum: ["#C7F0FF", "#5B8DB8"],
};

function Medal({ hours, tier, locked, size = 56 }: { hours: number; tier: Tier; locked?: boolean; size?: number }) {
  const [a, b] = locked ? ["#3A4658", "#1E2836"] : TIER[tier];
  const id = `m${hours}${locked ? "l" : "u"}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56" opacity={locked ? 0.45 : 1}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={a} />
          <Stop offset="1" stopColor={b} />
        </LinearGradient>
      </Defs>
      <Circle cx={28} cy={28} r={26} fill={`url(#${id})`} />
      <Circle cx={28} cy={28} r={21} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={1.2} strokeDasharray="2 2.5" />
      <Path d="M28 17c-2 0-3 1.4-3 1.4H13.5c1 1.8 3 2.6 5 2.6h6.3s1.2 1 3.2 1 3.2-1 3.2-1h6.3c2 0 4-.8 5-2.6H31S30 17 28 17z" fill="rgba(10,22,38,0.55)" />
      <SvgText x={28} y={38} textAnchor="middle" fontSize={hours >= 10000 ? 10 : 12} fontWeight="800" fill="rgba(10,22,38,0.8)">
        {hours >= 1000 ? `${hours / 1000}k` : String(hours)}
      </SvgText>
    </Svg>
  );
}

/** Hour levels and the logging streak (computed from the logbook). */
export function Achievements({ flights, opening, t }: { flights: Flight[]; opening: OpeningBalance[]; t: (k: I18nKey, v?: Record<string, string | number>) => string }) {
  const c = useTheme();
  const level = useMemo(() => hourLevel(flights, opening), [flights, opening]);
  const streak = useMemo(() => loggingStreak(flights), [flights]);
  const h = Math.floor(level.totalMin / 60);
  const track = c.scheme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(10,22,38,0.08)";
  return (
    <>
      <Card>
        <Txt variant="h2">{t("badges.levels")}</Txt>
        <Row gap={14} style={{ alignItems: "center" }}>
          <Medal hours={level.current?.hours ?? 100} tier={level.current?.tier ?? "bronze"} locked={!level.current} size={68} />
          <View style={{ flex: 1, gap: 4 }}>
            <Txt style={{ fontSize: 17, fontWeight: "800" }}>{level.current ? t("badges.club", { n: level.current.hours.toLocaleString() }) : t("badges.noLevel")}</Txt>
            {level.next ? (
              <>
                <Txt variant="small">{t("badges.toNext", { left: (level.next.hours - h).toLocaleString(), n: level.next.hours.toLocaleString() })}</Txt>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: track, overflow: "hidden" }}>
                  <View style={{ height: 6, width: `${Math.max(2, level.ratio * 100)}%`, backgroundColor: TIER[level.next.tier][1] }} />
                </View>
              </>
            ) : (
              <Txt variant="small">{t("badges.allLevels")}</Txt>
            )}
          </View>
        </Row>
        <Row gap={6} style={{ flexWrap: "wrap" }}>
          {HOUR_LEVELS.map((l) => (
            <Medal key={l.hours} hours={l.hours} tier={l.tier} locked={h < l.hours} size={34} />
          ))}
        </Row>
      </Card>
      <Card>
        <Txt variant="h2">{t("badges.streak")}</Txt>
        <Row gap={14} style={{ alignItems: "center" }}>
          <View style={{ width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center", backgroundColor: streak.current ? "rgba(251,146,60,0.18)" : track }}>
            <Ionicons name="flame" size={34} color={streak.current ? "#FB923C" : c.muted} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt style={{ fontSize: 17, fontWeight: "800" }}>{streak.current ? t(streak.current === 1 ? "badges.week" : "badges.weeks", { n: streak.current }) : t("badges.noStreak")}</Txt>
            <Txt variant="small">
              {t("badges.best", { n: streak.best })}
              {streak.onTimeRate !== undefined ? ` · ${t("badges.onTime", { p: Math.round(streak.onTimeRate * 100) })}` : ""}
            </Txt>
          </View>
        </Row>
        <Row gap={4}>
          {streak.weeks.map((w) => (
            <View key={w.monday} style={{ flex: 1, height: 20, borderRadius: 5, backgroundColor: w.state === "onTime" ? "#22C55E" : w.state === "late" ? "#EF4444" : track }} />
          ))}
        </Row>
        <Txt variant="small">{t("badges.hint")}</Txt>
      </Card>
    </>
  );
}
