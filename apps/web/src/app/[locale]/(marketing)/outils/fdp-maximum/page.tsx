import { setRequestLocale } from "next-intl/server";
import { maxDailyFdp } from "@cielo/core";
import { PageHeader } from "@/components/marketing/sections";
import { JsonLd } from "@/components/JsonLd";
import { FdpCalculator } from "@/components/marketing/tools/FdpCalculator";
import { ToolFaq } from "@/components/marketing/tools/ToolFaq";
import { FDP, TOOLS_INDEX } from "@/content/tools";
import { absolute, breadcrumbLd, faqLd, organizationLd, pageMeta, toolLd } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: "fr" | "en" }> }) {
  const { locale } = await params;
  const c = FDP[locale];
  return pageMeta(locale, "/outils/fdp-maximum", { title: c.metaTitle, description: c.description });
}

// ORO.FTL.205(b)(1) bands of reporting time, as shown in the regulation
const BANDS: [string, number][] = [
  ["06:00–13:29", 6 * 60], ["13:30–13:59", 13 * 60 + 30], ["14:00–14:29", 14 * 60], ["14:30–14:59", 14 * 60 + 30], ["15:00–15:29", 15 * 60],
  ["15:30–15:59", 15 * 60 + 30], ["16:00–16:29", 16 * 60], ["16:30–16:59", 16 * 60 + 30], ["17:00–04:59", 17 * 60], ["05:00–05:14", 5 * 60],
  ["05:15–05:29", 5 * 60 + 15], ["05:30–05:44", 5 * 60 + 30], ["05:45–05:59", 5 * 60 + 45],
];
const SECTORS = [2, 3, 4, 5, 6, 7, 8, 9, 10];
const hm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;

export default async function FdpPage({ params }: { params: Promise<{ locale: "fr" | "en" }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const c = FDP[locale];
  const fr = locale === "fr";
  return (
    <>
      <JsonLd
        nodes={[
          organizationLd(),
          toolLd(locale, "/outils/fdp-maximum", c.title, c.description),
          faqLd(c.faq),
          breadcrumbLd([{ name: "Geardown", url: absolute("/", locale) }, { name: TOOLS_INDEX[locale].title, url: absolute("/outils", locale) }, { name: c.title, url: absolute("/outils/fdp-maximum", locale) }]),
        ]}
      />
      <PageHeader title={c.title} subtitle={c.intro} />
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <FdpCalculator locale={locale} />
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-6 sm:px-6">
        <h2 className="text-2xl font-bold tracking-tight">{fr ? "Tableau EASA de la FDP maximale (ORO.FTL.205, équipage acclimaté)" : "EASA maximum FDP table (ORO.FTL.205, acclimatised crew)"}</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted">{fr ? "FDP de base maximale selon l'heure de présentation (heure de référence) et le nombre d'étapes, sans extension." : "Maximum basic daily FDP by reporting time (reference time) and number of sectors, without extension."}</p>
        <div className="mt-5 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="bg-surface-2 text-left text-muted">
                <th className="px-3 py-2 font-semibold">{fr ? "Présentation" : "Report"}</th>
                {SECTORS.map((s) => <th key={s} className="px-3 py-2 text-right font-semibold">{s === 2 ? "1–2" : s}</th>)}
              </tr>
            </thead>
            <tbody>
              {BANDS.map(([label, start]) => (
                <tr key={label} className="border-t border-border">
                  <td className="num px-3 py-2 font-semibold">{label}</td>
                  {SECTORS.map((s) => <td key={s} className="num px-3 py-2 text-right">{hm(maxDailyFdp(start, s))}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">{fr ? "Pour information. Le schéma FTL approuvé de votre exploitant prévaut." : "For information. Your operator's approved FTL scheme prevails."}</p>
      </section>
      <ToolFaq items={c.faq} title={fr ? "Questions fréquentes" : "Frequently asked questions"} />
    </>
  );
}
