import { getTranslations, setRequestLocale } from "next-intl/server";
import { CloudOff, Download, EyeOff, HardDrive, Trash2, UserCheck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { pageMeta } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: "fr" | "en" }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "yourData" });
  return pageMeta(locale, "/vos-donnees", { title: t("title"), description: t("lead") });
}

const ICONS = [HardDrive, Download, Trash2, UserCheck, EyeOff, CloudOff];

/** What Geardown keeps, where, who sees it, and how to take it back: facts the code does, nothing more. */
export default async function Page({ params }: { params: Promise<{ locale: "fr" | "en" }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("yourData");
  const items = t.raw("items") as { h: string; p: string }[];
  const thirdParties = t.raw("thirdParties") as string[];
  return (
    <article className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <h1 className="text-4xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mt-4 text-lg text-muted">{t("lead")}</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {items.map((it, i) => {
          const Icon = ICONS[i % ICONS.length]!;
          return (
            <section key={it.h} className="rounded-xl border border-border bg-surface p-5">
              <Icon size={20} className="text-accent" aria-hidden />
              <h2 className="mt-3 text-lg font-bold">{it.h}</h2>
              <p className="mt-1.5 leading-relaxed text-muted">{it.p}</p>
            </section>
          );
        })}
      </div>
      <section className="mt-10">
        <h2 className="text-xl font-bold">{t("thirdTitle")}</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted">
          {thirdParties.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </section>
      <p className="mt-10 text-sm text-muted">
        {t("more")} <Link href="/legal/confidentialite" className="text-accent underline">{t("privacyLink")}</Link>
      </p>
    </article>
  );
}
