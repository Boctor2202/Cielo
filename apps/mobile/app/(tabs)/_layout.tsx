import React from "react";
import { StyleSheet, type ColorValue } from "react-native";
import { BlurView } from "expo-blur";
import { Tabs } from "expo-router/js-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useApp } from "../../src/state";
import { font, glass, useTheme } from "../../src/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

export default function TabsLayout() {
  const { t } = useApp();
  const c = useTheme();
  const g = glass(c);
  const icon = (name: IconName) => ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color as string} size={size} />;
  // frosted header and tab bar over the photo backdrop, like the web app's glass panes
  const bar = () => <BlurView tint={g.tint} intensity={g.intensity + 20} style={[StyleSheet.absoluteFill, { backgroundColor: g.pane }]} />;
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { position: "absolute", backgroundColor: "transparent", borderTopColor: g.edge },
        tabBarBackground: bar,
        tabBarLabelStyle: { ...font.medium, fontSize: 11 },
        headerTransparent: false,
        headerStyle: { backgroundColor: "transparent" },
        headerBackground: bar,
        headerShadowVisible: false,
        headerTitleStyle: { ...font.semibold },
        headerTintColor: c.text,
        sceneStyle: { backgroundColor: "transparent" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tabs.dashboard"), headerTitle: t("dash.title"), tabBarIcon: icon("speedometer-outline") }} />
      <Tabs.Screen name="logbook" options={{ title: t("tabs.logbook"), headerTitle: t("log.title"), tabBarIcon: icon("book-outline") }} />
      <Tabs.Screen name="layovers" options={{ title: t("tabs.layovers"), headerTitle: t("lay.title"), tabBarIcon: icon("bed-outline") }} />
      <Tabs.Screen name="radar" options={{ title: t("tabs.radar"), headerTitle: t("radar.title"), tabBarIcon: icon("radio-outline") }} />
      <Tabs.Screen name="more" options={{ title: t("tabs.more"), headerTitle: t("more.title"), tabBarIcon: icon("ellipsis-horizontal-circle-outline") }} />
      <Tabs.Screen name="roster" options={{ href: null, headerTitle: t("roster.title") }} />
      <Tabs.Screen name="documents" options={{ href: null, headerTitle: t("docs.title") }} />
      <Tabs.Screen name="ftl" options={{ href: null, headerTitle: t("ftl.title") }} />
      <Tabs.Screen name="stats" options={{ href: null, headerTitle: t("stats.title") }} />
      <Tabs.Screen name="reports" options={{ href: null, headerTitle: t("logReport.title") }} />
      <Tabs.Screen name="profile" options={{ href: null, headerTitle: t("profile.title") }} />
      <Tabs.Screen name="audit" options={{ href: null, headerTitle: t("audit.title") }} />
      <Tabs.Screen name="map" options={{ href: null, headerTitle: t("map.title") }} />
      <Tabs.Screen name="aircraft" options={{ href: null, headerTitle: t("acft.title") }} />
      <Tabs.Screen name="opening" options={{ href: null, headerTitle: t("open.title") }} />
      <Tabs.Screen name="jobs" options={{ href: null, headerTitle: t("jobs.title") }} />
      <Tabs.Screen name="cv" options={{ href: null, headerTitle: t("cv.title") }} />
    </Tabs>
  );
}
