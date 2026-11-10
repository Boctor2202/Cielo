"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { isCloudEnabled } from "@/config/site";
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
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const cloud = isCloudEnabled();
  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/${locale}/app` : undefined;

  async function local(withDemo: boolean) {
    setState("busy");
    await ensurePilot(locale);
    if (withDemo && (await db().t("flights").count()) === 0) await loadDemo(await loadAirports(), locale);
    router.push("/app");
  }

  async function magic(e: React.FormEvent) {
    e.preventDefault();
    const sb = supabase();
    if (!sb) return;
    setState("busy");
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    if (error) {
      setError(error.message);
      setState("error");
    } else setState("sent");
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
            <div className="mt-6 grid gap-2.5">
              <button type="button" className="btn btn-secondary w-full" onClick={() => oauth("apple")}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.7-4.1zM13.9 5c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.1 1.1.1 2.3-.6 3-1.5z" /></svg>
                {t("apple")}
              </button>
              <button type="button" className="btn btn-secondary w-full" onClick={() => oauth("google")}>
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden><path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.3-4.7 3.3-8.1z" /><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" /><path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9z" /><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" /></svg>
                {t("google")}
              </button>
            </div>
            <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-muted">
              <span className="h-px flex-1 bg-border" /> {t("or")} <span className="h-px flex-1 bg-border" />
            </div>
            <form onSubmit={magic} className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">{t("email")}</span>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" autoComplete="email" />
              </label>
              <button className="btn btn-primary w-full" disabled={state === "busy"}>
                {t("magicLink")}
              </button>
              {state === "sent" && <p className="text-sm text-success">{t("magicSent")}</p>}
              {state === "error" && <p className="text-sm text-warning">{error}</p>}
            </form>
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
