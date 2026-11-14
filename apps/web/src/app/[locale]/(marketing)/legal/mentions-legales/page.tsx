import { setRequestLocale } from "next-intl/server";
import { LEGAL } from "@/content/legal";
import { pageMeta } from "@/lib/seo";
import { LegalPage } from "../LegalPage";

export async function generateMetadata({ params }: { params: Promise<{ locale: "fr" | "en" }> }) {
  const locale = (await params).locale;
  return pageMeta(locale, "/legal/mentions-legales", { title: LEGAL[locale].notice.title });
}

export default async function Page({ params }: { params: Promise<{ locale: "fr" | "en" }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage locale={locale} doc="notice" />;
}
