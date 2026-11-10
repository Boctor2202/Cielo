import React from "react";
import type { ColorValue } from "react-native";
import { Tabs } from "expo-router/js-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useApp } from "../../src/state";
import { useTheme } from "../../src/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

export default function TabsLayout() {
  const { t } = useApp();
  const c = useTheme();
  const icon = (name: IconName) => ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color as string} size={size} />;
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.text,
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tabs.dashboard"), headerTitle: t("dash.title"), tabBarIcon: icon("speedometer-outline") }} />
      <Tabs.Screen name="logbook" options={{ title: t("tabs.logbook"), headerTitle: t("log.title"), tabBarIcon: icon("book-outline") }} />
      <Tabs.Screen name="roster" options={{ title: t("tabs.roster"), headerTitle: t("roster.title"), tabBarIcon: icon("calendar-outline") }} />
      <Tabs.Screen name="documents" options={{ title: t("tabs.documents"), headerTitle: t("docs.title"), tabBarIcon: icon("id-card-outline") }} />
      <Tabs.Screen name="more" options={{ title: t("tabs.more"), headerTitle: t("more.title"), tabBarIcon: icon("ellipsis-horizontal-circle-outline") }} />
    </Tabs>
  );
}
