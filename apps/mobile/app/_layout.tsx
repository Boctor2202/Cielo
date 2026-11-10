import "../src/polyfills";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider, useApp, useBootError } from "../src/state";
import { useTheme } from "../src/theme";
import { Txt } from "../src/components/ui";

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
  const base = c.scheme === "dark" ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: { ...base.colors, primary: c.accent, background: c.bg, card: c.surface, text: c.text, border: c.border },
  };
  return (
    <ThemeProvider value={theme}>
      <StatusBar style={c.scheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerStyle: { backgroundColor: c.surface }, headerTintColor: c.text, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="flight/[id]" options={{ title: t("flight.new"), presentation: "modal" }} />
        <Stack.Screen name="document/[id]" options={{ title: t("docs.new"), presentation: "modal" }} />
        <Stack.Screen name="auth" options={{ title: t("auth.title"), presentation: "modal" }} />
        <Stack.Screen name="auth-callback" options={{ title: t("auth.title") }} />
        <Stack.Screen name="subscription" options={{ title: t("sub.title"), presentation: "modal" }} />
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
