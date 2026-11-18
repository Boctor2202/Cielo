import React, { useMemo } from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop, Text as SvgText } from "react-native-svg";
import Ionicons from "@expo/vector-icons/Ionicons";
import { discoveryBadges, HOUR_LEVELS, hourLevel, loggingStreak, type DiscoveryId, type Flight, type OpeningBalance, type Tier } from "@cielo/core";
import { lookupAirport } from "../airports";
import { formatDate } from "../i18n";
import { Card, Row, Txt } from "./ui";
import { useTheme } from "../theme";
import type { I18nKey } from "../i18n";

const TIER: Record<Tier, [string, string]> = {
  bronze: ["#E7A46B", "#9A5B2C"],
  silver: ["#E6EBF2", "#8C99AB"],
  gold: ["#F6D77A", "#B8871F"],
  platinum: ["#C7F0FF", "#5B8DB8"],
};

const DISCOVERY: Record<DiscoveryId, { icon: keyof typeof Ionicons.glyphMap; from: string; to: string; stars?: number }> = {
  firstNight: { icon: "moon", from: "#A5B4FC", to: "#3730A3" },
  nightLandings100: { icon: "moon-outline", from: "#C4B5FD", to: "#4C1D95" },
  airports10: { icon: "compass", from: "#7DD3FC", to: "#0369A1", stars: 1 },
  airports50: { icon: "compass", from: "#67E8F9", to: "#0E7490", stars: 2 },
  airports100: { icon: "map", from: "#5EEAD4", to: "#115E59", stars: 3 },
  countries5: { icon: "flag", from: "#FCD34D", to: "#B45309", stars: 1 },
  countries10: { icon: "globe", from: "#FDBA74", to: "#C2410C", stars: 2 },
  countries25: { icon: "globe", from: "#FCA5A5", to: "#B91C1C", stars: 3 },
  earthLap: { icon: "earth", from: "#86EFAC", to: "#15803D" },
  types3: { icon: "airplane", from: "#F9A8D4", to: "#9D174D" },
  firstSigned: { icon: "ribbon", from: "#F0ABFC", to: "#86198F" },
};

/** A hexagonal emblem: glossy when earned, a dark silhouette with a lock while it is still to earn. */
function Emblem({ id, locked, size = 56 }: { id: DiscoveryId; locked?: boolean; size?: number }) {
  const look = DISCOVERY[id];
  const g = `e${id}${locked ? "l" : "u"}`;
  const h = (size * 68) / 64;
  return (
    <View style={{ width: size, height: h }}>
      <Svg width={size} height={h} viewBox="0 0 64 68">
        <Defs>
          <LinearGradient id={g} x1="0" y1="0" x2="0.6" y2="1">
            <Stop offset="0" stopColor={locked ? "#3B4657" : look.from} />
            <Stop offset="1" stopColor={locked ? "#151C27" : look.to} />
          </LinearGradient>
          <LinearGradient id={`${g}s`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#fff" stopOpacity={locked ? 0.08 : 0.45} />
            <Stop offset="1" stopColor="#fff" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d="M32 2 L59 17.5 V50.5 L32 66 L5 50.5 V17.5 Z" fill={`url(#${g})`} stroke={locked ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.55)"} strokeWidth={1.5} />
        <Path d="M32 8 L54 20.7 V47.3 L32 60 L10 47.3 V20.7 Z" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1} strokeDasharray={locked ? "2 3" : undefined} />
        <Path d="M5 17.5 L32 2 L59 17.5 V30 C44 24 20 24 5 30 Z" fill={`url(#${g}s)`} />
        {look.stars && !locked
          ? Array.from({ length: look.stars }, (_, i) => {
              const cx = 32 + (i - (look.stars! - 1) / 2) * 8;
              return <Path key={i} d={`M${cx} 47 l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z`} fill="#FFF7D6" />;
            })
          : null}
      </Svg>
      <View style={{ position: "absolute", left: 0, right: 0, top: h * (look.stars && !locked ? 0.22 : 0.29), alignItems: "center" }}>
        <Ionicons name={look.icon} size={size * 0.38} color={locked ? "rgba(255,255,255,0.28)" : "#fff"} />
      </View>
      {locked ? (
        <View style={{ position: "absolute", right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: "#0b1526", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" }}>
          <Ionicons name="lock-closed" size={10} color="rgba(255,255,255,0.7)" />
        </View>
      ) : null}
    </View>
  );
}

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
export function Achievements({ flights, opening, t, locale }: { flights: Flight[]; opening: OpeningBalance[]; t: (k: I18nKey, v?: Record<string, string | number>) => string; locale: Parameters<typeof formatDate>[1] }) {
  const c = useTheme();
  const level = useMemo(() => hourLevel(flights, opening), [flights, opening]);
  const streak = useMemo(() => loggingStreak(flights), [flights]);
  const h = Math.floor(level.totalMin / 60);
  const discoveries = useMemo(() => discoveryBadges(flights, lookupAirport), [flights]);
  const track = c.scheme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(10,22,38,0.08)";
  return (
    <>
      <Card>
        <Txt variant="h2">{t("badges.levels")}</Txt>
        <Row gap={14} style={{ alignItems: "center" }}>
          <Medal hours={level.current?.hours ?? 100} tier={level.current?.tier ?? "bronze"} locked={!level.current} size={68} />
          <View style={{ flex: 1, gap: 4 }}>
            {level.current ? <Txt style={{ fontSize: 11, fontWeight: "800", letterSpacing: 1 }} color={TIER[level.current.tier][1]}>{t(`badges.title.${level.current.hours}` as I18nKey).toUpperCase()}</Txt> : null}
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
      <Card>
        <Txt variant="h2">{`${t("badges.discoveries")} · ${discoveries.filter((b) => b.unlocked).length}/${discoveries.length}`}</Txt>
        <Row gap={8} style={{ flexWrap: "wrap" }}>
          {discoveries.map((b) => {
            const look = DISCOVERY[b.id];
            return (
              <View key={b.id} style={{ flexBasis: "47%", flexGrow: 1, padding: 12, gap: 4, alignItems: "center", borderRadius: 16, overflow: "hidden", borderWidth: 1, borderStyle: b.unlocked ? "solid" : "dashed", borderColor: c.scheme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(10,22,38,0.12)" }}>
                {b.unlocked ? <View style={{ position: "absolute", top: -40, width: 90, height: 90, borderRadius: 45, backgroundColor: look.from, opacity: 0.18 }} /> : null}
                <Emblem id={b.id} locked={!b.unlocked} size={52} />
                <Txt style={{ fontWeight: "800", fontSize: 14, textAlign: "center", marginTop: 4 }}>{t(`badges.d.${b.id}` as I18nKey)}</Txt>
                <Txt variant="small" style={{ fontSize: 11.5, textAlign: "center" }}>{t(`badges.dd.${b.id}` as I18nKey)}</Txt>
                {b.unlocked ? (
                  <View style={{ marginTop: 2, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: look.from + "33" }}>
                    <Txt variant="small" style={{ fontSize: 11, fontWeight: "700" }} color={c.scheme === "dark" ? look.from : look.to}>{t("badges.earned", { date: formatDate(b.on!, locale) })}</Txt>
                  </View>
                ) : (
                  <View style={{ alignSelf: "stretch", gap: 3, marginTop: 2 }}>
                    <View style={{ height: 4, borderRadius: 2, backgroundColor: track, overflow: "hidden" }}>
                      <View style={{ height: 4, width: `${Math.max(3, (b.value / b.target) * 100)}%`, backgroundColor: look.to }} />
                    </View>
                    <Txt mono variant="small" style={{ fontSize: 11, textAlign: "center" }}>{`${Math.floor(b.value).toLocaleString()} / ${b.target.toLocaleString()}${b.id === "earthLap" ? " NM" : ""}`}</Txt>
                  </View>
                )}
              </View>
            );
          })}
        </Row>
      </Card>
    </>
  );
}
