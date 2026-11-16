import "../src/polyfills";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router } from "expo-router";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider, useApp, useBootError } from "../src/state";
import { useTheme } from "../src/theme";
import { Backdrop, Txt } from "../src/components/ui";
import { glass } from "../src/theme";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Boot() {
  const c = useTheme();
  const error = useBootError();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg, padding: 24 }}>
      {error ? <Txt color={c.warning}>{error.message}</Txt> : <ActivityIndicator color={c.accent} />}
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
      const id = (r?.notification.request.content.data as { licenseId?: string } | undefined)?.licenseId;
      if (id) router.push({ pathname: "/document/[id]", params: { id } });
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
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: glass(c).strong },
          headerTintColor: c.text,
          headerTitleStyle: { fontWeight: "600" },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: "transparent" },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="flight/[id]" options={{ contentStyle: { backgroundColor: c.bg }, title: t("flight.new"), presentation: "modal" }} />
        <Stack.Screen name="document/[id]" options={{ contentStyle: { backgroundColor: c.bg }, title: t("docs.new"), presentation: "modal" }} />
        <Stack.Screen name="aircraft/[id]" options={{ contentStyle: { backgroundColor: c.bg }, title: t("acft.add"), presentation: "modal" }} />
        <Stack.Screen name="layover/[id]" options={{ contentStyle: { backgroundColor: c.bg }, title: t("lay.title") }} />
        <Stack.Screen name="auth" options={{ contentStyle: { backgroundColor: c.bg }, title: t("auth.title"), presentation: "modal" }} />
        <Stack.Screen name="auth-callback" options={{ title: t("auth.title") }} />
        <Stack.Screen name="subscription" options={{ contentStyle: { backgroundColor: c.bg }, title: t("sub.title"), presentation: "modal" }} />
      </Stack>
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
