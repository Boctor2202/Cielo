import { getTranslations, setRequestLocale } from "next-intl/server";
import { Faq } from "@/components/marketing/sections";
import { Pricing } from "@/components/marketing/Pricing";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "nav" });
  return { title: t("pricing") };
}

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <Pricing />
      <Faq />
    </>
  );
}
