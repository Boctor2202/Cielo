import "../src/polyfills";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router } from "expo-router";
import { GainsSheet } from "../src/components/GainsSheet";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider, useApp, useBootError } from "../src/state";
import { applyThemePref, loadThemePref } from "../src/appearance";
import { useTheme } from "../src/theme";
import { WidgetSync } from "../src/widgets/sync";
import { CrewInboxWatcher } from "../src/crewWatcher";
import { Backdrop, KeyboardDoneBar, Txt } from "../src/components/ui";
import { glass } from "../src/theme";
import { Splash, SplashOverlay } from "../src/components/Splash";
import { ThreeGreensO } from "../src/components/Logo";
import { applyUpdateAtLaunch } from "../src/updates";
import { LogReminderSync } from "../src/logReminders";

SplashScreen.preventAutoHideAsync().catch(() => undefined);
// a newer update is fetched during the opening screen and applied at once
void applyUpdateAtLaunch();
// dark by default; applied before the first render so the app never flashes light
applyThemePref(loadThemePref());

function Boot() {
  const c = useTheme();
  const error = useBootError();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg, padding: 24 }}>
      {error ? <Txt color={c.warning}>{error.message}</Txt> : <Splash />}
    </View>
  );
}

function Navigator() {
  const { t } = useApp();
  const c = useTheme();
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);
  // a tap on an expiry reminder opens the document it is about (also when it launched the app)
  useEffect(() => {
    const open = (r: Notifications.NotificationResponse | null) => {
      const data = r?.notification.request.content.data as { licenseId?: string; route?: string; rosterEventId?: string } | undefined;
      if (data?.licenseId) router.push({ pathname: "/document/[id]", params: { id: data.licenseId } });
      // "flight over, log it?": the form filled from the roster
      else if (data?.rosterEventId) router.push({ pathname: "/flight/[id]", params: { id: "new", rosterEventId: data.rosterEventId } });
      else if (data?.route === "/crew") router.navigate("/crew");
    };
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => undefined);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
  const base = c.scheme === "dark" ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    // transparent: the photo backdrop shows through every screen, as on the web app
    colors: { ...base.colors, primary: c.accent, background: "transparent", card: glass(c).strong, text: c.text, border: "transparent" },
  };
  return (
    <ThemeProvider value={theme}>
      <StatusBar style={c.scheme === "dark" ? "light" : "dark"} />
      <Backdrop />
      <WidgetSync />
      <CrewInboxWatcher />
      <LogReminderSync />
      <KeyboardDoneBar label={t("common.ok")} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: glass(c).strong },
          headerTintColor: c.text,
          headerTitleStyle: { fontWeight: "600" },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: "transparent" },
          // the lit "O" of the logo on every page opened over the tabs (a screen's own button replaces it)
          headerRight: () => <ThreeGreensO size={22} color={c.text} />,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="flight/[id]" options={{ contentStyle: { backgroundColor: c.bg }, title: t("flight.new"), presentation: "modal" }} />
        <Stack.Screen name="document/[id]" options={{ contentStyle: { backgroundColor: c.bg }, title: t("docs.new"), presentation: "modal" }} />
        <Stack.Screen name="roster/[id]" options={{ contentStyle: { backgroundColor: c.bg }, title: t("roster.addEvent"), presentation: "modal" }} />
        <Stack.Screen name="aircraft/[id]" options={{ contentStyle: { backgroundColor: c.bg }, title: t("acft.add"), presentation: "modal" }} />
        <Stack.Screen name="layover/[id]" options={{ contentStyle: { backgroundColor: c.bg }, title: t("lay.title") }} />
        <Stack.Screen name="auth" options={{ contentStyle: { backgroundColor: c.bg }, title: t("auth.title"), presentation: "modal" }} />
        <Stack.Screen name="auth-callback" options={{ title: t("auth.title") }} />
        <Stack.Screen name="import" options={{ contentStyle: { backgroundColor: c.bg }, title: t("uimp.title"), presentation: "modal" }} />
        <Stack.Screen name="letter" options={{ contentStyle: { backgroundColor: c.bg }, title: t("letter.title"), presentation: "modal" }} />
        <Stack.Screen name="subscription" options={{ contentStyle: { backgroundColor: c.bg }, title: t("sub.title"), presentation: "modal" }} />
      </Stack>
      {/* what each new flight or import brought to the logbook */}
      <GainsSheet />
      {/* the opening screen stays 5 s, then fades onto the overview */}
      <SplashOverlay />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider fallback={<Boot />}>
        <Navigator />
      </AppProvider>
    </SafeAreaProvider>
  );
}
