import type { MetadataRoute } from "next";
import { POSTS } from "@/content/blog";
import { absolute } from "@/lib/seo";

/** Public pages in both languages, each with its hreflang alternates. The app (/app) is private and left out. */
export default function sitemap(): MetadataRoute.Sitemap {
  type Href = Parameters<typeof absolute>[0];
  const pages: { href: Href; priority: number; freq: "weekly" | "monthly" | "yearly"; lastModified?: string }[] = [
    { href: "/", priority: 1, freq: "weekly" },
    { href: "/fonctionnalites", priority: 0.9, freq: "monthly" },
    { href: "/tarifs", priority: 0.9, freq: "monthly" },
    { href: "/compagnies", priority: 0.7, freq: "monthly" },
    { href: "/blog", priority: 0.7, freq: "weekly" },
    { href: "/outils", priority: 0.7, freq: "monthly" },
    { href: "/outils/heures-de-nuit", priority: 0.8, freq: "monthly" },
    { href: "/outils/fdp-maximum", priority: 0.8, freq: "monthly" },
    { href: "/contact", priority: 0.4, freq: "yearly" },
    { href: "/vos-donnees", priority: 0.5, freq: "yearly" },
    { href: "/legal/mentions-legales", priority: 0.2, freq: "yearly" },
    { href: "/legal/confidentialite", priority: 0.2, freq: "yearly" },
    { href: "/legal/cgu", priority: 0.2, freq: "yearly" },
    { href: "/legal/cookies", priority: 0.2, freq: "yearly" },
    ...POSTS.map((p) => ({ href: { pathname: "/blog/[slug]" as const, params: { slug: p.slug } }, priority: 0.6, freq: "monthly" as const, lastModified: p.date })),
  ];
  return pages.flatMap((p) =>
    (["fr", "en"] as const).map((locale) => ({
      url: absolute(p.href, locale),
      lastModified: p.lastModified ? new Date(p.lastModified) : new Date(),
      changeFrequency: p.freq,
      priority: p.priority,
      alternates: { languages: { fr: absolute(p.href, "fr"), en: absolute(p.href, "en") } },
    })),
  );
}
