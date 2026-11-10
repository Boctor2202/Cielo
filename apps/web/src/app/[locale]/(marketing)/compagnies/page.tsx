import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Building2, CalendarClock, ShieldCheck, Users } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/marketing/sections";
import { BrowserFrame, Shot } from "@/components/marketing/Shot";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "nav" });
  return { title: t("airlines") };
}

export default async function AirlinesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("airlines");
  const m = (await getMessages()) as unknown as { airlines: { points: { t: string; d: string }[] } };
  const icons = [CalendarClock, Users, ShieldCheck, Building2];
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <section className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2">
        <div className="grid gap-6 sm:grid-cols-2">
          {m.airlines.points.map((p, i) => {
            const Icon = icons[i]!;
            return (
              <div key={p.t} className="card p-5">
                <Icon size={20} className="text-accent" />
                <h2 className="mt-3 font-bold">{p.t}</h2>
                <p className="mt-1.5 text-sm text-muted">{p.d}</p>
              </div>
            );
          })}
          <Link href="/contact" className="btn btn-primary sm:col-span-2">
            {t("cta")}
          </Link>
        </div>
        <BrowserFrame>
          <Shot name="roster" alt="" className="w-full" />
        </BrowserFrame>
      </section>
    </>
  );
}
