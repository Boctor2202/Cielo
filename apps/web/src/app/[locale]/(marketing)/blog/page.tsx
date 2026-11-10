import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/marketing/sections";
import { POSTS } from "@/content/blog";

export async function generateMetadata() {
  return { title: "Blog" };
}

export default async function BlogPage({ params }: { params: Promise<{ locale: "fr" | "en" }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("blog");
  const df = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { dateStyle: "long" });
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-14 sm:px-6 md:grid-cols-2">
        {POSTS.map((p) => (
          <Link key={p.slug} href={{ pathname: "/blog/[slug]", params: { slug: p.slug } }} className="card group p-6 transition-colors hover:border-accent">
            <p className="text-xs text-muted">
              {df.format(new Date(p.date))} · {p.readingMin} min
            </p>
            <h2 className="mt-2 text-xl font-bold tracking-tight group-hover:text-accent">{p[locale].title}</h2>
            <p className="mt-2 text-muted">{p[locale].excerpt}</p>
            <span className="mt-4 inline-block text-sm font-semibold text-accent">{t("read")} →</span>
          </Link>
        ))}
      </section>
    </>
  );
}
