import type { Metadata } from "next";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { SITE } from "@/config/site";

/** Public site URL (canonical links, sitemap, Open Graph). Set NEXT_PUBLIC_SITE_URL once the custom domain is live. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://cielo-ecru.vercel.app").replace(/\/$/, "");

export type Locale = (typeof routing.locales)[number];
type Href = Parameters<typeof getPathname>[0]["href"];

export const absolute = (href: Href, locale: string) => SITE_URL + getPathname({ href, locale: locale as Locale });

/** Canonical URL plus hreflang alternates (fr, en, x-default) for one page. */
export function alternatesFor(href: Href, locale: string): Metadata["alternates"] {
  return {
    canonical: absolute(href, locale),
    languages: {
      fr: absolute(href, "fr"),
      en: absolute(href, "en"),
      "x-default": absolute(href, routing.defaultLocale),
    },
  };
}

export const ogImage = (locale: string) => ({ url: `${SITE_URL}/og/strato-${locale === "en" ? "en" : "fr"}.jpg`, width: 1200, height: 630, alt: "Strato" });

/** Full metadata for a public page: title, description, canonical, hreflang, Open Graph and Twitter card. */
export function pageMeta(
  locale: string,
  href: Href,
  { title, description, noindex, type = "website", absoluteTitle }: { title: string; description?: string; noindex?: boolean; type?: "website" | "article"; absoluteTitle?: boolean },
): Metadata {
  const url = absolute(href, locale);
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: alternatesFor(href, locale),
    robots: noindex ? { index: false, follow: true } : undefined,
    openGraph: { title, description, url, siteName: SITE.name, type, locale: locale === "fr" ? "fr_FR" : "en_GB", images: [ogImage(locale)] },
    twitter: { card: "summary_large_image", title, description, images: [ogImage(locale).url] },
  };
}

/* ---------- structured data (schema.org) ---------- */

export function organizationLd() {
  return {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE.name,
    url: SITE_URL,
    logo: `${SITE_URL}/icon.svg`,
    email: SITE.contactEmail,
  };
}

export function softwareLd(locale: string, description: string) {
  const p = SITE.pricing;
  const offer = (name: string, price: number, unit: "MON") => ({
    "@type": "Offer",
    name,
    price: price.toFixed(2),
    priceCurrency: p.currency,
    priceSpecification: { "@type": "UnitPriceSpecification", price: price.toFixed(2), priceCurrency: p.currency, unitCode: unit },
    url: absolute("/tarifs", locale),
  });
  return {
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}/#app`,
    name: SITE.name,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: locale === "fr" ? "Carnet de vol électronique" : "Electronic pilot logbook",
    operatingSystem: "Web, iOS, Android",
    description,
    url: absolute("/", locale),
    inLanguage: ["fr", "en"],
    publisher: { "@id": `${SITE_URL}/#organization` },
    offers: [
      offer("Basic", p.basic.monthly, "MON"),
      offer("Max", p.premium.monthly, "MON"),
    ],
  };
}

export function faqLd(items: { q: string; a: string }[]) {
  return {
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
  };
}

export function breadcrumbLd(items: { name: string; url: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: it.url })),
  };
}

/** Serialises a JSON-LD graph safely for a <script> tag. */
export function ldJson(...nodes: object[]) {
  return JSON.stringify({ "@context": "https://schema.org", "@graph": nodes }).replace(/</g, "\\u003c");
}
