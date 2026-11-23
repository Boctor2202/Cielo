import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/marketing/sections";
import { JsonLd } from "@/components/JsonLd";
import { FDP, NIGHT, TOOLS_INDEX } from "@/content/tools";
import { absolute, breadcrumbLd, organizationLd, pageMeta } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: "fr" | "en" }> }) {
  const { locale } = await params;
  const c = TOOLS_INDEX[locale];
  return pageMeta(locale, "/outils", { title: c.metaTitle, description: c.description });
}

export default async function ToolsPage({ params }: { params: Promise<{ locale: "fr" | "en" }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const c = TOOLS_INDEX[locale];
  const items = [
    { href: "/outils/heures-de-nuit" as const, c: NIGHT[locale] },
    { href: "/outils/fdp-maximum" as const, c: FDP[locale] },
  ];
  return (
    <>
      <JsonLd nodes={[organizationLd(), breadcrumbLd([{ name: "Geardown", url: absolute("/", locale) }, { name: c.title, url: absolute("/outils", locale) }])]} />
      <PageHeader title={c.title} subtitle={c.intro} />
      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-14 sm:px-6 md:grid-cols-2">
        {items.map(({ href, c: x }) => (
          <Link key={href} href={href} className="card group p-6 transition-colors hover:border-accent">
            <h2 className="text-xl font-bold tracking-tight group-hover:text-accent">{x.title}</h2>
            <p className="mt-2 text-muted">{x.intro}</p>
            <span className="mt-4 inline-block text-sm font-semibold text-accent">{locale === "fr" ? "Ouvrir" : "Open"} →</span>
          </Link>
        ))}
      </section>
    </>
  );
}
