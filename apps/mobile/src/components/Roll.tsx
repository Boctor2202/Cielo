import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, Text, View, type TextStyle } from "react-native";
import { mono, useTheme } from "../theme";

const DIGITS = "0123456789".split("");

function Digit({ d, h, style, delay }: { d: number; h: number; style: TextStyle; delay: number }) {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((still) => {
      if (!alive) return;
      if (still) return y.setValue(-d * h);
      Animated.timing(y, { toValue: -d * h, duration: 1100, delay, easing: Easing.out(Easing.exp), useNativeDriver: true }).start();
    });
    return () => {
      alive = false;
    };
  }, [d, h, delay, y]);
  return (
    <View style={{ height: h, overflow: "hidden" }}>
      <Animated.View style={{ transform: [{ translateY: y }] }}>
        {DIGITS.map((x) => (
          <Text key={x} style={[style, { height: h, lineHeight: h, textAlign: "center" }]}>
            {x}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

/**
 * A figure whose digits roll into place like an odometer when it shows and when it changes. Any formatted text
 * works ("744:02", "1 234"): only the digits roll. Static when the iPhone asks for reduced motion.
 */
export function Roll({ text, size, color, style }: { text: string; size: number; color?: string; style?: TextStyle }) {
  const c = useTheme();
  const h = Math.round(size * 1.2);
  const base: TextStyle = { ...mono, color: color ?? c.text, ...style, fontSize: size };
  const chars = [...text];
  const n = chars.length;
  return (
    <View accessible accessibilityLabel={text} style={{ flexDirection: "row", alignItems: "flex-end", height: h }}>
      {chars.map((ch, i) => {
        const d = DIGITS.indexOf(ch);
        // keyed from the right, so 99 → 100 rolls the right columns
        const key = n - i;
        return d < 0 ? (
          <Text key={`c${key}`} style={[base, { height: h, lineHeight: h }]}>
            {ch}
          </Text>
        ) : (
          <Digit key={`d${key}`} d={d} h={h} style={base} delay={(n - i) * 45} />
        );
      })}
    </View>
  );
}
