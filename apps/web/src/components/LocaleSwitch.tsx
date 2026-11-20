"use client";

import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { Link, usePathname } from "@/i18n/navigation";

/**
 * The other language, as a real link to the same page in that language: it works without JavaScript and for search
 * engines (a button only worked once the page's script had loaded).
 */
export function LocaleSwitch({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations("nav");
  const pathname = usePathname();
  const params = useParams();
  const other = locale === "fr" ? "en" : "fr";
  return (
    <Link
      // @ts-expect-error -- pathname and params come from the current route and are always compatible
      href={{ pathname, params }}
      locale={other}
      hrefLang={other}
      aria-label={t("language")}
      className={`btn btn-ghost btn-sm !px-2 uppercase num ${className}`}
    >
      {other}
    </Link>
  );
}
