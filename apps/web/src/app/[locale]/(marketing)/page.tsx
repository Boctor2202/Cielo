import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { JsonLd } from "@/components/JsonLd";
import { faqLd, organizationLd, pageMeta, SITE_URL, softwareLd } from "@/lib/seo";
import { CtaBand, Faq, HowItWorks, OfferBox, OwnershipBlock, ProofBand, Showcase, Testimonials } from "@/components/marketing/sections";
import { ImmersiveHome } from "@/components/marketing/immersive/ImmersiveHome";
import { Pricing } from "@/components/marketing/Pricing";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo.home" });
  return pageMeta(locale, "/", { title: t("title"), description: t("description"), absoluteTitle: true });
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("seo.home");
  const m = (await getMessages()) as unknown as { faq: { items: { q: string; a: string }[] } };
  return (
    <>
      <JsonLd
        nodes={[
          organizationLd(),
          { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: SITE_URL, name: "Geardown", inLanguage: locale, publisher: { "@id": `${SITE_URL}/#organization` } },
          softwareLd(locale, t("description")),
          faqLd(m.faq.items),
        ]}
      />
      <ImmersiveHome />
      <OfferBox />
      <ProofBand />
      <Showcase />
      <HowItWorks />
      <div className="border-t border-border bg-surface/50">
        <Pricing />
      </div>
      <OwnershipBlock />
      {/* hidden until src/content/testimonials.ts holds real, consented testimonials */}
      <Testimonials />
      <Faq />
      <CtaBand />
    </>
  );
}
