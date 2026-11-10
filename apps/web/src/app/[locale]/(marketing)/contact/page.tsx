import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/marketing/sections";
import { ContactForm } from "./ContactForm";

export async function generateMetadata() {
  return { title: "Contact" };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contact");
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <section className="mx-auto max-w-xl px-4 py-14 sm:px-6">
        <ContactForm />
      </section>
    </>
  );
}
