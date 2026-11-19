import React, { useMemo } from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { discoveryBadges, hourLevel, rankStripes, TIERS, type DiscoveryBadge, type Flight, type OpeningBalance, type Pilot } from "@cielo/core";
import { lookupAirport } from "../airports";
import { useApp } from "../state";
import { Emblem, TIER, Wings } from "./Achievements";
import { Track } from "./Bars";
import { Epaulette } from "./Epaulette";
import { Row, Txt } from "./ui";
import type { I18nKey } from "../i18n";

const INK = "rgba(2,4,11,0.62)";
const EDGE = "rgba(255,255,255,0.16)";

/** Profile hero: the crew badge over the flight photo, as on the web. */
export function CrewHero({ pilot }: { pilot: Pilot }) {
  const { t } = useApp();
  const initials = (pilot.fullName || "?").split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const stripes = rankStripes(pilot.rank);
  return (
    <View style={{ borderRadius: 22, overflow: "hidden", borderWidth: 1, borderColor: EDGE }}>
      <Image source={require("../../assets/backdrop-wide.jpg")} style={{ position: "absolute", inset: 0 }} contentFit="cover" contentPosition="center" />
      <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(2,4,11,0.35)" }} />
      <View style={{ padding: 16, paddingTop: 70 }}>
        <View style={{ borderRadius: 18, borderWidth: 1, borderColor: EDGE, backgroundColor: INK, padding: 14 }}>
          <Row style={{ alignItems: "center", gap: 14 }}>
            <View style={{ width: 84, height: 84, borderRadius: 18, overflow: "hidden", borderWidth: 2, borderColor: "rgba(34,197,94,0.85)" }}>
              {pilot.photoDataUrl ? (
                <Image source={{ uri: pilot.photoDataUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              ) : (
                <View style={{ flex: 1, backgroundColor: "#0e2a47", alignItems: "center", justifyContent: "center" }}>
                  <Txt style={{ fontSize: 26, fontWeight: "700" }} color="#fff">{initials}</Txt>
                </View>
              )}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="small" color="#86efac" style={{ fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", fontSize: 10 }}>{t("profile.crew")}</Txt>
              <Txt color="#fff" style={{ fontSize: 21, fontWeight: "700" }} numberOfLines={1}>{pilot.fullName || "—"}</Txt>
              {pilot.rank ? <Txt color="rgba(255,255,255,0.8)" numberOfLines={1}>{pilot.rank}</Txt> : null}
              {stripes ? <View style={{ marginTop: 4 }}><Epaulette stripes={stripes} /></View> : null}
            </View>
          </Row>
          <Row style={{ justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" }}>
            <Txt variant="small" color="rgba(255,255,255,0.7)" numberOfLines={1} style={{ flex: 1 }}>{pilot.employer || "—"}</Txt>
            <Txt mono color="#fff" style={{ fontWeight: "700" }}>{pilot.homeBaseIcao || "····"}</Txt>
          </Row>
        </View>
      </View>
    </View>
  );
}

/** The pilot's honours: the wings of their hour level, the way to the next ones, and the best badge of each series. */
export function Honours({ flights, opening }: { flights: Flight[]; opening: OpeningBalance[] }) {
  const { t } = useApp();
  const level = useMemo(() => hourLevel(flights, opening), [flights, opening]);
  const badges = useMemo(() => discoveryBadges(flights, lookupAirport), [flights]);
  const held = useMemo(() => {
    const best = new Map<string, DiscoveryBadge>();
    for (const b of badges) if (b.unlocked) best.set(b.series, b);
    return [...best.values()].sort((a, b) => TIERS.indexOf(b.tier) - TIERS.indexOf(a.tier) || b.rank - a.rank);
  }, [badges]);
  const earned = badges.filter((b) => b.unlocked).length;
  const h = Math.floor(level.totalMin / 60);
  const tier = level.current?.tier ?? "bronze";
  const [from, to] = TIER[tier];
  const shown = held.slice(0, 5);

  return (
    <View style={{ borderRadius: 22, overflow: "hidden", borderWidth: 1, borderColor: EDGE, backgroundColor: "#060b16" }}>
      {/* the metal of the level, as a soft light behind the wings */}
      <View style={{ position: "absolute", top: -90, alignSelf: "center", width: 280, height: 200, borderRadius: 140, backgroundColor: to, opacity: 0.22 }} />
      <View style={{ padding: 16, gap: 4 }}>
        <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
          <Txt variant="small" color="rgba(255,255,255,0.6)" style={{ fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", fontSize: 10 }}>{t("profile.honours")}</Txt>
          <Pressable onPress={() => router.push("/(tabs)/stats")} hitSlop={10}>
            <Row style={{ alignItems: "center", gap: 2 }}>
              <Txt variant="small" color="rgba(255,255,255,0.75)" style={{ fontWeight: "700" }}>{t("profile.allBadges")}</Txt>
              <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.75)" />
            </Row>
          </Pressable>
        </Row>
        <View style={{ alignItems: "center", marginTop: 6 }}>
          {level.current ? <Wings hours={level.current.hours} tier={tier} width={200} /> : <Wings hours={100} tier="bronze" locked width={200} />}
          <Txt style={{ marginTop: 6, fontSize: 11, fontWeight: "700", letterSpacing: 2.2, textTransform: "uppercase" }} color={level.current ? from : "rgba(255,255,255,0.55)"}>
            {level.current ? t(`badges.title.${level.current.hours}` as I18nKey) : t("profile.noWings")}
          </Txt>
          <Txt mono color="#fff" style={{ fontSize: 28, fontWeight: "700" }}>
            {h.toLocaleString()} <Txt color="rgba(255,255,255,0.55)" style={{ fontSize: 16 }}>h</Txt>
          </Txt>
        </View>
        {level.next ? (
          <View style={{ gap: 6, marginTop: 6 }}>
            <Track ratio={Math.max(0.03, level.ratio)} color={from} height={8} />
            <Txt variant="small" color="rgba(255,255,255,0.6)" style={{ textAlign: "center" }}>
              {t("badges.toNext", { left: (level.next.hours - h).toLocaleString(), n: level.next.hours.toLocaleString() })}
            </Txt>
          </View>
        ) : null}
        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", gap: 10 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt color="rgba(255,255,255,0.85)" style={{ fontWeight: "700", fontSize: 13 }}>{t("profile.distinctions")}</Txt>
            <Txt mono variant="small" color="rgba(255,255,255,0.5)">{earned} / {badges.length}</Txt>
          </Row>
          {shown.length ? (
            <Row style={{ flexWrap: "wrap", alignItems: "center" }} gap={8}>
              {shown.map((b) => (
                <Emblem key={b.id} badge={b} size={50} />
              ))}
              {held.length > shown.length ? <Txt color="rgba(255,255,255,0.6)" style={{ fontWeight: "700" }}>+{held.length - shown.length}</Txt> : null}
            </Row>
          ) : (
            <Txt variant="small" color="rgba(255,255,255,0.55)">{t("profile.noDistinction")}</Txt>
          )}
        </View>
      </View>
    </View>
  );
}
