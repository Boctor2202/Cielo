import { setRequestLocale } from "next-intl/server";
import { CtaBand, Faq, HowItWorks, ProofBand, Showcase, Testimonials } from "@/components/marketing/sections";
import { ImmersiveHome } from "@/components/marketing/immersive/ImmersiveHome";
import { Pricing } from "@/components/marketing/Pricing";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <ImmersiveHome />
      <ProofBand />
      <Showcase />
      <HowItWorks />
      <div className="border-t border-border bg-surface/50">
        <Pricing />
      </div>
      <Testimonials />
      <Faq />
      <CtaBand />
    </>
  );
}
