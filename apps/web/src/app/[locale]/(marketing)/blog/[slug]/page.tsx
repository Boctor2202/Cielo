import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { POSTS } from "@/content/blog";

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: "fr" | "en"; slug: string }> }) {
  const { locale, slug } = await params;
  const p = POSTS.find((x) => x.slug === slug);
  return p ? { title: p[locale].title, description: p[locale].excerpt } : {};
}

export default async function PostPage({ params }: { params: Promise<{ locale: "fr" | "en"; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("blog");
  const post = POSTS.find((x) => x.slug === slug);
  if (!post) notFound();
  const c = post[locale];
  const df = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { dateStyle: "long" });
  return (
    <article className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
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
