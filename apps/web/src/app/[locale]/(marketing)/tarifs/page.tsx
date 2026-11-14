import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { JsonLd } from "@/components/JsonLd";
import { Faq } from "@/components/marketing/sections";
import { Pricing } from "@/components/marketing/Pricing";
import { faqLd, organizationLd, pageMeta, softwareLd } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo.pricing" });
  return pageMeta(locale, "/tarifs", { title: t("title"), description: t("description") });
}

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("seo.pricing");
  const m = (await getMessages()) as unknown as { faq: { items: { q: string; a: string }[] } };
  return (
    <>
      <JsonLd nodes={[organizationLd(), softwareLd(locale, t("description")), faqLd(m.faq.items)]} />
      <Pricing />
      <Faq />
    </>
  );
}
