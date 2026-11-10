import React, { useEffect, useState } from "react";
import { Alert, Platform } from "react-native";
import { router } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import { Button, Card, Field, Screen, Txt } from "../src/components/ui";
import { isAppleSignInAvailable, isCloudEnabled, signInWithApple, signInWithGoogle, signInWithMagicLink } from "../src/auth";
import { useApp } from "../src/state";
import { useTheme } from "../src/theme";

export default function AuthScreen() {
  const { t, session } = useApp();
  const c = useTheme();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [apple, setApple] = useState(false);

  useEffect(() => {
    void isAppleSignInAvailable().then(setApple);
  }, []);
  useEffect(() => {
    if (session && router.canGoBack()) router.back();
  }, [session]);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      Alert.alert(t("auth.failed"), e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  if (!isCloudEnabled)
    return (
      <Screen>
        <Txt variant="muted">{t("auth.unavailable")}</Txt>
      </Screen>
    );

  return (
    <Screen>
      <Txt variant="muted">{t("auth.intro")}</Txt>
      <Card>
        <Field
          label={t("auth.email")}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <Button
          title={t("auth.sendLink")}
          disabled={!/^\S+@\S+\.\S+$/.test(email)}
          loading={busy === "otp"}
          onPress={() => run("otp", async () => (await signInWithMagicLink(email), setSent(true)))}
        />
        {sent ? <Txt color={c.success}>{t("auth.linkSent")}</Txt> : null}
      </Card>
      {apple && Platform.OS === "ios" ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={
            c.scheme === "dark" ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={10}
          style={{ height: 46 }}
          onPress={() => run("apple", signInWithApple)}
        />
      ) : apple ? (
        <Button kind="secondary" title={t("auth.apple")} loading={busy === "apple"} onPress={() => run("apple", signInWithApple)} />
      ) : null}
      <Button kind="secondary" title={t("auth.google")} loading={busy === "google"} onPress={() => run("google", signInWithGoogle)} />
    </Screen>
  );
}
