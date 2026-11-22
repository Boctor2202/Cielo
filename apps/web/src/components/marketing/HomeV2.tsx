"use client";

import { AnimatePresence, motion, useInView, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { ArrowRight, BookOpenCheck, CalendarDays, CloudOff, FileDown, FileUser, Hotel, Radar, ScanSearch } from "lucide-react";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { FILM_CREDITS } from "@/lib/aircraft-visuals";
import { StoreBadges } from "./sections";
import { DashboardLive, FtlLive, ImportLive, JobsLive, LicencesLive, LogbookLive, MapLive, PhoneLive, SignatureLive } from "./live/screens";

const ease = [0.2, 0.8, 0.2, 1] as const;

/* ---------- Hero: the two films in a loop, the headline, the app coming to life ---------- */

const FILMS = ["day", "dusk"] as const;

/** The landing films one after the other, cross-faded, in a loop (only the poster with reduced motion). */
function HeroFilm() {
  const reduce = !!useReducedMotion();
  const [i, setI] = useState(0);
  const [hd, setHd] = useState(true);
  const refs = useRef<(HTMLVideoElement | null)[]>([]);
  useEffect(() => setHd(window.matchMedia("(min-width: 768px)").matches), []);
  useEffect(() => {
    if (reduce) return;
    const v = refs.current[i];
    if (!v) return;
    v.currentTime = 0;
    void v.play().catch(() => undefined);
  }, [i, reduce, hd]);
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#02040b]" aria-hidden>
      {FILMS.map((f, k) => (
        <video
          key={`${f}-${hd}`}
          ref={(el) => {
            refs.current[k] = el;
          }}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000"
          style={{ opacity: k === i ? 1 : 0 }}
          src={reduce ? undefined : `/immersive/hero/${f}-${hd ? "1080" : "720"}.mp4`}
          poster={`/immersive/hero/${f}-poster.webp`}
          muted
          playsInline
          preload={k === 0 ? "auto" : "metadata"}
          onEnded={() => setI((k + 1) % FILMS.length)}
        />
      ))}
      {/* the text side stays readable, the film breathes on the right */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,4,11,.88)_0%,rgba(2,4,11,.62)_42%,rgba(2,4,11,.15)_75%,rgba(2,4,11,.35)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[var(--bg)] to-transparent" />
    </div>
  );
}

function Headline({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <h1 className="mt-5 text-balance font-display text-[2.4rem] font-semibold leading-[1.04] tracking-[-0.02em] text-white sm:text-[3rem] lg:text-[3.15rem]" aria-label={text}>
      {words
        .map((w, i) => (
          <span key={i} className="inline-block overflow-hidden pb-[0.1em] align-bottom" aria-hidden>
            <motion.span className="inline-block motion-reduce:![transform:none]" initial={{ y: "110%" }} animate={{ y: 0 }} transition={{ duration: 0.7, delay: 0.1 + i * 0.05, ease }}>
              {w}
            </motion.span>
          </span>
        ))
        .flatMap((el, i) => (i < words.length - 1 ? [el, " "] : [el]))}
    </h1>
  );
}

/** The app screens over the film, tilting a little with the pointer. */
function HeroScreens() {
  const reduce = !!useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rx = useSpring(useTransform(y, [-0.5, 0.5], [5, -5]), { stiffness: 120, damping: 20 });
  const ry = useSpring(useTransform(x, [-0.5, 0.5], [-7, 7]), { stiffness: 120, damping: 20 });
  return (
    <motion.div
      className="relative hidden lg:block"
      style={{ perspective: 1400 }}
      onPointerMove={(e) => {
        if (reduce) return;
        const r = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - r.left) / r.width - 0.5);
        y.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={() => (x.set(0), y.set(0))}
    >
      <motion.div style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.4, ease }}>
        <DashboardLive className="w-full" />
        <motion.div className="absolute -bottom-24 -right-8 w-[190px]" initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.8, ease }} style={{ translateZ: 60 }}>
          <PhoneLive className="h-[370px]" />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function FilmCredits() {
  const t = useTranslations("immersive.credits");
  return (
    <details className="group absolute bottom-4 right-4 z-20 text-[11px] text-white/70">
      <summary className="cursor-pointer list-none rounded-full border border-white/10 bg-[#02040b]/50 px-3 py-1.5 backdrop-blur-md hover:text-white [&::-webkit-details-marker]:hidden">{t("title")}</summary>
      <ul className="absolute bottom-9 right-0 w-[min(88vw,360px)] space-y-1.5 rounded-xl border border-white/10 bg-[#02040b]/85 p-3 backdrop-blur-xl">
        {FILM_CREDITS.map((c) => (
          <li key={c.subject}>
            <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-white/30 hover:text-white">{c.subject}</a> · {c.author} · {c.license}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function HomeHero() {
  const th = useTranslations("hero");
  return (
    <section className="relative isolate min-h-[calc(100svh-4rem)] overflow-hidden">
      <HeroFilm />
      <div className="relative mx-auto grid min-h-[calc(100svh-4rem)] max-w-6xl items-center gap-12 px-4 pb-24 pt-10 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:pb-28">
        <div>
          <motion.p className="mono-label inline-flex items-center gap-2 rounded-full border border-[#22c55e]/40 bg-[#22c55e]/10 px-3 py-1.5 !text-[#86efac]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            <span className="blink h-1.5 w-1.5 rounded-full bg-[#22c55e]" aria-hidden />
            {th("eyebrow")}
          </motion.p>
          <Headline text={th("title")} />
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.6, ease }}>
            <p className="mt-5 max-w-lg text-pretty text-[17px] leading-relaxed text-white/85">{th("subtitle")}</p>
            <ul className="mt-5 flex max-w-xl flex-wrap gap-2">
              {(th.raw("features") as string[]).map((f) => (
                <li key={f} className="rounded-full border border-white/15 bg-[#02040b]/40 px-3 py-1 text-[13px] text-white/85 backdrop-blur-md">{f}</li>
              ))}
            </ul>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/inscription" className="btn min-h-12 !bg-[#22c55e] !px-6 text-base !text-[#0a1626] shadow-[0_10px_40px_-10px_#22c55e] hover:!bg-[#86efac]">
                {th("ctaTrial")} <ArrowRight size={18} aria-hidden />
              </Link>
              <Link href={{ pathname: "/connexion", query: { demo: "1" } }} className="btn min-h-12 border border-white/25 bg-[#02040b]/30 !px-6 text-base text-white backdrop-blur-md hover:border-white/60 hover:bg-white/10">
                {th("ctaDemo")}
              </Link>
            </div>
            <p className="mt-4 text-sm text-white/65">{th("note")}</p>
            <StoreBadges className="mt-6 [&_a]:!border-white/15 [&_a]:!bg-white [&_a]:!text-[#0a1626] [&_span]:!text-white/70" />
          </motion.div>
        </div>
        <HeroScreens />
      </div>
      <FilmCredits />
    </section>
  );
}

/* ---------- The main features: the screen stays, the steps scroll past ---------- */

type Step = { key: string; Screen: ComponentType<{ className?: string }> };
const STEPS: Step[] = [
  { key: "import", Screen: ImportLive },
  { key: "logbook", Screen: LogbookLive },
  { key: "map", Screen: MapLive },
  { key: "ftl", Screen: FtlLive },
  { key: "licences", Screen: LicencesLive },
  { key: "signature", Screen: SignatureLive },
  { key: "jobs", Screen: JobsLive },
];

function StepText({ k, i, active, onActive }: { k: string; i: number; active: boolean; onActive: (i: number) => void }) {
  const t = useTranslations("home2.steps");
  const ref = useRef<HTMLDivElement>(null);
  // the step crossing the middle of the screen is the one shown
  const inView = useInView(ref, { margin: "-48% 0px -48% 0px" });
  useEffect(() => {
    if (inView) onActive(i);
  }, [inView, i, onActive]);
  return (
    <div ref={ref} className="flex min-h-[54vh] items-center">
      <div className={`rounded-2xl border p-6 transition-colors duration-300 ${active ? "border-accent/50 bg-accent/[0.06]" : "border-transparent"}`}>
        <p className="mono-label !text-accent">{String(i + 1).padStart(2, "0")} · {t(`${k}.label`)}</p>
        <h3 className="mt-2 text-balance font-display text-[1.9rem] font-semibold leading-tight tracking-[-0.01em]">{t(`${k}.title`)}</h3>
        <p className="mt-3 max-w-md text-pretty leading-relaxed text-muted">{t(`${k}.text`)}</p>
      </div>
    </div>
  );
}

export function FeatureScroll() {
  const t = useTranslations("home2");
  const [active, setActive] = useState(0);
  const reduce = !!useReducedMotion();
  const Screen = STEPS[active]!.Screen;
  return (
    <section id="fonctionnalites" className="relative">
      <div className="mx-auto max-w-6xl px-4 pt-24 sm:px-6">
        <p className="mono-label">{t("label")}</p>
        <h2 className="mt-3 max-w-2xl text-balance font-display text-4xl font-semibold tracking-[-0.01em] sm:text-5xl">{t("title")}</h2>
        <p className="mt-4 max-w-2xl text-lg text-muted">{t("subtitle")}</p>
      </div>

      {/* large screens: the steps scroll, the screen stays */}
      <div className="mx-auto hidden max-w-6xl grid-cols-[0.9fr_1.25fr] gap-12 px-6 pb-24 lg:grid">
        <div>
          {STEPS.map((s, i) => (
            <StepText key={s.key} k={s.key} i={i} active={i === active} onActive={setActive} />
          ))}
        </div>
        <div>
          <div className="sticky top-[calc(50vh-230px)]">
            <div className="relative min-h-[420px]">
              <AnimatePresence initial={false}>
                <motion.div key={active} className="absolute inset-x-0 top-0" initial={reduce ? false : { opacity: 0, y: 28, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reduce ? undefined : { opacity: 0, y: -28, scale: 0.98 }} transition={{ duration: 0.4, ease }}>
                  <Screen className="w-full" />
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="mt-6 flex gap-1.5" aria-hidden>
              {STEPS.map((s, i) => (
                <span key={s.key} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= active ? "bg-accent" : "bg-border"}`} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* phones and tablets: each step with its screen */}
      <div className="mx-auto max-w-2xl space-y-16 px-4 pb-20 pt-10 sm:px-6 lg:hidden">
        {STEPS.map((s, i) => (
          <MobileStep key={s.key} k={s.key} i={i} Screen={s.Screen} />
        ))}
      </div>
    </section>
  );
}

function MobileStep({ k, i, Screen }: { k: string; i: number; Screen: Step["Screen"] }) {
  const t = useTranslations("home2.steps");
  return (
    <div>
      <p className="mono-label !text-accent">{String(i + 1).padStart(2, "0")} · {t(`${k}.label`)}</p>
      <h3 className="mt-2 font-display text-2xl font-semibold">{t(`${k}.title`)}</h3>
      <p className="mt-2 text-muted">{t(`${k}.text`)}</p>
      <Screen className="mt-6 w-full" />
    </div>
  );
}

/* ---------- And everything else ---------- */

const MORE = [
  { key: "audit", icon: ScanSearch },
  { key: "offline", icon: CloudOff },
  { key: "exports", icon: FileDown },
  { key: "cv", icon: FileUser },
  { key: "roster", icon: CalendarDays },
  { key: "layovers", icon: Hotel },
  { key: "radar", icon: Radar },
  { key: "badges", icon: BookOpenCheck },
] as const;

export function MoreFeatures() {
  const t = useTranslations("home2.more");
  return (
    <section className="border-t border-border bg-surface/40">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <h2 className="max-w-2xl text-balance font-display text-4xl font-semibold tracking-[-0.01em]">{t("title")}</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MORE.map(({ key, icon: Icon }, i) => (
            <motion.div key={key} className="card group relative overflow-hidden p-5 transition-shadow duration-200 hover:shadow-xl" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.4, delay: (i % 4) * 0.06, ease }}>
              <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" aria-hidden />
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/12 text-accent transition-transform duration-200 group-hover:-translate-y-0.5"><Icon size={20} aria-hidden /></span>
              <h3 className="mt-4 font-semibold">{t(`${key}.t`)}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{t(`${key}.d`)}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- On iPhone ---------- */

export function MobileApp() {
  const t = useTranslations("home2.mobile");
  const ref = useRef<HTMLDivElement>(null);
  const reduce = !!useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const r1 = useTransform(scrollYProgress, [0, 0.5], reduce ? [-6, -6] : [-14, -6]);
  const r2 = useTransform(scrollYProgress, [0, 0.5], reduce ? [5, 5] : [14, 5]);
  const y2 = useTransform(scrollYProgress, [0, 0.5], reduce ? [0, 0] : [60, 0]);
  return (
    <section ref={ref} className="overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2">
        <div>
          <p className="mono-label">{t("label")}</p>
          <h2 className="mt-3 text-balance font-display text-4xl font-semibold tracking-[-0.01em] sm:text-5xl">{t("title")}</h2>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-muted">{t("text")}</p>
          <ul className="mt-6 space-y-2 text-[15px]">
            {(t.raw("points") as string[]).map((p) => (
              <li key={p} className="flex gap-2"><span className="text-accent">✓</span> {p}</li>
            ))}
          </ul>
          <StoreBadges className="mt-8" />
        </div>
        <div className="relative mx-auto h-[540px] w-full max-w-[460px]">
          <motion.div className="absolute left-0 top-6 w-[220px]" style={{ rotate: r1 }}>
            <PhoneLive className="h-[460px]" />
          </motion.div>
          <motion.div className="absolute right-0 top-0 w-[220px]" style={{ rotate: r2, y: y2 }}>
            <PhoneLive className="h-[460px]" variant="map" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
