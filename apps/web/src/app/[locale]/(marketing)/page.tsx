import { setRequestLocale } from "next-intl/server";
import { CtaBand, Faq, Features, Hero, ProofBand, Testimonials } from "@/components/marketing/sections";
import { Pricing } from "@/components/marketing/Pricing";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <Hero />
      <ProofBand />
      <Features />
      <div className="border-t border-border bg-surface/50">
        <Pricing />
      </div>
      <Testimonials />
      <Faq />
      <CtaBand />
    </>
  );
}
