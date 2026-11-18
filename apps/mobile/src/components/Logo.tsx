import React, { useEffect, useRef } from "react";
import { Animated, Easing, Text, View } from "react-native";
import { useTheme } from "../theme";

const GREEN = "#22C55E";

/** The three greens lighting up one after the other, then holding (as on the website's logo), in a loop. */
function useGearLights(): Animated.Value[] {
  const v = [useRef(new Animated.Value(0.22)).current, useRef(new Animated.Value(0.22)).current, useRef(new Animated.Value(0.22)).current];
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.stagger(220, v.map((d) => Animated.timing(d, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }))),
        Animated.delay(1900),
        Animated.parallel(v.map((d) => Animated.timing(d, { toValue: 0.22, duration: 380, useNativeDriver: true }))),
        Animated.delay(250),
      ]),
    );
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return v;
}

/** The O of the wordmark: a ring around the three greens (same 40-unit drawing as the website). */
export function ThreeGreensO({ size, color, lights }: { size: number; color: string; lights?: Animated.Value[] }) {
  const own = useGearLights();
  const l = lights ?? own;
  const u = size / 40;
  const dot = (i: number, cx: number, cy: number) => (
    <Animated.View
      key={i}
      style={{ position: "absolute", left: (cx - 4.6) * u, top: (cy - 4.6) * u, width: 9.2 * u, height: 9.2 * u, borderRadius: 4.6 * u, backgroundColor: GREEN, opacity: l[i] }}
    />
  );
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ position: "absolute", width: size, height: size, borderRadius: size / 2, borderWidth: size * 0.085, borderColor: color }} />
      {dot(0, 20, 13.4)}
      {dot(1, 14, 23.8)}
      {dot(2, 26, 23.8)}
    </View>
  );
}

/** "GEARD◯WN": GEAR bold, DOWN regular, the O drawn as the three greens, lit in a loop. */
export function Wordmark({ size = 15, color }: { size?: number; color?: string }) {
  const c = useTheme();
  const ink = color ?? c.text;
  const ls = size * 0.18;
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }} accessible accessibilityLabel="Geardown">
      <Text style={{ color: ink, fontSize: size, fontWeight: "700", letterSpacing: ls }}>GEAR</Text>
      <Text style={{ color: ink, fontSize: size, fontWeight: "400", letterSpacing: ls }}>D</Text>
      <View style={{ marginRight: ls }}>
        <ThreeGreensO size={size * 1.3} color={ink} />
      </View>
      <Text style={{ color: ink, fontSize: size, fontWeight: "400", letterSpacing: ls }}>WN</Text>
    </View>
  );
}
