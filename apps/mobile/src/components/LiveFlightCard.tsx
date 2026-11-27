import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { router, useIsFocused } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { formatDuration, liveMinutes, nextStep, type LiveFlight } from "@cielo/core";
import { Txt, tap } from "./ui";
import type { I18nKey } from "../i18n";
import { loadLive } from "../liveFlight";
import { useApp } from "../state";
import { useTheme } from "../theme";

/** "I'm flying now" on the dashboard: starts a flight, or shows the one in progress and its running time. */
export function LiveFlightCard() {
  const { t, store } = useApp();
  const c = useTheme();
  const focused = useIsFocused();
  const [f, setF] = useState<LiveFlight | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    if (focused) void loadLive(store).then(setF);
  }, [focused, store]);
  useEffect(() => {
    if (!f) return;
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [f]);
  const step = f ? nextStep(f) : undefined;
  const running = f && f.out;
  const minutes = f ? (f.off ? liveMinutes(f.off, f.on, new Date()) : liveMinutes(f.out, f.in, new Date())) : 0;
  // round, at the top right of the dashboard: the plane to start, the running time once a flight is on
  return (
    <Pressable
      onPress={() => (tap("medium"), router.push("/live"))}
      accessibilityRole="button"
      accessibilityLabel={running ? t("live.inProgress", { route: [f!.depIcao, f!.arrIcao].filter(Boolean).join(" → ") }) : t("live.start")}
      hitSlop={6}
      style={({ pressed }) => ({ alignItems: "center", gap: 3, transform: [{ scale: pressed ? 0.94 : 1 }] })}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: c.accent,
          borderWidth: running ? 3 : 0,
          borderColor: c.accent + "55",
          shadowColor: c.accent,
          shadowOpacity: 0.45,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        {running ? (
          <Txt mono style={{ fontSize: 14, fontWeight: "800" }} color={c.onAccent}>{formatDuration(minutes)}</Txt>
        ) : (
          <Ionicons name="airplane" size={24} color={c.onAccent} />
        )}
      </View>
      <Txt numberOfLines={1} style={{ fontSize: 10.5, fontWeight: "700", maxWidth: 84, textAlign: "center" }} color={c.accent}>
        {running ? (step ? t(`live.step.${step}` as I18nKey) : t("live.toSave")) : t("live.short")}
      </Txt>
    </Pressable>
  );
}
