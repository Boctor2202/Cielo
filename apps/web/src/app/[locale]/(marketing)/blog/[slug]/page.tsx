import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { POSTS } from "@/content/blog";
import { JsonLd } from "@/components/JsonLd";
import { absolute, breadcrumbLd, ogImage, organizationLd, pageMeta } from "@/lib/seo";

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: "fr" | "en"; slug: string }> }) {
  const { locale, slug } = await params;
  const p = POSTS.find((x) => x.slug === slug);
  if (!p) return {};
  const meta = pageMeta(locale, { pathname: "/blog/[slug]", params: { slug } }, { title: p[locale].title, description: p[locale].excerpt, type: "article" });
  return { ...meta, openGraph: { ...meta.openGraph, type: "article", publishedTime: p.date } };
}

export default async function PostPage({ params }: { params: Promise<{ locale: "fr" | "en"; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("blog");
  const post = POSTS.find((x) => x.slug === slug);
  if (!post) notFound();
  const c = post[locale];
  const url = absolute({ pathname: "/blog/[slug]", params: { slug } }, locale);
  const df = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { dateStyle: "long" });
  return (
    <article className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <JsonLd
        nodes={[
          organizationLd(),
          {
            "@type": "BlogPosting",
            headline: c.title,
            description: c.excerpt,
            datePublished: post.date,
            inLanguage: locale,
            mainEntityOfPage: url,
            image: ogImage(locale).url,
            author: { "@id": organizationLd()["@id"] },
            publisher: { "@id": organizationLd()["@id"] },
          },
          breadcrumbLd([
            { name: "Geardown", url: absolute("/", locale) },
            { name: "Blog", url: absolute("/blog", locale) },
            { name: c.title, url },
          ]),
        ]}
      />
      <Link href="/blog" className="text-sm font-semibold text-accent">
        ← {t("back")}
      </Link>
      <p className="mt-8 text-sm text-muted">
        {df.format(new Date(post.date))} · {post.readingMin} min
      </p>
      <h1 className="mt-2 text-4xl font-bold leading-tight tracking-tight">{c.title}</h1>
      <p className="mt-4 text-lg text-muted">{c.excerpt}</p>
      <div className="mt-10 space-y-5 text-[17px] leading-relaxed">
        {c.body.map((para, i) =>
          para.startsWith("## ") ? (
            <h2 key={i} className="pt-4 text-2xl font-bold tracking-tight">
              {para.slice(3)}
            </h2>
          ) : (
            <p key={i}>{para}</p>
          ),
        )}
      </div>
    </article>
  );
}
