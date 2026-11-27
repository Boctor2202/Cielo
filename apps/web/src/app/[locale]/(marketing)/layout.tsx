import { setRequestLocale } from "next-intl/server";
import { Header } from "@/components/marketing/Header";
import { Footer } from "@/components/marketing/Footer";
import { VisitBeacon } from "@/components/marketing/VisitBeacon";

export default async function MarketingLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <Header />
      <main id="main">{children}</main>
      <Footer />
      <VisitBeacon />
    </>
  );
}
