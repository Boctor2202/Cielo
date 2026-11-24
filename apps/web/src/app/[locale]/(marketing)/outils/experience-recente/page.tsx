import { setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/marketing/sections";
import { JsonLd } from "@/components/JsonLd";
import { RecencyCalculator } from "@/components/marketing/tools/RecencyCalculator";
import { ToolFaq } from "@/components/marketing/tools/ToolFaq";
import { RECENCY, RECENCY_SOURCES, TOOLS_INDEX } from "@/content/tools";
import { absolute, breadcrumbLd, faqLd, organizationLd, pageMeta, toolLd } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: "fr" | "en" }> }) {
  const { locale } = await params;
  const c = RECENCY[locale];
  return pageMeta(locale, "/outils/experience-recente", { title: c.metaTitle, description: c.description });
}

export default async function RecencyPage({ params }: { params: Promise<{ locale: "fr" | "en" }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const c = RECENCY[locale];
  return (
    <>
      <JsonLd
        nodes={[
          organizationLd(),
          toolLd(locale, "/outils/experience-recente", c.title, c.description),
          faqLd(c.faq),
          breadcrumbLd([{ name: "Geardown", url: absolute("/", locale) }, { name: TOOLS_INDEX[locale].title, url: absolute("/outils", locale) }, { name: c.title, url: absolute("/outils/experience-recente", locale) }]),
        ]}
      />
      <PageHeader title={c.title} subtitle={c.intro} />
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <RecencyCalculator locale={locale} />
      </section>
      <ToolFaq items={c.faq} title={locale === "fr" ? "Questions fréquentes" : "Frequently asked questions"} />
      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
        <h2 className="text-lg font-bold">{locale === "fr" ? "Sources" : "Sources"}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {RECENCY_SOURCES.map((s) => (
            <li key={s.url}><a href={s.url} target="_blank" rel="noopener" className="text-accent underline underline-offset-2">{s.label}</a></li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">{locale === "fr" ? "Textes consultés le 24 novembre 2026. Pour information : le texte de votre autorité et le manuel de votre exploitant font foi." : "Texts read on 24 November 2026. For information: your authority's rules and your operator's manual prevail."}</p>
      </section>
    </>
  );
}
