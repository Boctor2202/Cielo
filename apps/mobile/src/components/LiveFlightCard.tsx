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
  return (
    <Pressable
      onPress={() => (tap("medium"), router.push("/live"))}
      accessibilityRole="button"
      style={({ pressed }) => ({ borderRadius: 20, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.accent, opacity: pressed ? 0.9 : 1 })}
    >
      <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.12)" }}>
        <Ionicons name="airplane" size={20} color={c.onAccent} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Txt style={{ fontSize: 17, fontWeight: "800" }} color={c.onAccent}>{running ? t("live.inProgress", { route: [f!.depIcao, f!.arrIcao].filter(Boolean).join(" → ") }) : t("live.start")}</Txt>
        <Txt style={{ fontSize: 13 }} color={c.onAccent}>
          {running ? `${formatDuration(minutes)} · ${step ? t("live.nextIs", { step: t(`live.step.${step}` as I18nKey) }) : t("live.toSave")}` : t("live.startHint")}
        </Txt>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.onAccent} />
    </Pressable>
  );
}
