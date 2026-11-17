"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SITE } from "@/config/site";

/** Sends the message to Geardown (stored and e-mailed by /api/contact); the page never leaves. */
export function ContactForm() {
  const t = useTranslations("contact");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  return (
    <form
      className="card space-y-4 p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        setState("sending");
        try {
          const r = await fetch("/api/contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: fd.get("name"), email: fd.get("email"), message: fd.get("message"), company: fd.get("company") }),
          });
          if (!r.ok) throw new Error(String(r.status));
          form.reset();
          setState("sent");
        } catch {
          setState("error");
        }
      }}
    >
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{t("name")}</span>
        <input name="name" required maxLength={120} className="input" autoComplete="name" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{t("email")}</span>
        <input name="email" type="email" required maxLength={200} className="input" autoComplete="email" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{t("message")}</span>
        <textarea name="message" required rows={6} maxLength={3500} className="input" />
      </label>
      {/* honeypot: hidden from people, filled by bots */}
      <input name="company" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <button className="btn btn-primary w-full" disabled={state === "sending"}>
        {state === "sending" ? t("sending") : t("send")}
      </button>
      {state === "sent" && <p className="text-sm text-success" role="status">{t("sent")}</p>}
      {state === "error" && (
        <p className="text-sm text-[var(--warning)]" role="alert">
          {t("error", { email: SITE.contactEmail })}
        </p>
      )}
    </form>
  );
}
