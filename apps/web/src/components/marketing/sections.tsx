import { useLocale, useMessages, useTranslations } from "next-intl";
import { ArrowRight, BadgeCheck, Briefcase, CalendarClock, CloudOff, FileDown, FileUser, Lock, Map, PenLine, ScanSearch, ShieldCheck, Upload } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { SITE } from "@/config/site";
import { BrowserFrame, LaptopFrame, PhoneFrame, Shot } from "./Shot";
import { FeatureTabs } from "./FeatureTabs";
import { Reveal } from "./Reveal";

export const FEATURE_KEYS = ["logbook", "import", "audit", "licenses", "ftl", "stats", "signature", "offline", "jobs", "cv"] as const;
const ICONS = { logbook: FileDown, import: Upload, audit: ScanSearch, licenses: BadgeCheck, ftl: CalendarClock, stats: Map, signature: PenLine, offline: CloudOff, jobs: Briefcase, cv: FileUser };

export function Hero() {
  const t = useTranslations("hero");
  return (
    <section className="horizon relative overflow-hidden">
      <div className="chart-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_25%,transparent_70%)]" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1fr_1.12fr] lg:pb-28 lg:pt-20">
        <div>
          <p className="mono-label inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/8 px-3 py-1.5">
            <span className="blink h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
            {t("eyebrow")}
          </p>
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
            <p className="mono-label !text-[10px]">{t("readoutNight")}</p>
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
        <p className="mono-label">{t("label")}</p>
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
          <p className="mono-label">{ts("label")}</p>
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
        <p className="mono-label">{t("label")}</p>
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

export function StoreBadges({ className = "" }: { className?: string }) {
  const t = useTranslations("hero");
  // Replace with the official Apple / Google badges (see their marketing guidelines) once the apps are live.
  const badge = "flex h-12 items-center gap-2.5 rounded-xl border border-border bg-text px-4 text-bg transition-opacity hover:opacity-90";
  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      <a href={SITE.stores.appStoreUrl} className={badge} aria-label={t("appStore")}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.7-4.1zM13.9 5c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.1 1.1.1 2.3-.6 3-1.5z" />
        </svg>
        <span className="flex flex-col leading-tight">
          <span className="text-[10px] opacity-80">{SITE.stores.appStoreUrl === "#" ? t("comingSoon") : "Download on the"}</span>
          <span className="text-[15px] font-semibold">App Store</span>
        </span>
      </a>
      <a href={SITE.stores.playStoreUrl} className={badge} aria-label={t("playStore")}>
        <svg width="18" height="20" viewBox="0 0 22 24" aria-hidden>
          <path d="M1 1.2 12.4 12 1 22.8c-.3-.2-.5-.6-.5-1.1V2.3c0-.5.2-.9.5-1.1z" fill="#22C55E" />
          <path d="m16.2 8.3-3.8 3.7L1 1.2l.2-.1c.4-.2.9-.2 1.4.1z" fill="#4ADE80" />
          <path d="m16.2 15.7-13.6 7.8c-.5.3-1 .3-1.4.1L1 22.8 12.4 12z" fill="#F87171" />
          <path d="m20.6 13.3-4.4 2.4L12.4 12l3.8-3.7 4.4 2.4c.9.6.9 2 0 2.6z" fill="#FBBF24" />
        </svg>
        <span className="flex flex-col leading-tight">
          <span className="text-[10px] opacity-80">{SITE.stores.playStoreUrl === "#" ? t("comingSoon") : "Get it on"}</span>
          <span className="text-[15px] font-semibold">Google Play</span>
        </span>
      </a>
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
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h2>
        <p className="mt-4 text-lg text-muted">{t("subtitle")}</p>
      </div>
      <div className="mt-16 flex flex-col gap-20 lg:gap-28">
        {FEATURE_KEYS.map((k, i) => {
          const Icon = ICONS[k];
          const points = messages.features.items[k]?.points ?? [];
          return (
            <article key={k} className={`grid items-center gap-8 lg:grid-cols-2 lg:gap-14 ${i % 2 ? "lg:[&>*:first-child]:order-2" : ""}`}>
              <div>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/12 text-accent">
                  <Icon size={20} />
                </span>
                <p className="label-caps mt-4 num">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="mt-1 text-2xl font-bold tracking-tight sm:text-[1.75rem]">{t(`items.${k}.title`)}</h3>
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
              <BrowserFrame>
                <Shot name={k} alt={t(`items.${k}.title`)} className="w-full" />
              </BrowserFrame>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function Testimonials() {
  const t = useTranslations("testimonials");
  return (
    <section className="border-y border-border bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="text-center text-3xl font-bold tracking-tight">{t("title")}</h2>
        <p className="mt-3 text-center text-muted">{t("empty")}</p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            // Empty slots on purpose: real, consented testimonials only.
            <figure key={i} className="flex min-h-40 flex-col justify-between rounded-xl border border-dashed border-border bg-bg p-6" aria-label={t("slot")}>
              <div className="space-y-2">
                <div className="h-2.5 w-11/12 rounded bg-surface-2" />
                <div className="h-2.5 w-10/12 rounded bg-surface-2" />
                <div className="h-2.5 w-7/12 rounded bg-surface-2" />
              </div>
              <figcaption className="mt-6 flex items-center gap-3">
                <span className="h-9 w-9 rounded-full bg-surface-2" />
                <span className="text-xs text-muted">{t("slot")}</span>
              </figcaption>
            </figure>
          ))}
        </div>
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
        <div className="chart-grid pointer-events-none absolute inset-0 opacity-60 [--grid:rgba(34,211,238,0.08)]" />
        <h2 className="relative text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h2>
        <p className="relative mx-auto mt-3 max-w-xl text-white/75">{t("text")}</p>
        <Link href="/inscription" className="btn relative mt-8 min-h-12 !bg-[#22C55E] !px-6 text-base !text-[#0A1626] hover:!bg-[#86EFAC]">
          {t("button")} <ArrowRight size={18} aria-hidden />
        </Link>
        <StoreBadges className="relative mt-8 justify-center [&_a]:!border-white/20 [&_a]:!bg-white [&_a]:!text-[#0A1626]" />
      </div>
    </section>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="relative overflow-hidden border-b border-border">
      <div className="chart-grid pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
        {subtitle && <p className="mt-4 max-w-2xl text-lg text-muted">{subtitle}</p>}
      </div>
    </div>
  );
}
