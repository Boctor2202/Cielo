import { setRequestLocale } from "next-intl/server";
import { LEGAL } from "@/content/legal";
import { LegalPage } from "../LegalPage";

export async function generateMetadata({ params }: { params: Promise<{ locale: "fr" | "en" }> }) {
  return { title: LEGAL[(await params).locale].terms.title };
}

export default async function Page({ params }: { params: Promise<{ locale: "fr" | "en" }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage locale={locale} doc="terms" />;
}
