"use client";

import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";

export function LocaleSwitch({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations("nav");
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const other = locale === "fr" ? "en" : "fr";
  return (
    <button
      type="button"
      aria-label={t("language")}
      className={`btn btn-ghost btn-sm !px-2 uppercase num ${className}`}
      onClick={() =>
        // @ts-expect-error -- pathname and params come from the current route and are always compatible
        router.replace({ pathname, params }, { locale: other })
      }
    >
      {other}
    </button>
  );
}
