import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { SITE_URL } from "@/lib/seo";
import { unpackShare } from "@cielo/core";
import en from "../../../../../messages/en.json";
import fr from "../../../../../messages/fr.json";

type Props = { params: Promise<{ locale: string; p: string }> };

/** What the shared image says, for the page title. */
function titleOf(q: URLSearchParams, locale: string) {
  const B = (locale === "fr" ? fr : en).app.badges as unknown as { d: Record<string, string>; title: Record<string, string>; club: string };
  const name = q.get("name") ?? "";
  if (q.get("type") === "map") {
    const fr_ = locale === "fr";
    const n = (k: string) => Number(q.get(k) ?? 0).toLocaleString(locale);
    const what = [fr_ ? "Carte des vols" : "Flight map", q.get("per"), q.get("ty")].filter(Boolean).join(" · ");
    const stats = fr_ ? `${n("fl")} vols · ${n("ap")} aéroports · ${n("nm")} NM · ${n("ct")} pays` : `${n("fl")} flights · ${n("ap")} airports · ${n("nm")} NM · ${n("ct")} countries`;
    return { what, name, stats };
  }
  const what = q.get("type") === "level" ? `${B.title[q.get("h") ?? ""] ?? ""} · ${B.club.replace("{n}", Number(q.get("h") ?? 0).toLocaleString(locale))}` : (B.d[q.get("id") ?? ""] ?? "");
  return { what, name, stats: "" };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, p } = await params;
  const q = unpackShare(p);
  if (!q) return {};
  const { what, name, stats } = titleOf(q, locale);
  const title = name ? `${name} · ${what}` : what;
  const image = `${SITE_URL}/api/share-card?${q.toString()}&fmt=og`;
  const description = stats || (locale === "fr" ? "Le carnet de vol des pilotes, sur Geardown." : "The pilot logbook, on Geardown.");
  return {
    title,
    description,
    robots: { index: false, follow: true },
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }], url: `${SITE_URL}/${locale}/b/${p}`, type: "website", siteName: "Geardown" },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

/** The public page of a shared achievement or flight map: the image, and Geardown. */
export default async function Page({ params }: Props) {
  const { locale, p } = await params;
  setRequestLocale(locale);
  const q = unpackShare(p);
  if (!q) notFound();
  const { what, name, stats } = titleOf(q, locale);
  const fr_ = locale === "fr";
  return (
    <main className="mx-auto flex min-h-[100svh] max-w-xl flex-col items-center justify-center gap-6 px-5 py-10 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/share-card?${q.toString()}`} alt={`${name} · ${what}`} className="w-full max-w-md rounded-3xl shadow-2xl" />
      <div>
        <h1 className="text-2xl font-semibold">{name ? `${name} · ${what}` : what}</h1>
        {stats ? <p className="mt-2 font-mono text-sm">{stats}</p> : null}
        <p className="mt-2 text-sm text-muted">{fr_ ? "Carnet de vol électronique, badges et statistiques pour pilotes." : "Electronic logbook, badges and statistics for pilots."}</p>
      </div>
      <Link href="/" className="btn btn-primary">
        {fr_ ? "Découvrir Geardown" : "Discover Geardown"}
      </Link>
    </main>
  );
}
