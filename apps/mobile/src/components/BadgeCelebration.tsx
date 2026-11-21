import React, { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Modal, Pressable, useWindowDimensions, View } from "react-native";
import * as Haptics from "expo-haptics";
import Svg, { Circle, Defs, G, Mask, Polygon, RadialGradient, Stop } from "react-native-svg";
import { TIER_COLORS, type DiscoveryBadge } from "@cielo/core";
import { useApp } from "../state";
import type { I18nKey } from "../i18n";
import { Emblem } from "./Achievements";
import { Txt } from "./ui";

const SHOW_MS = 3500;
const PIECES = 70;

/**
 * Full-screen celebration of the badges just unlocked, one after the other, as on the website: rays in the badge's
 * metal, confetti, the badge popping in, its name and what it rewards, and a vibration. A tap moves to the next
 * one; "Skip all" closes. Reduced motion: no rays or confetti.
 */
export function BadgeCelebration({ badges, onDone }: { badges: DiscoveryBadge[]; onDone: () => void }) {
  const { t } = useApp();
  const { width, height } = useWindowDimensions();
  const [i, setI] = useState(0);
  const [reduce, setReduce] = useState(false);
  const b = badges[i];
  const [c1, c2] = b ? TIER_COLORS[b.tier] : ["#fff", "#fff"];

  const fade = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const text = useRef(new Animated.Value(0)).current;
  const leave = useRef(new Animated.Value(0)).current;
  const fall = useRef(new Animated.Value(0)).current;
  const busy = useRef(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 14_000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [fade, spin]);

  // confetti: random directions, drawn along one shared progress (gravity in the curve)
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, k) => {
        const a = Math.random() * Math.PI * 2;
        const s = 120 + Math.random() * 260;
        return { dx: Math.cos(a) * s, dy: Math.sin(a) * s - 140, w: 6 + Math.random() * 7, rot: (Math.random() - 0.5) * 1440, k };
      }),
    // a new burst for every badge
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [i],
  );

  const next = () => {
    if (busy.current) return;
    busy.current = true;
    Animated.timing(leave, { toValue: 1, duration: 420, useNativeDriver: true }).start(() => {
      busy.current = false;
      if (i + 1 < badges.length) setI(i + 1);
      else onDone();
    });
  };

  // each badge: a vibration, the pop, the texts, the confetti, then the next one
  useEffect(() => {
    if (!b) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    leave.setValue(0);
    pop.setValue(0);
    text.setValue(0);
    fall.setValue(0);
    Animated.parallel([
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }),
      Animated.timing(text, { toValue: 1, duration: 500, delay: 350, useNativeDriver: true }),
      Animated.timing(fall, { toValue: 1, duration: 2600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
    const id = setTimeout(next, SHOW_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  if (!b) return null;
  const R = Math.max(width, height) * 1.1;
  const rays = Array.from({ length: 20 }, (_, k) => {
    const a0 = (k / 20) * Math.PI * 2;
    const a1 = a0 + Math.PI / 30;
    return `${R} ${R} ${R + Math.cos(a0) * R} ${R + Math.sin(a0) * R} ${R + Math.cos(a1) * R} ${R + Math.sin(a1) * R}`;
  });
  const cols = [c1, c2, "#22c55e", "#86efac", "#ffffff", "#60a5fa"];
  const away = { opacity: leave.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) };
  const up = (d: number) => ({
    opacity: Animated.multiply(text.interpolate({ inputRange: [d, Math.min(1, d + 0.5)], outputRange: [0, 1], extrapolate: "clamp" }), away.opacity),
    transform: [{ translateY: text.interpolate({ inputRange: [d, Math.min(1, d + 0.5)], outputRange: [12, 0], extrapolate: "clamp" }) }],
  });

  return (
    <Modal transparent animationType="none" statusBarTranslucent onRequestClose={onDone}>
      <Pressable onPress={next} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={t("badges.unlockedTitle")}>
        <Animated.View style={{ flex: 1, opacity: fade, backgroundColor: "#07101f", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {!reduce ? (
            <Animated.View style={{ position: "absolute", left: width / 2 - R, top: height * 0.42 - R, width: R * 2, height: R * 2, transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }}>
              <Svg width={R * 2} height={R * 2}>
                <Defs>
                  <RadialGradient id="fade" cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor="#fff" stopOpacity="1" />
                    <Stop offset="0.6" stopColor="#fff" stopOpacity="0" />
                  </RadialGradient>
                  <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor={c1} stopOpacity="0.5" />
                    <Stop offset="0.18" stopColor={c1} stopOpacity="0" />
                  </RadialGradient>
                  <Mask id="m">
                    <Circle cx={R} cy={R} r={R} fill="url(#fade)" />
                  </Mask>
                </Defs>
                <Circle cx={R} cy={R} r={R} fill="url(#glow)" />
                <G mask="url(#m)" opacity={0.55}>
                  {rays.map((p, k) => (
                    <Polygon key={k} points={p} fill={c1} />
                  ))}
                </G>
              </Svg>
            </Animated.View>
          ) : null}

          {!reduce
            ? pieces.map((p) => (
                <Animated.View
                  key={`${i}-${p.k}`}
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: width / 2,
                    top: height * 0.42,
                    width: p.w,
                    height: p.w / 2,
                    backgroundColor: cols[p.k % cols.length],
                    opacity: fall.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
                    transform: [
                      { translateX: fall.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
                      // up first, then down: gravity
                      { translateY: fall.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, p.dy * 0.8, p.dy + height * 0.55] }) },
                      { rotate: fall.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${p.rot}deg`] }) },
                    ],
                  }}
                />
              ))
            : null}

          <View style={{ alignItems: "center", paddingHorizontal: 24 }}>
            <Animated.View style={up(0)}>
              <Txt mono color="#86efac" style={{ fontSize: 13, fontWeight: "700", letterSpacing: 3 }}>{t("badges.unlockedTitle").toUpperCase()}</Txt>
            </Animated.View>
            <Animated.View
              style={{
                marginTop: 18,
                marginBottom: 12,
                opacity: away.opacity,
                transform: [
                  { scale: Animated.add(pop.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }), leave.interpolate({ inputRange: [0, 1], outputRange: [0, -0.6] })) },
                  { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ["-25deg", "0deg"] }) },
                  { translateY: leave.interpolate({ inputRange: [0, 1], outputRange: [0, -120] }) },
                ],
              }}
            >
              <Emblem badge={b} size={200} />
            </Animated.View>
            <Animated.View style={up(0.2)}>
              <Txt color="#fff" style={{ fontSize: 30, fontWeight: "800", textAlign: "center" }}>{t(`badges.d.${b.id}` as I18nKey)}</Txt>
            </Animated.View>
            <Animated.View style={up(0.35)}>
              <Txt color="#c8d4e4" style={{ fontSize: 16, marginTop: 6, textAlign: "center" }}>{t(`badges.dd.${b.id}` as I18nKey)}</Txt>
            </Animated.View>
            <Animated.View style={[up(0.5), { marginTop: 14, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: c1 }]}>
              <Txt mono color="#0a1626" style={{ fontSize: 12, fontWeight: "700" }}>
                {t(`badges.tier.${b.tier}` as I18nKey)}{b.of > 1 ? ` · ${b.rank}/${b.of}` : ""}
              </Txt>
            </Animated.View>
          </View>

          {badges.length > 1 ? (
            <View style={{ position: "absolute", bottom: 110, flexDirection: "row", gap: 8 }}>
              {badges.map((x, k) => (
                <View key={x.id} style={{ height: 8, width: k === i ? 22 : 8, borderRadius: 4, backgroundColor: k === i ? "#fff" : "rgba(255,255,255,0.25)" }} />
              ))}
            </View>
          ) : null}
          <View style={{ position: "absolute", bottom: 56, flexDirection: "row", alignItems: "center", gap: 16 }}>
            <Txt color="#8ea0b8" style={{ fontSize: 13 }}>{t("badges.tapNext")}</Txt>
            {badges.length > 1 ? (
              <Pressable onPress={onDone} hitSlop={10} style={{ borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5 }}>
                <Txt color="rgba(255,255,255,0.85)" style={{ fontSize: 13 }}>{t("badges.skipAll")}</Txt>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
