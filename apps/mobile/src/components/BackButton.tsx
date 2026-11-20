import React, { useRef } from "react";
import { Animated, Pressable } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useTheme } from "../theme";

/**
 * The back button of every page: a round button with the green chevron, nothing written (iOS draws its glass
 * around it), and a small press-in. Goes back where the pilot came from, else to `fallback`.
 */
export function BackButton({ fallback = "/more" }: { fallback?: string }) {
  const c = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 8 }).start();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={10}
      onPressIn={() => to(0.86)}
      onPressOut={() => to(1)}
      onPress={() => (router.canGoBack() ? router.back() : router.navigate(fallback as never))}
      style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
    >
      <Animated.View style={{ transform: [{ scale }], marginLeft: -2 }}>
        <Ionicons name="chevron-back" size={24} color={c.accent} />
      </Animated.View>
    </Pressable>
  );
}
