import { getTranslations } from "next-intl/server";
import { LEGAL, LEGAL_UPDATED } from "@/content/legal";

export async function LegalPage({ locale, doc }: { locale: "fr" | "en"; doc: keyof (typeof LEGAL)["fr"] }) {
  const t = await getTranslations("legal");
  const d = LEGAL[locale][doc];
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-4xl font-bold tracking-tight">{d.title}</h1>
      <p className="mt-2 text-sm text-muted">
        {t("updated")} : {LEGAL_UPDATED}
      </p>
      <div className="mt-10 space-y-8">
        {d.sections.map((s) => (
          <section key={s.h}>
            <h2 className="text-xl font-bold">{s.h}</h2>
            <div className="mt-2 space-y-2 leading-relaxed text-text/90">
              {s.p.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
