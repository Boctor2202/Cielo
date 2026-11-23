import { setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/marketing/sections";
import { JsonLd } from "@/components/JsonLd";
import { NightCalculator } from "@/components/marketing/tools/NightCalculator";
import { ToolFaq } from "@/components/marketing/tools/ToolFaq";
import { NIGHT, TOOLS_INDEX } from "@/content/tools";
import { absolute, breadcrumbLd, faqLd, organizationLd, pageMeta, toolLd } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: "fr" | "en" }> }) {
  const { locale } = await params;
  const c = NIGHT[locale];
  return pageMeta(locale, "/outils/heures-de-nuit", { title: c.metaTitle, description: c.description });
}

export default async function NightPage({ params }: { params: Promise<{ locale: "fr" | "en" }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const c = NIGHT[locale];
  return (
    <>
      <JsonLd
        nodes={[
          organizationLd(),
          toolLd(locale, "/outils/heures-de-nuit", c.title, c.description),
          faqLd(c.faq),
          breadcrumbLd([{ name: "Geardown", url: absolute("/", locale) }, { name: TOOLS_INDEX[locale].title, url: absolute("/outils", locale) }, { name: c.title, url: absolute("/outils/heures-de-nuit", locale) }]),
        ]}
      />
      <PageHeader title={c.title} subtitle={c.intro} />
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <NightCalculator locale={locale} />
      </section>
      <ToolFaq items={c.faq} title={locale === "fr" ? "Questions fréquentes" : "Frequently asked questions"} />
    </>
  );
}
