import { LayoverShowcase } from "./LayoverShowcase";
import { DemoClip, type ClipName } from "./DemoClip";
import { useLocale, useMessages, useTranslations } from "next-intl";
import { ArrowRight, BadgeCheck, Briefcase, CalendarClock, CalendarRange, Check, Hotel, CloudOff, FileDown, FileUser, Lock, Map, PenLine, ScanSearch, ShieldCheck, Upload } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { SITE } from "@/config/site";
import { BrowserFrame, LaptopFrame, PhoneFrame, Shot } from "./Shot";
import { FeatureTabs } from "./FeatureTabs";
import { Reveal } from "./Reveal";

/** features shown by a clip filmed on the real app rather than a still */
const CLIPS: Partial<Record<(typeof FEATURE_KEYS)[number], ClipName>> = { import: "import", audit: "audit", signature: "sign", licenses: "licences", ftl: "ftl", cv: "cv", jobs: "jobs" };

export const FEATURE_KEYS = ["logbook", "import", "audit", "licenses", "ftl", "roster", "stats", "layovers", "signature", "offline", "jobs", "cv"] as const;
const ICONS = { roster: CalendarRange, layovers: Hotel, logbook: FileDown, import: Upload, audit: ScanSearch, licenses: BadgeCheck, ftl: CalendarClock, stats: Map, signature: PenLine, offline: CloudOff, jobs: Briefcase, cv: FileUser };

export function Hero() {
  const t = useTranslations("hero");
  return (
    <section className="horizon relative overflow-hidden">
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1fr_1.12fr] lg:pb-28 lg:pt-20">
        <div>
          <h1 className="mt-6 text-balance text-[2.6rem] font-bold leading-[1.04] tracking-[-0.035em] sm:text-6xl lg:text-[4.1rem]">{t("title")}</h1>
          <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted">{t("subtitle")}</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/inscription" className="btn btn-primary min-h-12 !px-6 text-base shadow-[0_10px_30px_-10px_var(--accent)]">
              {t("ctaTrial")} <ArrowRight size={18} aria-hidden />
            </Link>
            <Link href={{ pathname: "/connexion", query: { demo: "1" } }} className="btn btn-secondary min-h-12 !px-6 text-base">
              {t("ctaDemo")}
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted">{t("note")}</p>
          <StoreBadges className="mt-9" />
        </div>
        <div className="relative pb-8 sm:pb-12">
          <div className="hud-frame">
            <LaptopFrame>
              <div className="aspect-[16/10]">
                <Shot name="dashboard" alt="" priority className="h-full w-full object-cover object-top" />
              </div>
            </LaptopFrame>
          </div>
          <PhoneFrame className="absolute -bottom-2 right-[-2%] w-[27%] min-w-[108px] sm:-bottom-6">
            <Shot name="mobile-logbook" alt="" priority className="w-full" />
          </PhoneFrame>
          {/* Instrument readouts: what Geardown computes for you */}
          <div className="glass absolute -left-3 top-[58%] hidden rounded-xl border border-border px-4 py-3 shadow-xl sm:block" aria-hidden>
            <p className="mono-label !text-[11px]">{t("readoutNight")}</p>
            <p className="num mt-1 text-2xl font-semibold">0:47</p>
            <p className="num text-[11px] text-muted">{t("readoutRoute")}</p>
          </div>
          <div className="glass absolute -top-5 left-[18%] hidden items-center gap-2 rounded-full border border-success/40 px-3 py-1.5 text-xs font-semibold text-success shadow-lg sm:flex" aria-hidden>
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> {t("readoutStatus")}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Why() {
  const t = useTranslations("why");
  const m = useMessages() as { why: { items: { t: string; d: string }[] } };
  const icons = [ShieldCheck, CloudOff, Lock];
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
      <Reveal className="reveal max-w-2xl">
        <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h2>
      </Reveal>
      <Reveal className="mt-10 grid gap-4 md:grid-cols-3">
        {m.why.items.map((it, i) => {
          const Icon = icons[i] ?? ShieldCheck;
          return (
            <div key={it.t} className="reveal card relative overflow-hidden p-6">
              <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" aria-hidden />
              <Icon size={22} className="text-accent" aria-hidden />
              <h3 className="mt-4 text-lg font-semibold">{it.t}</h3>
              <p className="mt-2 leading-relaxed text-muted">{it.d}</p>
            </div>
          );
        })}
      </Reveal>
    </section>
  );
}

export function Showcase() {
  const t = useTranslations("features");
  const ts = useTranslations("showcase");
  return (
    <section id="features" className="border-y border-border bg-surface/40">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <Reveal className="reveal mb-12 max-w-2xl">
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h2>
          <p className="mt-4 text-lg text-muted">{t("subtitle")}</p>
          <p className="sr-only">{ts("hint")}</p>
        </Reveal>
        <FeatureTabs />
      </div>
    </section>
  );
}

export function HowItWorks() {
  const t = useTranslations("how");
  const m = useMessages() as { how: { steps: { t: string; d: string }[] } };
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
      <Reveal className="reveal max-w-2xl">
        <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h2>
      </Reveal>
      <Reveal as="ul" className="relative mt-12 grid gap-8 md:grid-cols-3 md:gap-6">
        <span className="absolute left-0 right-0 top-5 hidden h-px border-t border-dashed border-border md:block" aria-hidden />
        {m.how.steps.map((s, i) => (
          <li key={s.t} className="reveal relative">
            <span className="num relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-accent bg-bg text-sm font-semibold text-accent">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="mt-5 text-lg font-semibold">{s.t}</h3>
            <p className="mt-2 leading-relaxed text-muted">{s.d}</p>
          </li>
        ))}
      </Reveal>
    </section>
  );
}

/** A store badge: a link once the app is published there, otherwise a plain label (no dead "#"). */
function StoreLink({ href, className, label, children }: { href: string; className: string; label: string; children: React.ReactNode }) {
  if (!href || href === "#") return <span className={`${className} cursor-default`} aria-label={label}>{children}</span>;
  return <a href={href} className={className} aria-label={label}>{children}</a>;
}

/**
 * The official App Store and Google Play badges (black versions, unmodified, at least 40 px high as Apple asks),
 * in the page's language. Before the apps are published, a "coming soon" line sits beside them, never on them.
 */
export function StoreBadges({ className = "" }: { className?: string }) {
  const t = useTranslations("hero");
  const locale = useLocale();
  const lang = locale === "fr" ? "fr" : "en";
  // the iPhone beta is open: one clear button instead of two « coming soon » badges
  if (SITE.betaUrl) {
    return (
      <div className={`flex flex-col gap-1.5 ${className}`}>
        <a href={SITE.betaUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary self-start">{t("betaJoin")}</a>
        <span className="text-xs text-muted">{t("betaNote")}</span>
      </div>
    );
  }
  const soon = SITE.stores.appStoreUrl === "#" || SITE.stores.playStoreUrl === "#";
  const badge = "block h-12 transition-opacity hover:opacity-90";
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <StoreLink href={SITE.stores.appStoreUrl} className={badge} label={t("appStore")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/badges/app-store-${lang}.svg`} alt="" className="h-full w-auto" />
      </StoreLink>
      <StoreLink href={SITE.stores.playStoreUrl} className={badge} label={t("playStore")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/badges/google-play-${lang}.svg`} alt="" className="h-full w-auto" />
      </StoreLink>
      {soon && <span className="store-soon text-xs font-semibold uppercase tracking-wider text-muted">{t("comingSoon")}</span>}
    </div>
  );
}

export function ProofBand() {
  const t = useTranslations("proof");
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-GB");
  const items = [
    { v: SITE.stats.hoursLogged, l: t("hours") },
    { v: SITE.stats.pilots, l: t("pilots") },
    { v: SITE.stats.airlinesSupported, l: t("airlines") },
  ].filter((i) => i.v !== null);
  // Only verified figures are shown: the band stays hidden until values are filled in SITE.stats.
  if (items.length === 0) return null;
  return (
    <section className="border-y border-border bg-brand text-white">
      <div className={`mx-auto grid max-w-6xl grid-cols-1 divide-y divide-white/10 px-4 sm:divide-x sm:divide-y-0 sm:px-6 ${items.length === 3 ? "sm:grid-cols-3" : items.length === 2 ? "sm:grid-cols-2" : ""}`}>
        {items.map((i) => (
          <div key={i.l} className="flex items-baseline justify-center gap-3 py-7 sm:flex-col sm:items-center sm:gap-1">
            <span className="num text-3xl font-semibold text-[#22C55E] sm:text-4xl">{nf.format(i.v!)}</span>
            <span className="text-sm uppercase tracking-[0.12em] text-white/70">{i.l}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Features({ detailed = false }: { detailed?: boolean }) {
  const t = useTranslations("features");
  const messages = useMessages() as { features: { items: Record<string, { points: string[] }> } };
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
      {/* the features page already opens on this title (its page header) */}
      {!detailed && (
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h2>
          <p className="mt-4 text-lg text-muted">{t("subtitle")}</p>
        </div>
      )}
      <div className={`flex flex-col gap-20 lg:gap-28 ${detailed ? "" : "mt-16"}`}>
        {FEATURE_KEYS.map((k, i) => {
          const Icon = ICONS[k];
          const points = messages.features.items[k]?.points ?? [];
          return (
            <article key={k} className={`grid items-center gap-8 lg:grid-cols-2 lg:gap-14 ${i % 2 ? "lg:[&>*:first-child]:order-2" : ""}`}>
              <div>
                {/* the icon sits in the heading's line, without a tile of its own */}
                <h3 className="flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-[1.75rem]">
                  <Icon size={24} className="shrink-0 text-accent" aria-hidden />
                  {t(`items.${k}.title`)}
                </h3>
                <p className="mt-3 text-[17px] leading-relaxed text-muted">{t(`items.${k}.text`)}</p>
                <ul className={`mt-5 grid gap-2 ${detailed ? "" : "sm:grid-cols-1"}`}>
                  {points.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-[15px]">
                      <ShieldCheck size={17} className="mt-0.5 shrink-0 text-accent" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              {k === "layovers" ? (
                <LayoverShowcase alt={t(`items.${k}.title`)} />
              ) : CLIPS[k] ? (
                <div className="overflow-hidden rounded-2xl border border-border shadow-[0_40px_90px_-30px_rgba(2,6,23,.55)]">
                  <DemoClip name={CLIPS[k]!} label={t(`items.${k}.title`)} />
                </div>
              ) : (
                <BrowserFrame>
                  <Shot name={k} alt={t(`items.${k}.title`)} className="w-full" />
                </BrowserFrame>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function Faq() {
  const t = useTranslations("faq");
  const messages = useMessages() as { faq: { items: { q: string; a: string }[] } };
  return (
    <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <h2 className="text-center text-3xl font-bold tracking-tight">{t("title")}</h2>
      <div className="mt-10 divide-y divide-border rounded-xl border border-border">
        {messages.faq.items.map((item) => (
          <details key={item.q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-semibold">
              {item.q}
              <span className="text-xl text-accent transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 leading-relaxed text-muted">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function CtaBand() {
  const t = useTranslations("cta");
  return (
    <section className="px-4 pb-20 sm:px-6">
      <div className="hud-frame relative mx-auto max-w-6xl overflow-hidden rounded-2xl bg-brand px-6 py-14 text-center text-white sm:px-12">
        <h2 className="relative text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h2>
        <p className="relative mx-auto mt-3 max-w-xl text-white/75">{t("text")}</p>
        <Link href="/inscription" className="btn relative mt-8 min-h-12 !bg-[#22C55E] !px-6 text-base !text-[#0A1626] hover:!bg-[#86EFAC]">
          {t("button")} <ArrowRight size={18} aria-hidden />
        </Link>
        <StoreBadges className="relative mt-8 justify-center [&_.store-soon]:!text-white/70" />
      </div>
    </section>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="relative overflow-hidden border-b border-border">
      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
        {subtitle && <p className="mt-4 max-w-2xl text-lg text-muted">{subtitle}</p>}
      </div>
    </div>
  );
}

/** « Your logbook is yours »: what is promised on the home and pricing pages, and kept by the code. */
export function OwnershipBlock() {
  const t = useTranslations("ownership");
  const points = [t("export"), SITE.dataRegion === "eu" ? t("storageEu") : t("storage"), t("never"), t("shutdown")];
  return (
    <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <div className="rounded-2xl border border-accent/40 bg-accent/5 p-7">
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><ShieldCheck size={24} className="text-accent" aria-hidden /> {t("title")}</h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {points.map((p) => (
            <li key={p} className="flex gap-2.5 text-[15px]"><BadgeCheck size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />{p}</li>
          ))}
        </ul>
        <Link href="/vos-donnees" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-accent">{t("more")} <ArrowRight size={14} aria-hidden /></Link>
      </div>
    </section>
  );
}

/** Roster import: the formats really supported (no airline named: an airline's export can change). */
export function RosterFormats() {
  const t = useTranslations("rosterFormats");
  const items = t.raw("items") as string[];
  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight"><CalendarClock size={20} className="text-accent" aria-hidden /> {t("title")}</h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {items.map((x) => (
            <li key={x} className="flex gap-2 text-[15px]"><Check size={17} className="mt-0.5 shrink-0 text-accent" aria-hidden />{x}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">{t("note")}</p>
      </div>
    </section>
  );
}

/** « Switch without risk »: the offer in one box (home and pricing). */
export function OfferBox() {
  const t = useTranslations("offer");
  const items = t.raw("items") as string[];
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="rounded-2xl border-2 border-accent bg-accent/5 p-7">
        <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((x) => (
            <li key={x} className="flex gap-2.5 text-[15px] font-medium"><Check size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />{x}</li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link href="/inscription" className="btn btn-primary">{t("cta")}</Link>
          <span className="text-xs text-muted">{t("fine")}</span>
        </div>
      </div>
    </section>
  );
}
