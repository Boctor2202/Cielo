import React, { useState } from "react";
import { Alert, Linking, Platform, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Stack, router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, Card, Field, Row, Screen, Txt } from "../src/components/ui";
import { API_URL } from "../src/api";
import { supabase } from "../src/auth";
import { useApp } from "../src/state";
import { useTheme } from "../src/theme";

/**
 * The account: the e-mail address (sign-in and Geardown's e-mails), the password, and the subscription — changed
 * or cancelled where it was taken (App Store, Google Play, or the Stripe space for a card subscription).
 */
export default function Account() {
  const { t, session, pilot } = useApp();
  const c = useTheme();
  const email = session?.user.email ?? pilot.email;
  const [newEmail, setNewEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState<"email" | "pw" | "sub" | null>(null);
  const [emailSent, setEmailSent] = useState<string | null>(null);

  const changeEmail = async () => {
    const next = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next) || next === email?.toLowerCase()) return Alert.alert(t("account.title"), t("account.emailInvalid"));
    setBusy("email");
    const { error } = (await supabase?.auth.updateUser({ email: next }, { emailRedirectTo: `${API_URL}/app/parametres` })) ?? { error: new Error("cloud") };
    setBusy(null);
    if (error) return Alert.alert(t("account.title"), /registered|exists/i.test(error.message) ? t("account.emailTaken") : t("account.error"));
    setEmailSent(next);
    setNewEmail("");
  };

  const changePassword = async () => {
    if (pw.length < 8) return Alert.alert(t("account.pwTitle"), t("account.pwShort"));
    if (pw !== pw2) return Alert.alert(t("account.pwTitle"), t("account.pwMismatch"));
    setBusy("pw");
    const { error } = (await supabase?.auth.updateUser({ password: pw })) ?? { error: new Error("cloud") };
    setBusy(null);
    if (error) return Alert.alert(t("account.pwTitle"), /different|same/i.test(error.message) ? t("account.pwSame") : /reauth|recent/i.test(error.message) ? t("account.pwReauth") : t("account.error"));
    setPw("");
    setPw2("");
    Alert.alert(t("account.pwTitle"), t("account.pwDone"));
  };

  const source = pilot.subscriptionTier && pilot.subscriptionTier !== "free" ? pilot.subscriptionSource : null;
  /** The Stripe space for a card subscription (taken on the website). */
  const openStripe = async () => {
    if (!supabase) return;
    setBusy("sub");
    const { data, error } = await supabase.functions.invoke<{ url: string }>("create-portal-session", { body: { returnPath: "/app/parametres" } });
    setBusy(null);
    const status = (error as { context?: { status?: number } } | null)?.context?.status;
    if (error || !data?.url) return Alert.alert(t("account.subTitle"), status === 404 ? t("account.subNone") : t("account.subUnavailable"));
    await WebBrowser.openBrowserAsync(data.url);
  };

  if (!session) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t("account.title") }} />
        <Card>
          <Txt>{t("more.localMode")}</Txt>
          <Button title={t("more.signIn")} onPress={() => router.push("/auth")} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t("account.title") }} />
      <Card>
        <Row style={{ alignItems: "center", gap: 8 }}>
          <Ionicons name="mail-outline" size={18} color={c.accent} />
          <Txt variant="h2">{t("account.emailTitle")}</Txt>
        </Row>
        <Txt>
          {t("account.emailCurrent")} <Txt style={{ fontWeight: "700" }}>{email}</Txt>
        </Txt>
        <Txt variant="small">{t("account.emailWhy")}</Txt>
        <Field label={t("account.emailNew")} value={newEmail} onChangeText={setNewEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        <Button kind="secondary" title={t("account.emailChange")} loading={busy === "email"} disabled={!newEmail.trim()} onPress={() => void changeEmail()} />
        {emailSent ? <Txt variant="small" color={c.accent}>{t("account.emailSent", { email: emailSent })}</Txt> : null}
      </Card>

      <Card>
        <Row style={{ alignItems: "center", gap: 8 }}>
          <Ionicons name="key-outline" size={18} color={c.accent} />
          <Txt variant="h2">{t("account.pwTitle")}</Txt>
        </Row>
        <Field label={t("account.pwNew")} value={pw} onChangeText={setPw} secureTextEntry autoCapitalize="none" textContentType="newPassword" />
        <Field label={t("account.pwConfirm")} value={pw2} onChangeText={setPw2} secureTextEntry autoCapitalize="none" textContentType="newPassword" />
        <Txt variant="small">{t("account.pwHint")}</Txt>
        <Button kind="secondary" title={t("account.pwChange")} loading={busy === "pw"} disabled={!pw} onPress={() => void changePassword()} />
      </Card>

      <Card>
        <Row style={{ alignItems: "center", gap: 8 }}>
          <Ionicons name="card-outline" size={18} color={c.accent} />
          <Txt variant="h2">{t("account.subTitle")}</Txt>
        </Row>
        {source === "stripe" ? (
          <>
            <Txt variant="small">{t("account.subStripe")}</Txt>
            <Button kind="secondary" title={t("account.subManage")} loading={busy === "sub"} onPress={() => void openStripe()} />
          </>
        ) : source === "apple" || source === "google" ? (
          <>
            <Txt variant="small">{source === "apple" ? t("account.subApple") : t("account.subGoogle")}</Txt>
            <Button
              kind="secondary"
              title={t("account.subManage")}
              onPress={() => void Linking.openURL(source === "apple" || Platform.OS === "ios" ? "https://apps.apple.com/account/subscriptions" : "https://play.google.com/store/account/subscriptions")}
            />
          </>
        ) : (
          <Txt variant="small">{t("account.subNoneActive")}</Txt>
        )}
        <Button kind="ghost" title={t("more.subscription")} onPress={() => router.push("/subscription")} />
      </Card>
      <View style={{ height: 40 }} />
    </Screen>
  );
}
