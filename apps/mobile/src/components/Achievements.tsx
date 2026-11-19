import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop, SvgXml } from "react-native-svg";
import Ionicons from "@expo/vector-icons/Ionicons";
import { distanceNm, discoveryBadges, HOUR_LEVELS, hourLevel, hoursLabel, loggingStreak, wingsSvg, type DiscoveryBadge, type DiscoverySeries, type Flight, type OpeningBalance, type Tier } from "@cielo/core";
import { lookupAirport } from "../airports";
import { API_URL } from "../api";
import { shareFile } from "../exporters";
import { formatDate } from "../i18n";
import { Card, Row, Txt } from "./ui";
import { useTheme } from "../theme";
import type { I18nKey } from "../i18n";

const TIER: Record<Tier, [string, string]> = {
  bronze: ["#F0B37E", "#8A4B1F"],
  silver: ["#F1F5F9", "#7B8794"],
  gold: ["#FDE68A", "#B7791F"],
  platinum: ["#CFFAFE", "#3B82B8"],
  diamond: ["#E9D5FF", "#7C3AED"],
  legend: ["#FDA4AF", "#9F1239"],
};

/** Each series' symbol. */
const SERIES_ICON: Record<DiscoverySeries, keyof typeof Ionicons.glyphMap> = {
  night: "moon",
  nightLandings: "moon-outline",
  landings: "airplane-outline",
  airports: "compass",
  countries: "globe",
  distance: "earth",
  longest: "trail-sign",
  types: "airplane",
  signed: "ribbon",
};
const iconFor = (b: Pick<DiscoveryBadge, "id" | "series">): keyof typeof Ionicons.glyphMap => (b.id === "toTheMoon" || b.id === "moonAndBack" ? "rocket" : SERIES_ICON[b.series]);
const starX = (i: number, n: number) => 32 + (i - (n - 1) / 2) * 7.2;

/** A hexagonal emblem in the metal of its rank, one star per rank; a dark silhouette with a lock while still to earn. */
function Emblem({ badge, locked, size = 56 }: { badge: DiscoveryBadge; locked?: boolean; size?: number }) {
  const [from, to] = TIER[badge.tier];
  const n = locked || badge.of < 2 ? 0 : badge.rank;
  const g = `e${badge.id}${locked ? "l" : "u"}`;
  const h = (size * 68) / 64;
  return (
    <View style={{ width: size, height: h }}>
      <Svg width={size} height={h} viewBox="0 0 64 68">
        <Defs>
          <LinearGradient id={g} x1="0" y1="0" x2="0.6" y2="1">
            <Stop offset="0" stopColor={locked ? "#3B4657" : from} />
            <Stop offset="1" stopColor={locked ? "#151C27" : to} />
          </LinearGradient>
          <LinearGradient id={`${g}s`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#fff" stopOpacity={locked ? 0.08 : 0.45} />
            <Stop offset="1" stopColor="#fff" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d="M32 2 L59 17.5 V50.5 L32 66 L5 50.5 V17.5 Z" fill={`url(#${g})`} stroke={locked ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.55)"} strokeWidth={1.5} />
        <Path d="M32 8 L54 20.7 V47.3 L32 60 L10 47.3 V20.7 Z" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1} strokeDasharray={locked ? "2 3" : undefined} />
        <Path d="M5 17.5 L32 2 L59 17.5 V30 C44 24 20 24 5 30 Z" fill={`url(#${g}s)`} />
        {Array.from({ length: n }, (_, i) => (
          <Path key={i} d={`M${starX(i, n)} 47 l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z`} fill="#FFF7D6" scale={0.85} origin={`${starX(i, n)}, 50`} />
        ))}
      </Svg>
      <View style={{ position: "absolute", left: 0, right: 0, top: h * (n ? 0.22 : 0.29), alignItems: "center" }}>
        <Ionicons name={iconFor(badge)} size={size * 0.38} color={locked ? "rgba(255,255,255,0.28)" : "#fff"} />
      </View>
      {locked ? (
        <View style={{ position: "absolute", right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: "#0b1526", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" }}>
          <Ionicons name="lock-closed" size={10} color="rgba(255,255,255,0.7)" />
        </View>
      ) : null}
    </View>
  );
}

/** Pilot wings for an hour level, in its metal; grey while locked. */
function Wings({ hours, tier, locked, width = 120 }: { hours: number; tier: Tier; locked?: boolean; width?: number }) {
  const [from, to] = TIER[tier];
  const xml = useMemo(() => wingsSvg({ from, to, label: hoursLabel(hours), locked, id: `w${hours}${locked ? "l" : ""}` }), [from, to, hours, locked]);
  return <SvgXml xml={xml} width={width} height={(width * 56) / 120} opacity={locked ? 0.55 : 1} />;
}

export function Achievements({ flights, opening, t, locale, pilot }: { flights: Flight[]; opening: OpeningBalance[]; t: (k: I18nKey, v?: Record<string, string | number>) => string; locale: Parameters<typeof formatDate>[1]; pilot?: { fullName?: string; rank?: string } }) {
  const c = useTheme();
  const level = useMemo(() => hourLevel(flights, opening), [flights, opening]);
  const streak = useMemo(() => loggingStreak(flights), [flights]);
  const h = Math.floor(level.totalMin / 60);
  const discoveries = useMemo(() => discoveryBadges(flights, lookupAirport), [flights]);
  // grouped by series: the highest badge held, and the next one to earn
  const series = useMemo(() => {
    const by = new Map<string, DiscoveryBadge[]>();
    for (const b of discoveries) by.set(b.series, [...(by.get(b.series) ?? []), b]);
    return [...by.entries()].map(([key, steps]) => ({ key, steps, held: [...steps].reverse().find((x) => x.unlocked), next: steps.find((x) => !x.unlocked) }));
  }, [discoveries]);
  const fmt = (b: DiscoveryBadge) => `${Math.floor(b.value).toLocaleString()} / ${b.target.toLocaleString()}${b.series === "distance" || b.series === "longest" ? " NM" : ""}`;
  const [openSeries, setOpenSeries] = useState<string | null>(null);
  // the figures printed on a share image (the whole logbook)
  const totals = useMemo(() => {
    const aps = new Set<string>();
    const cts = new Set<string>();
    let nm = 0;
    for (const f of flights) {
      if (f.deletedAt || f.isFstd) continue;
      const a = lookupAirport(f.depIcao);
      const b = lookupAirport(f.arrIcao);
      aps.add(f.depIcao);
      aps.add(f.arrIcao);
      if (a?.country) cts.add(a.country);
      if (b?.country) cts.add(b.country);
      if (a && b && f.depIcao !== f.arrIcao) nm += distanceNm(a, b);
    }
    return { ap: aps.size, ct: cts.size, nm: Math.round(nm) };
  }, [flights]);
  const [sharing, setSharing] = useState<string | null>(null);
  /** Downloads the share image drawn by geardown.app and opens the iOS share sheet with it. */
  const share = async (key: string, what: string) => {
    setSharing(key);
    try {
      const q = new URLSearchParams({ lang: locale === "fr" ? "fr" : "en", name: pilot?.fullName ?? "", rank: pilot?.rank ?? "", hrs: String(h), ap: String(totals.ap), ct: String(totals.ct), nm: String(totals.nm) });
      const r = await fetch(`${API_URL}/api/share-card?${what}&${q}`);
      if (!r.ok) throw new Error(String(r.status));
      await shareFile(`geardown-${key}.png`, new Uint8Array(await r.arrayBuffer()), "image/png", "public.png");
    } catch {
      Alert.alert(t("badges.shareError"));
    } finally {
      setSharing(null);
    }
  };
  const ShareButton = ({ k, what }: { k: string; what: string }) => (
    <Pressable onPress={() => void share(k, what)} disabled={!!sharing} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: c.scheme === "dark" ? "rgba(255,255,255,0.16)" : "rgba(10,22,38,0.16)" }}>
      {sharing === k ? <ActivityIndicator size="small" /> : <Ionicons name="share-outline" size={13} color={c.text} />}
      <Txt variant="small" style={{ fontWeight: "700", fontSize: 12 }} color={c.text}>{t("badges.share")}</Txt>
    </Pressable>
  );
  const track = c.scheme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(10,22,38,0.08)";
  return (
    <>
      <Card>
        <Txt variant="h2">{t("badges.levels")}</Txt>
        <Row gap={14} style={{ alignItems: "center" }}>
          <Wings hours={level.current?.hours ?? 100} tier={level.current?.tier ?? "bronze"} locked={!level.current} width={110} />
          <View style={{ flex: 1, gap: 4 }}>
            {level.current ? <Txt style={{ fontSize: 11, fontWeight: "800", letterSpacing: 1 }} color={TIER[level.current.tier][1]}>{t(`badges.title.${level.current.hours}` as I18nKey).toUpperCase()}</Txt> : null}
            <Txt style={{ fontSize: 17, fontWeight: "800" }}>{level.current ? t("badges.club", { n: level.current.hours.toLocaleString() }) : t("badges.noLevel")}</Txt>
            {level.current ? <View style={{ alignSelf: "flex-start" }}><ShareButton k={`level-${level.current.hours}`} what={`type=level&h=${level.current.hours}`} /></View> : null}
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
        <Pressable onPress={() => setOpenSeries("levels")}>
          <Row gap={4} style={{ flexWrap: "wrap" }}>
            {HOUR_LEVELS.map((l) => (
              <Wings key={l.hours} hours={l.hours} tier={l.tier} locked={h < l.hours} width={52} />
            ))}
          </Row>
          <Txt variant="small" style={{ fontWeight: "700", marginTop: 6 }} color={c.accent}>{t("badges.seeLevels", { n: HOUR_LEVELS.length })} ›</Txt>
        </Pressable>
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
        {series.map(({ key, steps, held, next }) => {
          const shown = held ?? steps[0]!;
          return (
            <Pressable key={key} onPress={() => setOpenSeries(key)} style={{ flexDirection: "row", gap: 12, padding: 12, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderStyle: held ? "solid" : "dashed", borderColor: c.scheme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(10,22,38,0.12)" }}>
              {held ? <View style={{ position: "absolute", left: -30, top: -30, width: 100, height: 100, borderRadius: 50, backgroundColor: TIER[held.tier][0], opacity: 0.16 }} /> : null}
              <Emblem badge={shown} locked={!held} size={54} />
              <View style={{ flex: 1, gap: 3 }}>
                <Txt variant="small" style={{ fontSize: 10.5, fontWeight: "700", letterSpacing: 0.8 }}>{t(`badges.series.${key}` as I18nKey).toUpperCase()}</Txt>
                <Txt style={{ fontWeight: "800", fontSize: 15 }}>{t(`badges.d.${shown.id}` as I18nKey)}</Txt>
                <Txt variant="small" style={{ fontSize: 11.5 }}>{held ? t("badges.earned", { date: formatDate(held.on!, locale) }) : t(`badges.dd.${shown.id}` as I18nKey)}</Txt>
                {steps.length > 1 ? (
                  <Row gap={3}>
                    {steps.map((x) => (
                      <View key={x.id} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: x.unlocked ? TIER[x.tier][1] : track }} />
                    ))}
                  </Row>
                ) : null}
                {next ? (
                  <View style={{ gap: 3, marginTop: 2 }}>
                    {held ? <Txt variant="small" style={{ fontSize: 11.5 }}>{`${t("badges.nextBadge")} ${t(`badges.d.${next.id}` as I18nKey)} · ${t(`badges.dd.${next.id}` as I18nKey)}`}</Txt> : null}
                    <View style={{ height: 4, borderRadius: 2, backgroundColor: track, overflow: "hidden" }}>
                      <View style={{ height: 4, width: `${Math.max(3, (next.value / next.target) * 100)}%`, backgroundColor: TIER[next.tier][1] }} />
                    </View>
                    <Txt mono variant="small" style={{ fontSize: 11 }}>{fmt(next)}</Txt>
                  </View>
                ) : (
                  <Txt variant="small" style={{ fontWeight: "700" }} color={TIER[shown.tier][1]}>{t("badges.seriesDone")}</Txt>
                )}
                <Row gap={8} style={{ flexWrap: "wrap" }}>
                  {held ? <ShareButton k={held.id} what={`type=badge&id=${held.id}&on=${held.on}`} /> : null}
                  {steps.length > 1 ? <Txt variant="small" style={{ fontWeight: "700", marginTop: 8 }} color={c.accent}>{t("badges.seeSeries", { n: steps.length })} ›</Txt> : null}
                </Row>
              </View>
            </Pressable>
          );
        })}
      </Card>
      <Modal visible={!!openSeries} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpenSeries(null)}>
        <View style={{ flex: 1, backgroundColor: c.scheme === "dark" ? "#0A1626" : "#F3F6F9" }}>
          <Row style={{ justifyContent: "space-between", alignItems: "center", padding: 18 }}>
            <Txt variant="h2">{openSeries === "levels" ? t("badges.levels") : openSeries ? t(`badges.series.${openSeries}` as I18nKey) : ""}</Txt>
            <Pressable onPress={() => setOpenSeries(null)} hitSlop={12}>
              <Ionicons name="close-circle" size={28} color={c.muted} />
            </Pressable>
          </Row>
          <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 10, paddingBottom: 60 }}>
            {openSeries === "levels"
              ? HOUR_LEVELS.map((l) => {
                  const got = h >= l.hours;
                  return (
                    <Row key={l.hours} gap={12} style={{ alignItems: "center", padding: 12, borderRadius: 14, borderWidth: 1, borderStyle: got ? "solid" : "dashed", borderColor: c.scheme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(10,22,38,0.12)" }}>
                      <Wings hours={l.hours} tier={l.tier} locked={!got} width={84} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Txt variant="small" style={{ fontSize: 10.5, fontWeight: "800", letterSpacing: 0.8 }} color={TIER[l.tier][1]}>{t(`badges.title.${l.hours}` as I18nKey).toUpperCase()}</Txt>
                        <Txt style={{ fontWeight: "700" }}>{t("badges.club", { n: l.hours.toLocaleString() })}</Txt>
                        <Txt variant="small">{got ? t("badges.reached") : t("badges.hoursLeft", { n: (l.hours - h).toLocaleString() })}</Txt>
                      </View>
                    </Row>
                  );
                })
              : series
                  .find((x) => x.key === openSeries)
                  ?.steps.map((b) => (
                    <Row key={b.id} gap={12} style={{ alignItems: "center", padding: 12, borderRadius: 14, borderWidth: 1, borderStyle: b.unlocked ? "solid" : "dashed", borderColor: c.scheme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(10,22,38,0.12)" }}>
                      <Emblem badge={b} locked={!b.unlocked} size={46} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Txt style={{ fontWeight: "700" }}>{t(`badges.d.${b.id}` as I18nKey)}</Txt>
                        <Txt variant="small">{t(`badges.dd.${b.id}` as I18nKey)}</Txt>
                        {b.unlocked ? (
                          <Txt variant="small" style={{ fontWeight: "700" }} color={TIER[b.tier][1]}>{t("badges.earned", { date: formatDate(b.on!, locale) })}</Txt>
                        ) : (
                          <>
                            <View style={{ height: 4, borderRadius: 2, backgroundColor: track, overflow: "hidden", marginTop: 2 }}>
                              <View style={{ height: 4, width: `${Math.max(3, (b.value / b.target) * 100)}%`, backgroundColor: TIER[b.tier][1] }} />
                            </View>
                            <Txt mono variant="small" style={{ fontSize: 11 }}>{fmt(b)}</Txt>
                          </>
                        )}
                      </View>
                    </Row>
                  ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
