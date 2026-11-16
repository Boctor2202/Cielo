import React, { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { router } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import { Button, Card, Field, Screen, Segmented, Txt, tap } from "../src/components/ui";
import { enabledProviders, isAppleSignInAvailable, isCloudEnabled, signInWithApple, signInWithGoogle, supabase } from "../src/auth";
import { useApp } from "../src/state";
import { useTheme } from "../src/theme";
import type { I18nKey } from "../src/i18n";

type Step = "form" | "verify" | "forgot" | "reset";

/** Sign in with e-mail and password, create an account confirmed by a 6-digit code, or reset the password by code. */
export default function AuthScreen() {
  const { t, session } = useApp();
  const c = useTheme();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [apple, setApple] = useState(false);
  const [google, setGoogle] = useState(false);

  useEffect(() => {
    void enabledProviders().then(async (p) => {
      setApple(p.apple && (await isAppleSignInAvailable()));
      setGoogle(p.google);
    });
  }, []);
  useEffect(() => {
    if (session) {
      tap("success");
      if (router.canGoBack()) router.back();
    }
  }, [session]);

  /** The auth provider's errors in our words: its messages and name never reach the screen. */
  const fail = (e: { message?: string; code?: string } | null) => {
    const m = `${e?.code ?? ""} ${e?.message ?? ""}`.toLowerCase();
    const key = /invalid login|invalid_credentials/.test(m)
      ? "errCredentials"
      : /not confirmed/.test(m)
        ? "errNotConfirmed"
        : /already registered|already exists/.test(m)
          ? "errExists"
          : /expired|invalid.*(otp|token)/.test(m)
            ? "errCode"
            : /rate|too many|security purposes/.test(m)
              ? "errRate"
              : /password/.test(m)
                ? "errPassword"
                : "errGeneric";
    setError(t(`auth.${key}` as I18nKey));
  };
  const go = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      await fn();
    } catch (e) {
      fail(e as Error);
    } finally {
      setBusy(false);
    }
  };
  const sb = () => {
    if (!supabase) throw new Error("unavailable");
    return supabase;
  };

  const signIn = () =>
    go(async () => {
      const { error: e } = await sb().auth.signInWithPassword({ email: email.trim(), password });
      if (!e) return;
      if (/not confirmed/i.test(e.message)) {
        await sb().auth.resend({ type: "signup", email: email.trim() });
        setStep("verify");
        setInfo(t("auth.codeSent", { email }));
        return;
      }
      fail(e);
    });
  const signUp = () =>
    go(async () => {
      if (password.length < 8) return setError(t("auth.errPassword"));
      const { data, error: e } = await sb().auth.signUp({ email: email.trim(), password });
      if (e) return fail(e);
      if (!data.session) {
        setStep("verify");
        setInfo(t("auth.codeSent", { email }));
      }
    });
  const verify = () =>
    go(async () => {
      const { error: e } = await sb().auth.verifyOtp({ email: email.trim(), token: code, type: "signup" });
      if (e) fail(e);
    });
  const sendReset = () =>
    go(async () => {
      const { error: e } = await sb().auth.resetPasswordForEmail(email.trim());
      if (e) return fail(e);
      setStep("reset");
      setInfo(t("auth.codeSent", { email }));
    });
  const reset = () =>
    go(async () => {
      if (password.length < 8) return setError(t("auth.errPassword"));
      const v = await sb().auth.verifyOtp({ email: email.trim(), token: code, type: "recovery" });
      if (v.error) return fail(v.error);
      const u = await sb().auth.updateUser({ password });
      if (u.error) fail(u.error);
    });
  const back = () => (setStep("form"), setError(""), setInfo(""), setCode(""));

  if (!isCloudEnabled)
    return (
      <Screen backdrop>
        <Txt variant="muted">{t("auth.unavailable")}</Txt>
      </Screen>
    );

  const emailField = (
    <Field label={t("auth.email")} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
  );
  const codeField = (
    <Field
      label={t("auth.code")}
      value={code}
      onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
      keyboardType="number-pad"
      textContentType="oneTimeCode"
      autoComplete="one-time-code"
      monoValue
      style={{ alignSelf: "stretch" }}
    />
  );
  const feedback = (
    <>
      {info ? <Txt color={c.success}>{info}</Txt> : null}
      {error ? <Txt color={c.warning}>{error}</Txt> : null}
    </>
  );
  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());

  return (
    <Screen backdrop>
      {step === "form" ? (
        <>
          <Segmented<"login" | "signup">
            value={mode}
            onChange={(m) => (setMode(m), setError(""), setInfo(""))}
            options={[
              { value: "login", label: t("auth.tabLogin") },
              { value: "signup", label: t("auth.tabSignup") },
            ]}
          />
          <Card>
            {emailField}
            <Field
              label={t("auth.password")}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType={mode === "login" ? "password" : "newPassword"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              hint={mode === "signup" ? t("auth.passwordRule") : undefined}
            />
            <Button
              title={mode === "login" ? t("auth.signIn") : t("auth.register")}
              disabled={!validEmail || !password}
              loading={busy}
              onPress={() => void (mode === "login" ? signIn() : signUp())}
            />
            {feedback}
            {mode === "login" ? (
              <View style={{ gap: 4 }}>
                <Button kind="ghost" small title={t("auth.forgot")} onPress={() => (setStep("forgot"), setError(""))} />
                <Txt variant="small">{t("auth.firstPasswordHint")}</Txt>
              </View>
            ) : null}
          </Card>
          {apple && Platform.OS === "ios" ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={c.scheme === "dark" ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={10}
              style={{ height: 46 }}
              onPress={() => void go(async () => void (await signInWithApple()))}
            />
          ) : null}
          {google ? <Button kind="secondary" title={t("auth.google")} onPress={() => void go(async () => void (await signInWithGoogle()))} /> : null}
        </>
      ) : (
        <Card>
          {step === "verify" ? <Txt variant="muted">{t("auth.verifyIntro")}</Txt> : null}
          {step === "forgot" ? <Txt variant="muted">{t("auth.forgotIntro")}</Txt> : null}
          {step === "forgot" ? emailField : codeField}
          {step === "reset" ? (
            <Field label={t("auth.newPassword")} value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" hint={t("auth.passwordRule")} />
          ) : null}
          <Button
            title={step === "verify" ? t("auth.verify") : step === "forgot" ? t("auth.sendCode") : t("auth.savePassword")}
            loading={busy}
            disabled={step === "forgot" ? !validEmail : code.length < 6}
            onPress={() => void (step === "verify" ? verify() : step === "forgot" ? sendReset() : reset())}
          />
          {feedback}
          <Button kind="ghost" small title={t("auth.back")} onPress={back} />
          {step !== "forgot" ? (
            <Button
              kind="ghost"
              small
              title={t("auth.resend")}
              onPress={() =>
                void go(async () => {
                  const { error: e } = step === "verify" ? await sb().auth.resend({ type: "signup", email: email.trim() }) : await sb().auth.resetPasswordForEmail(email.trim());
                  if (e) return fail(e);
                  setInfo(t("auth.codeSent", { email }));
                })
              }
            />
          ) : null}
        </Card>
      )}
    </Screen>
  );
}
