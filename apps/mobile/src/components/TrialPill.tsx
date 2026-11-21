import React from "react";
import { Pressable } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useApp } from "../state";
import { useTheme } from "../theme";
import { Txt } from "./ui";

/** Days left of the free trial (or of the local demo), at the top of every screen: a tap opens the plans. */
export function TrialPill() {
  const { t, access } = useApp();
  const c = useTheme();
  if (!(access.trial || access.demo) || !access.daysLeft) return null;
  const n = access.daysLeft;
  const color = n <= 3 ? c.warning : n <= 7 ? c.caution : c.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("access.pillLabel", { n })}
      hitSlop={6}
      onPress={() => router.push(access.trial ? "/subscription" : "/auth")}
      style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: color }}
    >
      <Ionicons name="hourglass-outline" size={12} color={color} />
      <Txt mono style={{ fontSize: 12, fontWeight: "700" }} color={color}>{t(access.trial ? "access.pill" : "access.pillDemo", { n })}</Txt>
    </Pressable>
  );
}
