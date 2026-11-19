import React, { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Row, Txt } from "./ui";
import { useTheme } from "../theme";

/**
 * A progress bar with some light: the fill is a gradient of its colour with a soft glow, a sheen on its upper
 * half and a bright tip, and it grows in when it appears.
 */
export function Track({ ratio, color, height = 10 }: { ratio: number; color?: string; height?: number }) {
  const c = useTheme();
  const tone = color ?? c.accent;
  const pct = Math.max(0, Math.min(1, ratio || 0));
  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(grow, { toValue: pct, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [pct, grow]);
  const id = useRef(`tg${Math.random().toString(36).slice(2, 8)}`).current;
  const r = height / 2;
  return (
    <View style={{ height, borderRadius: r, backgroundColor: c.scheme === "dark" ? "rgba(255,255,255,0.09)" : "rgba(10,22,38,0.08)", overflow: "visible" }}>
      <Animated.View
        style={{
          height,
          borderRadius: r,
          width: grow.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
          minWidth: pct > 0 ? height : 0,
          shadowColor: tone,
          shadowOpacity: 0.55,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 0 },
          overflow: "hidden",
        }}
      >
        <Svg width="100%" height={height} style={{ position: "absolute" }}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={tone} stopOpacity={0.55} />
              <Stop offset="0.7" stopColor={tone} stopOpacity={1} />
              <Stop offset="1" stopColor={tone} stopOpacity={1} />
            </LinearGradient>
            <LinearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#fff" stopOpacity={0.38} />
              <Stop offset="0.55" stopColor="#fff" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height={height} rx={r} fill={`url(#${id})`} />
          <Rect x="0" y="0" width="100%" height={height} rx={r} fill={`url(#${id}s)`} />
        </Svg>
        {/* the bright tip */}
        <View style={{ position: "absolute", right: 2, top: height / 2 - Math.max(2, height * 0.3), width: Math.max(4, height * 0.6), height: Math.max(4, height * 0.6), borderRadius: height, backgroundColor: "#fff", opacity: 0.85 }} />
      </Animated.View>
    </View>
  );
}

/** Label, value on the right, bar underneath. */
export function BarRow({ label, value, ratio, sub, color }: { label: string; value: string; ratio: number; sub?: string; color?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Row style={{ justifyContent: "space-between" }}>
        <Txt numberOfLines={1} style={{ flex: 1 }}>{label}</Txt>
        <Txt mono variant="small">{value}</Txt>
      </Row>
      <Track ratio={ratio} color={color} />
      {sub ? <Txt variant="small">{sub}</Txt> : null}
    </View>
  );
}
