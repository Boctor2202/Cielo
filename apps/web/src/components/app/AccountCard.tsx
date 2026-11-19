"use client";

import { KeyRound, Mail } from "lucide-react";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { supabase } from "@/lib/supabase";
import { useCloud } from "@/lib/cloud";
import { Card, Field, useToast } from "./ui";

/**
 * The account: the e-mail address used to sign in and to receive Geardown's e-mails (alerts, signatures,
 * receipts), and the password. Changing the address sends a confirmation link to the new one (and to the old one).
 */
export function AccountCard() {
  const t = useTranslations("app.account");
  const locale = useLocale();
  const cloud = useCloud();
  const { toast, toastNode } = useToast();
  const email = cloud.session?.user.email ?? "";
  const [newEmail, setNewEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState<"email" | "pw" | null>(null);
  const [emailSent, setEmailSent] = useState<string | null>(null);

  if (!cloud.session) return null;

  const changeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next) || next === email.toLowerCase()) return toast(t("emailInvalid"));
    setBusy("email");
    const { error } = (await supabase()?.auth.updateUser({ email: next }, { emailRedirectTo: `${window.location.origin}/${locale}/app/parametres` })) ?? { error: new Error("cloud") };
    setBusy(null);
    if (error) return toast(/registered|exists/i.test(error.message) ? t("emailTaken") : t("error"));
    setEmailSent(next);
    setNewEmail("");
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return toast(t("pwShort"));
    if (pw !== pw2) return toast(t("pwMismatch"));
    setBusy("pw");
    const { error } = (await supabase()?.auth.updateUser({ password: pw })) ?? { error: new Error("cloud") };
    setBusy(null);
    if (error) return toast(/different|same/i.test(error.message) ? t("pwSame") : /reauth|recent/i.test(error.message) ? t("pwReauth") : t("error"));
    setPw("");
    setPw2("");
    toast(t("pwDone"));
  };

  return (
    <Card title={t("title")}>
      <div className="space-y-6">
        <form onSubmit={changeEmail} className="space-y-3">
          <p className="flex items-center gap-2 text-sm font-semibold"><Mail size={15} className="text-accent" /> {t("emailTitle")}</p>
          <p className="text-sm">
            {t("emailCurrent")} <span className="font-semibold">{email}</span>
          </p>
          <p className="text-xs text-muted">{t("emailWhy")}</p>
          <div className="flex flex-wrap items-end gap-2">
            <Field label={t("emailNew")} className="min-w-56 flex-1">
              <input type="email" className="input" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} autoComplete="email" placeholder="nom@exemple.com" />
            </Field>
            <button type="submit" className="btn btn-secondary" disabled={!newEmail.trim() || busy === "email"}>{t("emailChange")}</button>
          </div>
          {emailSent && <p className="rounded-lg bg-accent/10 px-3 py-2 text-sm text-accent">{t("emailSent", { email: emailSent })}</p>}
        </form>

        <form onSubmit={changePassword} className="space-y-3 border-t border-border pt-5">
          <p className="flex items-center gap-2 text-sm font-semibold"><KeyRound size={15} className="text-accent" /> {t("pwTitle")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("pwNew")}>
              <input type="password" className="input" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
            </Field>
            <Field label={t("pwConfirm")}>
              <input type="password" className="input" minLength={8} value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
            </Field>
          </div>
          <p className="text-xs text-muted">{t("pwHint")}</p>
          <button type="submit" className="btn btn-secondary" disabled={!pw || busy === "pw"}>{t("pwChange")}</button>
        </form>
      </div>
      {toastNode}
    </Card>
  );
}
