"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { isCloudEnabled, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/config/site";
import { supabase } from "@/lib/supabase";
import { ensurePilot } from "@/lib/repo";
import { loadAirports } from "@/lib/airports";
import { loadDemo } from "@/lib/demo";
import { db } from "@/lib/db";
import { LogoMark } from "./Logo";

export function AuthCard({ mode }: { mode: "login" | "signup" }) {
  const t = useTranslations("auth");
  const locale = useLocale() as "fr" | "en";
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [code, setCode] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  /** form → (sign-up) verify the e-mail code; forgot → code + new password */
  const [step, setStep] = useState<"form" | "verify" | "forgot" | "reset" | "newPassword">(search.get("reset") === "1" ? "newPassword" : "form");
  const cloud = isCloudEnabled();
  // only the sign-in methods actually switched on in Supabase (Apple / Google need their own setup)
  const [providers, setProviders] = useState<{ apple: boolean; google: boolean }>({ apple: false, google: false });
  useEffect(() => {
    if (!cloud) return;
    fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY } })
      .then((r) => r.json())
      .then((d: { external?: Record<string, boolean> }) => setProviders({ apple: !!d.external?.apple, google: !!d.external?.google }))
      .catch(() => undefined);
  }, [cloud]);
  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/${locale}/app` : undefined;
  const resetTo = typeof window !== "undefined" ? `${window.location.origin}/${locale}/${locale === "en" ? "login" : "connexion"}?reset=1` : undefined;
  // plan picked on the pricing page: the 7-day trial checkout opens right after the first sign-in
  useEffect(() => {
    const plan = search.get("plan");
    if (mode === "signup" && (plan === "basic" || plan === "premium")) {
      try {
        localStorage.setItem("geardown-plan", plan);
        localStorage.setItem("geardown-interval", search.get("interval") === "yearly" ? "yearly" : "monthly");
      } catch {}
    }
  }, [mode, search]);

  async function local(withDemo: boolean) {
    setState("busy");
    await ensurePilot(locale);
    if (withDemo && (await db().t("flights").count()) === 0) await loadDemo(await loadAirports(), locale);
    router.push("/app");
  }

  /** Supabase errors in the pilot's words; its own messages (and its name) never reach the screen. */
  function fail(e: { message?: string; code?: string } | null) {
    const m = `${e?.code ?? ""} ${e?.message ?? ""}`.toLowerCase();
    const key = /invalid login|invalid_credentials/.test(m)
      ? "errCredentials"
      : /not confirmed|email_not_confirmed/.test(m)
        ? "errNotConfirmed"
        : /already registered|already exists|user_already_exists/.test(m)
          ? "errExists"
          : /expired|invalid.*(otp|token)|otp_expired/.test(m)
            ? "errCode"
            : /rate|too many|over_email_send_rate_limit|security purposes/.test(m)
              ? "errRate"
              : /password/.test(m)
                ? "errPassword"
                : "errGeneric";
    setError(t(key));
    setState("error");
  }
  const busy = () => (setState("busy"), setError(""), setInfo(""));
  const enter = () => router.push("/app");

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    const sb = supabase();
    if (!sb) return;
    busy();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (!error) return enter();
    if (/not confirmed/i.test(error.message)) {
      await sb.auth.resend({ type: "signup", email });
      setStep("verify");
      setInfo(t("codeSent", { email }));
      setState("idle");
      return;
    }
    fail(error);
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    const sb = supabase();
    if (!sb) return;
    if (password.length < 8) return (setError(t("errPassword")), setState("error"));
    if (password !== password2) return (setError(t("errMismatch")), setState("error"));
    busy();
    const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
    if (error) return fail(error);
    if (data.session) return enter();
    setStep("verify");
    setInfo(t("codeSent", { email }));
    setState("idle");
  }

  async function verifySignup(e: React.FormEvent) {
    e.preventDefault();
    const sb = supabase();
    if (!sb) return;
    busy();
    const { error } = await sb.auth.verifyOtp({ email, token: code.trim(), type: "signup" });
    if (error) return fail(error);
    enter();
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    const sb = supabase();
    if (!sb) return;
    busy();
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: resetTo });
    if (error) return fail(error);
    setStep("reset");
    setInfo(t("codeSent", { email }));
    setState("idle");
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    const sb = supabase();
    if (!sb) return;
    if (password.length < 8) return (setError(t("errPassword")), setState("error"));
    busy();
    const v = await sb.auth.verifyOtp({ email, token: code.trim(), type: "recovery" });
    if (v.error) return fail(v.error);
    const u = await sb.auth.updateUser({ password });
    if (u.error) return fail(u.error);
    enter();
  }

  /** Signed in by the reset link: only the new password is missing. */
  async function setNewPassword(e: React.FormEvent) {
    e.preventDefault();
    const sb = supabase();
    if (!sb) return;
    if (password.length < 8) return (setError(t("errPassword")), setState("error"));
    busy();
    const u = await sb.auth.updateUser({ password });
    if (u.error) return fail(u.error);
    enter();
  }

  async function resend(type: "signup" | "recovery") {
    const sb = supabase();
    if (!sb) return;
    busy();
    const { error } = type === "signup" ? await sb.auth.resend({ type: "signup", email, options: { emailRedirectTo: redirectTo } }) : await sb.auth.resetPasswordForEmail(email, { redirectTo: resetTo });
    if (error) return fail(error);
    setInfo(t("codeSent", { email }));
    setState("idle");
  }

  async function oauth(provider: "apple" | "google") {
    await supabase()?.auth.signInWithOAuth({ provider, options: { redirectTo } });
  }

  const demo = search.get("demo") === "1";

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <div className="card p-7 sm:p-8">
        <LogoMark size={36} />
        <h1 className="mt-5 text-2xl font-bold tracking-tight">{mode === "login" ? t("loginTitle") : t("signupTitle")}</h1>

        {demo && (
          <button type="button" className="btn btn-primary mt-6 w-full" onClick={() => local(true)} disabled={state === "busy"}>
            {t("demo")}
          </button>
        )}

        {cloud ? (
          <>
            {(providers.apple || providers.google) && (
            <div className="mt-6 grid gap-2.5">
              {providers.apple && (
              <button type="button" className="btn btn-secondary w-full" onClick={() => oauth("apple")}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.7-4.1zM13.9 5c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.1 1.1.1 2.3-.6 3-1.5z" /></svg>
                {t("apple")}
              </button>
              )}
              {providers.google && (
              <button type="button" className="btn btn-secondary w-full" onClick={() => oauth("google")}>
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden><path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.3-4.7 3.3-8.1z" /><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" /><path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9z" /><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" /></svg>
                {t("google")}
              </button>
              )}
            </div>
            )}
            {(providers.apple || providers.google) && (
            <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-muted">
              <span className="h-px flex-1 bg-border" /> {t("or")} <span className="h-px flex-1 bg-border" />
            </div>
            )}
            {(() => {
              const field = (label: string, input: React.ReactNode) => (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">{label}</span>
                  {input}
                </label>
              );
              const emailInput = field(t("email"), <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" autoComplete="email" />);
              const codeInput = field(
                t("code"),
                <input inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} className="input num text-center text-xl tracking-[0.4em]" placeholder="••••••" />,
              );
              const feedback = (
                <>
                  {info && <p className="text-sm text-success">{info}</p>}
                  {state === "error" && <p className="text-sm text-warning">{error}</p>}
                </>
              );
              const back = (
                <button type="button" className="text-sm font-semibold text-muted underline" onClick={() => (setStep("form"), setError(""), setInfo(""), setState("idle"))}>
                  {t("back")}
                </button>
              );
              if (step === "verify")
                return (
                  <form onSubmit={verifySignup} className="space-y-3">
                    <p className="text-sm text-muted">{t("verifyIntro")}</p>
                    {codeInput}
                    <button className="btn btn-primary w-full" disabled={state === "busy" || code.length < 6}>{t("verify")}</button>
                    {feedback}
                    <div className="flex justify-between">
                      {back}
                      <button type="button" className="text-sm font-semibold text-accent" onClick={() => resend("signup")}>{t("resend")}</button>
                    </div>
                  </form>
                );
              if (step === "newPassword")
                return (
                  <form onSubmit={setNewPassword} className="space-y-3">
                    <p className="text-sm text-muted">{t("newPasswordIntro")}</p>
                    {field(t("newPassword"), <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="input" autoComplete="new-password" />)}
                    <button className="btn btn-primary w-full" disabled={state === "busy"}>{t("savePassword")}</button>
                    {feedback}
                  </form>
                );
              if (step === "forgot")
                return (
                  <form onSubmit={sendReset} className="space-y-3">
                    <p className="text-sm text-muted">{t("forgotIntro")}</p>
                    {emailInput}
                    <button className="btn btn-primary w-full" disabled={state === "busy"}>{t("sendCode")}</button>
                    {feedback}
                    {back}
                  </form>
                );
              if (step === "reset")
                return (
                  <form onSubmit={reset} className="space-y-3">
                    {codeInput}
                    {field(t("newPassword"), <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="input" autoComplete="new-password" />)}
                    <button className="btn btn-primary w-full" disabled={state === "busy" || code.length < 6}>{t("savePassword")}</button>
                    {feedback}
                    <div className="flex justify-between">
                      {back}
                      <button type="button" className="text-sm font-semibold text-accent" onClick={() => resend("recovery")}>{t("resend")}</button>
                    </div>
                  </form>
                );
              return mode === "login" ? (
                <form onSubmit={signIn} className="space-y-3">
                  {emailInput}
                  {field(t("password"), <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input" autoComplete="current-password" />)}
                  <button className="btn btn-primary w-full" disabled={state === "busy"}>{t("signIn")}</button>
                  {feedback}
                  <button type="button" className="text-sm font-semibold text-accent" onClick={() => (setStep("forgot"), setError(""), setState("idle"))}>
                    {t("forgot")}
                  </button>
                  <p className="text-xs text-muted">{t("firstPasswordHint")}</p>
                </form>
              ) : (
                <form onSubmit={signUp} className="space-y-3">
                  {emailInput}
                  {field(t("password"), <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="input" autoComplete="new-password" />)}
                  {field(t("password2"), <input type="password" required minLength={8} value={password2} onChange={(e) => setPassword2(e.target.value)} className="input" autoComplete="new-password" />)}
                  <p className="text-xs text-muted">{t("passwordRule")}</p>
                  <button className="btn btn-primary w-full" disabled={state === "busy"}>{t("register")}</button>
                  {feedback}
                </form>
              );
            })()}
          </>
        ) : (
          <>
            <p className="mt-4 rounded-lg bg-surface-2 p-3 text-sm text-muted">{t("localInfo")}</p>
            <button type="button" className="btn btn-primary mt-5 w-full" onClick={() => local(false)} disabled={state === "busy"}>
              {t("local")}
            </button>
            {!demo && (
              <button type="button" className="btn btn-secondary mt-2.5 w-full" onClick={() => local(true)} disabled={state === "busy"}>
                {t("demo")}
              </button>
            )}
          </>
        )}

        <p className="mt-6 text-center text-sm text-muted">
          {mode === "login" ? t("noAccount") : t("hasAccount")}{" "}
          <Link href={mode === "login" ? "/inscription" : "/connexion"} className="font-semibold text-accent">
            {mode === "login" ? t("signupTitle") : t("loginTitle")}
          </Link>
        </p>
        <p className="mt-3 text-center text-xs text-muted">{t("terms")}</p>
      </div>
    </div>
  );
}
