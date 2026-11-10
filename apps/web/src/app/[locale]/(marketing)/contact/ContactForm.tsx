"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SITE } from "@/config/site";

/** Opens the user's mail client — swap for an API route / form service when one is chosen. */
export function ContactForm() {
  const t = useTranslations("contact");
  const [sent, setSent] = useState(false);
  return (
    <form
      className="card space-y-4 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const body = `${fd.get("message")}\n\n— ${fd.get("name")} <${fd.get("email")}>`;
        window.location.href = `mailto:${SITE.contactEmail}?subject=${encodeURIComponent("Cielo — contact")}&body=${encodeURIComponent(body)}`;
        setSent(true);
      }}
    >
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{t("name")}</span>
        <input name="name" required className="input" autoComplete="name" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{t("email")}</span>
        <input name="email" type="email" required className="input" autoComplete="email" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{t("message")}</span>
        <textarea name="message" required rows={6} className="input" />
      </label>
      <button className="btn btn-primary w-full">{t("send")}</button>
      {sent && <p className="text-sm text-success">{t("sent")}</p>}
    </form>
  );
}
