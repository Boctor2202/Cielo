import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { requestSync, useSyncStatus } from "../syncStatus";
import { useApp } from "../state";
import { font, glass, useTheme } from "../theme";
import { tap } from "./ui";

/** "3 min" / "2 h": time since the last successful sync, refreshed every 30 s. */
function useAgo(iso?: string): string | null {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!iso) return null;
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (min < 1) return "0";
  return min < 60 ? `${min} min` : `${Math.round(min / 60)} h`;
}

/**
 * Sync state in the header: green when the phone and the server agree, amber with the number of changes
 * waiting when offline, red on a server error. A tap syncs now.
 */
export function SyncBadge() {
  const { t, session } = useApp();
  const c = useTheme();
  const s = useSyncStatus();
  const ago = useAgo(s.lastOkAt);
  if (!session) return null;

  const amber = c.scheme === "dark" ? "#FBBF24" : "#B45309";
  const red = c.scheme === "dark" ? "#F87171" : "#B91C1C";
  const waiting = s.pending > 0;
  const color = s.mode === "error" ? red : s.mode === "offline" || (waiting && s.mode !== "syncing") ? amber : c.accent;
  const label =
    s.mode === "syncing"
      ? t("sync.syncing")
      : s.mode === "offline"
        ? waiting
          ? t("sync.offlineWaiting", { n: s.pending })
          : t("sync.offline")
        : s.mode === "error"
          ? t("sync.error")
          : waiting
            ? t("sync.waiting", { n: s.pending })
            : ago === "0"
              ? t("sync.justNow")
              : ago
                ? t("sync.ok", { ago })
                : t("sync.ready");
  const icon = s.mode === "offline" ? "cloud-offline-outline" : s.mode === "error" ? "alert-circle-outline" : waiting ? "cloud-upload-outline" : "cloud-done-outline";

  return (
    <Pressable
      onPress={() => (tap(), requestSync())}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ marginRight: 12, opacity: pressed ? 0.6 : 1 })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: glass(c).input }}>
        {s.mode === "syncing" ? <ActivityIndicator size="small" color={c.muted} style={{ transform: [{ scale: 0.7 }] }} /> : <Ionicons name={icon} size={14} color={color} />}
        <Text style={{ color: s.mode === "idle" && !waiting ? c.muted : color, fontSize: 12, ...font.medium }} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
