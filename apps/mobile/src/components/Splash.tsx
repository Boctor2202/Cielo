import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useTheme } from "../theme";

const NAVY = "#0E1B2E";
// the loading screen and the overlay after it are one opening: the intro plays once, the minimum counts from it
let firstShown: number | null = null;
const GREEN = "#22C55E";

/**
 * The opening screen: the Geardown mark (three green gear lights) lighting up one after the other like a
 * gear-down check, the name, and a thin loading line, until the logbook is ready.
 */
export function Splash() {
  const c = useTheme();
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  const intro = useRef(new Animated.Value(0)).current;
  const line = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (firstShown === null) {
      firstShown = Date.now();
      Animated.timing(intro, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else intro.setValue(1);
    // nose gear, then the two mains: three greens, a pause, again
    const cycle = Animated.loop(
      Animated.sequence([
        Animated.stagger(
          180,
          dots.map((d) => Animated.timing(d, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true })),
        ),
        Animated.delay(420),
        Animated.parallel(dots.map((d) => Animated.timing(d, { toValue: 0.25, duration: 260, useNativeDriver: true }))),
        Animated.delay(120),
      ]),
    );
    cycle.start();
    const bar = Animated.loop(Animated.timing(line, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }));
    bar.start();
    return () => {
      cycle.stop();
      bar.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const S = 112;
  const D = 30;
  const dot = (i: number, left: number, top: number) => (
    <Animated.View
      key={i}
      style={{
        position: "absolute",
        left,
        top,
        width: D,
        height: D,
        borderRadius: D / 2,
        backgroundColor: GREEN,
        shadowColor: GREEN,
        shadowOpacity: 0.8,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 0 },
        opacity: dots[i]!.interpolate({ inputRange: [0, 1], outputRange: [0.18, 1] }),
        transform: [{ scale: dots[i]!.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) }],
      }}
    />
  );

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bg, alignItems: "center", justifyContent: "center" }]}>
      <Animated.View
        style={{
          alignItems: "center",
          gap: 22,
          opacity: intro,
          transform: [{ scale: intro.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
        }}
      >
        <View style={{ width: S, height: S, borderRadius: 28, backgroundColor: NAVY }}>
          {dot(0, (S - D) / 2, 22)}
          {dot(1, 18, 58)}
          {dot(2, S - 18 - D, 58)}
        </View>
        <Animated.Text style={{ color: c.text, fontSize: 20, fontWeight: "600", letterSpacing: 7 }}>GEARDOWN</Animated.Text>
        <View style={{ width: 120, height: 2, borderRadius: 1, backgroundColor: c.scheme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(14,27,46,0.10)", overflow: "hidden" }}>
          <Animated.View
            style={{
              width: 40,
              height: 2,
              borderRadius: 1,
              backgroundColor: GREEN,
              transform: [{ translateX: line.interpolate({ inputRange: [0, 1], outputRange: [-40, 120] }) }],
            }}
          />
        </View>
      </Animated.View>
    </View>
  );
}

/** Keeps the opening screen at least `min` ms, then fades it out over what is behind. */
export function SplashOverlay({ min = 5000 }: { min?: number }) {
  const fade = useRef(new Animated.Value(1)).current;
  const [gone, setGone] = React.useState(false);
  useEffect(() => {
    const left = Math.max(0, min - (firstShown ? Date.now() - firstShown : 0));
    const t = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => setGone(true));
    }, left);
    return () => clearTimeout(t);
  }, [fade, min]);
  if (gone) return null;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: fade, zIndex: 100 }]}>
      <Splash />
    </Animated.View>
  );
}
