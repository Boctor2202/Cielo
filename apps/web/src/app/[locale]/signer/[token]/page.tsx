import { setRequestLocale } from "next-intl/server";
import { SignLinkPage } from "@/components/SignLinkPage";

export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };

/** Public page opened from a signature link: no account needed. */
export default async function Page({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  return <SignLinkPage token={token} />;
}
