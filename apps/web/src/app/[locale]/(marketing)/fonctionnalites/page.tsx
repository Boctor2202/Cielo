import { getTranslations, setRequestLocale } from "next-intl/server";
import { CtaBand, Features, PageHeader } from "@/components/marketing/sections";
import { pageMeta } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo.features" });
  return pageMeta(locale, "/fonctionnalites", { title: t("title"), description: t("description") });
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
