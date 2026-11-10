import { getTranslations, setRequestLocale } from "next-intl/server";
import { CtaBand, Features, PageHeader } from "@/components/marketing/sections";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "nav" });
  return { title: t("features") };
}

export default async function FeaturesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("features");
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <Features detailed />
      <CtaBand />
    </>
  );
}
