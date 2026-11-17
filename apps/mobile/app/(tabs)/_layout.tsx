import React from "react";
import { StyleSheet, type ColorValue } from "react-native";
import { BlurView } from "expo-blur";
import { Pressable } from "react-native";
import { router } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useApp } from "../../src/state";
import { SyncBadge } from "../../src/components/SyncBadge";
import { font, glass, useTheme } from "../../src/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

export default function TabsLayout() {
  const { t } = useApp();
  const c = useTheme();
  const g = glass(c);
  const icon = (name: IconName) => ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color as string} size={size} />;
  // frosted header and tab bar over the photo backdrop, like the web app's glass panes
  // screens opened from "More" or a dashboard card live in the tab navigator without their own tab:
  // a back chevron returns to where the pilot came from
  const back = () => (
    <Pressable onPress={() => (router.canGoBack() ? router.back() : router.navigate("/more"))} hitSlop={12} style={{ paddingHorizontal: 12 }}>
      <Ionicons name="chevron-back" size={26} color={c.accent} />
    </Pressable>
  );
  // Not `href: null`: in this expo-router version a hidden tab is treated like a protected screen and any
  // navigation to it is redirected to the first tab. Hiding only the tab button keeps the screen reachable.
  const sub = (title: string) => ({ headerTitle: title, headerLeft: back, tabBarItemStyle: { display: "none" as const }, tabBarButton: () => null });
  const bar = () => <BlurView tint={g.tint} intensity={g.intensity + 20} style={[StyleSheet.absoluteFill, { backgroundColor: g.pane }]} />;
  return (
    <Tabs
      backBehavior="history"
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
      <Tabs.Screen name="index" options={{ title: t("tabs.dashboard"), headerTitle: t("dash.title"), tabBarIcon: icon("speedometer-outline"), headerRight: () => <SyncBadge /> }} />
      <Tabs.Screen name="logbook" options={{ title: t("tabs.logbook"), headerTitle: t("log.title"), tabBarIcon: icon("book-outline"), headerRight: () => <SyncBadge /> }} />
      <Tabs.Screen name="layovers" options={{ title: t("tabs.layovers"), headerTitle: t("lay.title"), tabBarIcon: icon("bed-outline") }} />
      <Tabs.Screen name="radar" options={{ title: t("tabs.radar"), headerTitle: t("radar.title"), tabBarIcon: icon("radio-outline") }} />
      <Tabs.Screen name="more" options={{ title: t("tabs.more"), headerTitle: t("more.title"), tabBarIcon: icon("ellipsis-horizontal-circle-outline") }} />
      <Tabs.Screen name="roster" options={sub(t("roster.title"))} />
      <Tabs.Screen name="documents" options={sub(t("docs.title"))} />
      <Tabs.Screen name="ftl" options={sub(t("ftl.title"))} />
      <Tabs.Screen name="stats" options={sub(t("stats.title"))} />
      <Tabs.Screen name="reports" options={sub(t("logReport.title"))} />
      <Tabs.Screen name="drafts" options={sub(t("drafts.title"))} />
      <Tabs.Screen name="reminders" options={sub(t("rem.title"))} />
      <Tabs.Screen name="profile" options={sub(t("profile.title"))} />
      <Tabs.Screen name="audit" options={sub(t("audit.title"))} />
      <Tabs.Screen name="map" options={sub(t("map.title"))} />
      <Tabs.Screen name="aircraft" options={sub(t("acft.title"))} />
      <Tabs.Screen name="opening" options={sub(t("open.title"))} />
      <Tabs.Screen name="jobs" options={sub(t("jobs.title"))} />
      <Tabs.Screen name="cv" options={sub(t("cv.title"))} />
    </Tabs>
  );
}
