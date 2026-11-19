import { setRequestLocale } from "next-intl/server";
import { BackToApp } from "./BackToApp";

export const metadata = { robots: { index: false, follow: false } };

/** Where Stripe sends a pilot who opened it from the iPhone app: straight back into the app. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <BackToApp fr={locale === "fr"} />;
}
