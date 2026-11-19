import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { formatDuration, logbookGains, type LogbookGains } from "@cielo/core";
import { lookupAirport } from "../airports";
import { onGains } from "../gains";
import { useApp } from "../state";
import { useTheme } from "../theme";
import { Emblem, TIER, Wings } from "./Achievements";
import { Track } from "./Bars";
import { Row, Txt } from "./ui";
import type { I18nKey } from "../i18n";

const INK = "rgba(6,18,38,0.97)";

/** After a flight is saved or a file imported: what it brought to the logbook, and the badges it unlocked. */
export function GainsSheet() {
  const { t, store, pilot } = useApp();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [g, setG] = useState<LogbookGains | null>(null);
  const y = useRef(new Animated.Value(0)).current;

  useEffect(
    () =>
      onGains(async (ids) => {
        const [flights, opening] = await Promise.all([store.all("flights"), store.all("opening_balances")]);
        const gains = logbookGains(flights, ids, lookupAirport, opening);
        if (gains.flights) setG(gains);
      }),
    [store],
  );

  useEffect(() => {
    if (!g) return;
    y.setValue(0);
    Animated.spring(y, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
    const id = setTimeout(() => setG(null), g.badges.length || g.level ? 14_000 : 9_000);
    return () => clearTimeout(id);
  }, [g, y]);

  if (!g) return null;
  const dur = (m: number) => formatDuration(m, pilot?.timeDisplay);
  const chips = [
    { icon: "time-outline", text: `+${dur(g.minutes)}`, sub: t("gains.hours") },
    g.nm > 0 && { icon: "navigate-outline", text: `+${g.nm.toLocaleString()}`, sub: "NM" },
    g.newAirports.length > 0 && { icon: "location-outline", text: `+${g.newAirports.length}`, sub: t("gains.airports"), detail: g.newAirports.slice(0, 3).join(" · ") },
    g.newCountries.length > 0 && { icon: "globe-outline", text: `+${g.newCountries.length}`, sub: t("gains.countries"), detail: g.newCountries.slice(0, 3).join(" · ") },
    g.newTypes.length > 0 && { icon: "airplane-outline", text: `+${g.newTypes.length}`, sub: t("gains.types"), detail: g.newTypes.slice(0, 3).join(" · ") },
    g.nightMinutes > 0 && { icon: "moon-outline", text: `+${dur(g.nightMinutes)}`, sub: t("gains.night") },
  ].filter(Boolean) as { icon: keyof typeof Ionicons.glyphMap; text: string; sub: string; detail?: string }[];

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 12,
        right: 12,
        bottom: insets.bottom + 70,
        opacity: y,
        transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
      }}
    >
      <View style={{ borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", backgroundColor: INK, padding: 14, gap: 10, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } }}>
        <View style={{ position: "absolute", top: -80, alignSelf: "center", width: 260, height: 160, borderRadius: 130, backgroundColor: c.accent, opacity: 0.18 }} />
        <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
          <Row style={{ alignItems: "center", gap: 6 }}>
            <Ionicons name="sparkles" size={16} color={c.accent} />
            <Txt color="#fff" style={{ fontWeight: "700" }}>{g.flights === 1 ? t("gains.titleOne") : t("gains.titleMany", { n: g.flights })}</Txt>
          </Row>
          <Pressable onPress={() => setG(null)} hitSlop={10}>
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.6)" />
          </Pressable>
        </Row>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {chips.map((x) => (
            <View key={x.sub} style={{ width: "31%", flexGrow: 1, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.05)", padding: 8 }}>
              <Ionicons name={x.icon} size={14} color={c.accent} />
              <Txt mono color="#fff" style={{ fontSize: 18, fontWeight: "700", marginTop: 2 }}>{x.text}</Txt>
              <Txt variant="small" color="rgba(255,255,255,0.6)" numberOfLines={1}>{x.sub}</Txt>
              {x.detail ? <Txt mono variant="small" color="rgba(255,255,255,0.45)" numberOfLines={1} style={{ fontSize: 10 }}>{x.detail}</Txt> : null}
            </View>
          ))}
        </View>
        {g.level ? (
          <Row style={{ alignItems: "center", gap: 10, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.05)", padding: 8 }}>
            <Wings hours={g.level.hours} tier={g.level.tier} width={80} />
            <View style={{ flex: 1 }}>
              <Txt variant="small" color={TIER[g.level.tier][0]} style={{ fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>{t("gains.newWings")}</Txt>
              <Txt color="#fff" style={{ fontWeight: "700" }}>{t(`badges.title.${g.level.hours}` as I18nKey)}</Txt>
            </View>
          </Row>
        ) : null}
        {g.badges.length ? (
          <View style={{ gap: 8, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.05)", padding: 8 }}>
            <Txt variant="small" color={c.accent} style={{ fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>{t("gains.unlocked", { n: g.badges.length })}</Txt>
            {g.badges.slice(0, 3).map((b) => (
              <Row key={b.id} style={{ alignItems: "center", gap: 10 }}>
                <Emblem badge={b} size={40} />
                <View style={{ flex: 1 }}>
                  <Txt color="#fff" style={{ fontWeight: "700" }} numberOfLines={1}>{t(`badges.d.${b.id}` as I18nKey)}</Txt>
                  <Txt variant="small" color="rgba(255,255,255,0.6)" numberOfLines={1}>{t(`badges.dd.${b.id}` as I18nKey)}</Txt>
                </View>
              </Row>
            ))}
          </View>
        ) : null}
        {g.next ? (
          <View style={{ gap: 6 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <Txt variant="small" color="rgba(255,255,255,0.7)" numberOfLines={1} style={{ flex: 1 }}>
                {t("gains.next")} <Txt variant="small" color="#fff" style={{ fontWeight: "700" }}>{t(`badges.d.${g.next.id}` as I18nKey)}</Txt>
              </Txt>
              <Txt mono variant="small" color="rgba(255,255,255,0.5)">{Math.floor(g.next.value).toLocaleString()} / {g.next.target.toLocaleString()}</Txt>
            </Row>
            <Track ratio={g.next.value / g.next.target} height={7} />
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}
