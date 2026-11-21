import React from "react";
import { StyleSheet, View, type ColorValue } from "react-native";
import { ThreeGreensO, Wordmark } from "../../src/components/Logo";
import { BlurView } from "expo-blur";
import { Pressable } from "react-native";
import { router } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useApp } from "../../src/state";
import { useAutoSign } from "../../src/signing";
import { SyncBadge } from "../../src/components/SyncBadge";
import { TrialPill } from "../../src/components/TrialPill";
import { BackButton } from "../../src/components/BackButton";
import { font, glass, useTheme } from "../../src/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

export default function TabsLayout() {
  const { t } = useApp();
  // the pilot's own flights, signed the day after when they turned automatic signature on
  useAutoSign();
  const c = useTheme();
  const g = glass(c);
  const icon = (name: IconName) => ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color as string} size={size} />;
  // frosted header and tab bar over the photo backdrop, like the web app's glass panes
  // screens opened from "More" or a dashboard card live in the tab navigator without their own tab:
  // a back chevron returns to where the pilot came from
  const back = () => <BackButton />;
  // Not `href: null`: in this expo-router version a hidden tab is treated like a protected screen and any
  // navigation to it is redirected to the first tab. Hiding only the tab button keeps the screen reachable.
  const sub = (title: string) => ({ headerTitle: title, headerLeft: back, headerRight: mark, tabBarItemStyle: { display: "none" as const }, tabBarButton: () => null });
  // the logo on every page: the wordmark on the main tabs, the lit "O" on the sub-pages (their left is the back button)
  const brand = () => (
    <View style={{ marginLeft: 16 }}>
      <Wordmark size={12} />
    </View>
  );
  const mark = () => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginRight: 16 }}>
      <TrialPill />
      <ThreeGreensO size={22} color={c.text} />
    </View>
  );
  // the account (profile, licences, subscription, data, settings): from the avatar, with the sync state beside it
  const account = () => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginRight: 14 }}>
      <TrialPill />
      <SyncBadge />
      <Pressable accessibilityRole="button" accessibilityLabel={t("tabs.account")} hitSlop={8} onPress={() => router.navigate("/more")}>
        <Ionicons name="person-circle-outline" size={28} color={c.text} />
      </Pressable>
    </View>
  );
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
      {/* Home · Logbook · + · Activity · Career; the account (former "More") opens from the avatar, top right */}
      <Tabs.Screen name="index" options={{ title: t("tabs.home"), headerTitle: t("dash.title"), headerLeft: brand, tabBarIcon: icon("speedometer-outline"), headerRight: account }} />
      <Tabs.Screen name="logbook" options={{ title: t("tabs.logbook"), headerTitle: t("log.title"), headerLeft: brand, tabBarIcon: icon("book-outline"), headerRight: account }} />
      <Tabs.Screen
        name="new"
        options={{
          title: t("flight.new"),
          tabBarButton: () => (
            <Pressable accessibilityRole="button" accessibilityLabel={t("flight.new")} onPress={() => router.push("/flight/new")} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 50, height: 50, borderRadius: 25, marginTop: -16, alignItems: "center", justifyContent: "center", backgroundColor: c.accent, shadowColor: c.accent, shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } }}>
                <Ionicons name="add" size={30} color="#fff" />
              </View>
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen name="activity" options={{ title: t("tabs.activity"), headerTitle: t("tabs.activity"), headerLeft: brand, tabBarIcon: icon("calendar-outline"), headerRight: account }} />
      <Tabs.Screen name="career" options={{ title: t("tabs.career"), headerTitle: t("tabs.career"), headerLeft: brand, tabBarIcon: icon("briefcase-outline"), headerRight: account }} />
      <Tabs.Screen name="layovers" options={sub(t("lay.title"))} />
      <Tabs.Screen name="radar" options={sub(t("radar.title"))} />
      <Tabs.Screen name="more" options={sub(t("tabs.account"))} />
      <Tabs.Screen name="roster" options={sub(t("roster.title"))} />
      <Tabs.Screen name="documents" options={sub(t("docs.title"))} />
      <Tabs.Screen name="ftl" options={sub(t("ftl.title"))} />
      <Tabs.Screen name="timezones" options={sub(t("tz.title"))} />
      <Tabs.Screen name="stats" options={sub(t("stats.title"))} />
      <Tabs.Screen name="reports" options={sub(t("logReport.title"))} />
      <Tabs.Screen name="drafts" options={sub(t("drafts.title"))} />
      <Tabs.Screen name="currency" options={sub(t("cur.title"))} />
      <Tabs.Screen name="goals" options={sub(t("goals.title"))} />
      <Tabs.Screen name="nights" options={sub(t("nights.title"))} />
      <Tabs.Screen name="crew" options={sub(t("crew.title"))} />
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
