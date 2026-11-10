import { setRequestLocale } from "next-intl/server";
import { AppShell } from "@/components/app/AppShell";

export const metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <AppShell>{children}</AppShell>;
}
