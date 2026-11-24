"use client";

import { AnimatePresence, motion, useInView, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { FILM_CREDITS } from "@/lib/aircraft-visuals";
import { StoreBadges } from "./sections";
import { LogbookLive, MapLive } from "./live/screens";
import { ClipFrame, type ClipName } from "./DemoClip";

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
      <div className="absolute inset-0 hidden bg-[linear-gradient(90deg,rgba(2,4,11,.88)_0%,rgba(2,4,11,.62)_42%,rgba(2,4,11,.15)_75%,rgba(2,4,11,.35)_100%)] lg:block" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,4,11,.9)_0%,rgba(2,4,11,.8)_55%,rgba(2,4,11,.55)_100%)] lg:hidden" />
      <div className="absolute inset-x-0 bottom-0 hidden h-40 bg-gradient-to-t from-[var(--bg)] to-transparent lg:block" />
    </div>
  );
}

function Headline({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <h1 className="mt-2 text-balance font-display text-[2.5rem] font-bold leading-[1.02] tracking-[-0.02em] text-white sm:text-[3.4rem] lg:text-[3.9rem]" aria-label={text}>
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
      <motion.div className="mx-auto w-[300px]" style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.4, ease }}>
        <PhoneCycle />
      </motion.div>
    </motion.div>
  );
}

function FilmCredits() {
  const t = useTranslations("immersive.credits");
  return (
    <details className="group absolute left-4 top-3 z-20 text-[11px] text-white/70 lg:bottom-4 lg:left-auto lg:right-4 lg:top-auto">
      <summary className="cursor-pointer list-none rounded-full border border-white/10 bg-[#02040b]/50 px-3 py-1.5 backdrop-blur-md hover:text-white [&::-webkit-details-marker]:hidden">{t("title")}</summary>
      <ul className="absolute left-0 top-9 w-[min(88vw,360px)] lg:bottom-9 lg:left-auto lg:right-0 lg:top-auto space-y-1.5 rounded-xl border border-white/10 bg-[#02040b]/85 p-3 backdrop-blur-xl">
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
    <section className="relative isolate overflow-hidden lg:min-h-[calc(100svh-4rem)]">
      <HeroFilm />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 sm:px-6 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[1.35fr_1fr] lg:pb-28 lg:pt-10">
        <div>
          <Headline text={th("title")} />
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.6, ease }}>
            <p className="mt-5 max-w-lg text-pretty text-[17px] leading-relaxed text-white/85">{th("subtitle")}</p>
            <ul className="mt-5 hidden max-w-xl flex-wrap gap-2 sm:flex">
              {(th.raw("features") as string[]).map((f) => (
                <li key={f} className="rounded-full border border-white/15 bg-[#02040b]/40 px-3 py-1 text-[13px] text-white/85 backdrop-blur-md">{f}</li>
              ))}
            </ul>
            <div className="mt-7 flex gap-3 [&>a]:flex-1 sm:[&>a]:flex-none">
              <Link href="/inscription" className="btn min-h-12 !bg-[#22c55e] !px-6 text-base !text-[#0a1626] hover:!bg-[#86efac]">
                {th("ctaTrial")} <ArrowRight size={18} aria-hidden />
              </Link>
              <Link href={{ pathname: "/connexion", query: { demo: "1" } }} className="btn min-h-12 border border-white/25 bg-[#02040b]/30 !px-6 text-base text-white backdrop-blur-md hover:border-white/60 hover:bg-white/10">
                {th("ctaDemo")}
              </Link>
            </div>
            <p className="mt-4 text-sm text-white/65">{th("note")}</p>
            <StoreBadges className="mt-6 hidden sm:flex [&_.store-soon]:!text-white/70" />
          </motion.div>
          {/* on a phone the product shows in the first screen: the app rises from the bottom */}
          <motion.div className="mx-auto mt-8 h-[316px] w-[250px] overflow-hidden pt-4 sm:h-[396px] sm:w-[300px] lg:hidden" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.5, ease }}>
            <PhoneCycle />
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
/** a step shown by a clip filmed on the real app */
function clip(name: ClipName): Step["Screen"] {
  function Clip({ className }: { className?: string }) {
    const t = useTranslations("home2.steps");
    return <ClipFrame name={name} label={t(`${name === "sign" ? "signature" : name}.title`)} className={className} />;
  }
  return Clip;
}
const STEPS: Step[] = [
  { key: "import", Screen: clip("import") },
  { key: "logbook", Screen: LogbookLive },
  { key: "map", Screen: MapLive },
  { key: "ftl", Screen: clip("ftl") },
  { key: "licences", Screen: clip("licences") },
  { key: "signature", Screen: clip("sign") },
  { key: "jobs", Screen: clip("jobs") },
];

/** Invisible markers, one per step: the one crossing the middle of the screen sets the step shown. */
function StepMarker({ i, onActive }: { i: number; onActive: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-48% 0px -48% 0px" });
  useEffect(() => {
    if (inView) onActive(i);
  }, [inView, i, onActive]);
  return <div ref={ref} id={`step-${i}`} className="h-[54vh]" aria-hidden />;
}

/** Short facts of a step, written "a|b|c" in the messages. */
function Tags({ k }: { k: string }) {
  const t = useTranslations("home2.steps");
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {t(`${k}.tags`)
        .split("|")
        .map((x) => (
          <span key={x} className="rounded-full border border-border bg-surface-2/70 px-3 py-1 text-xs font-semibold text-text/85">{x}</span>
        ))}
    </div>
  );
}

/** The list of steps: a sober list between hairlines, only the step on screen open. */
function StepList({ active }: { active: number }) {
  const t = useTranslations("home2.steps");
  const reduce = !!useReducedMotion();
  const go = (i: number) => document.getElementById(`step-${i}`)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  return (
    <ol className="border-b border-border">
      {STEPS.map((s, i) => {
        const on = i === active;
        return (
          <li key={s.key} className="border-t border-border">
            <button type="button" onClick={() => go(i)} className="group flex w-full items-baseline gap-4 py-5 text-left" aria-current={on ? "step" : undefined}>
              <span className={`text-balance font-sans font-bold leading-[1.15] tracking-[-0.02em] transition-all duration-300 ${on ? "text-[1.9rem] text-text" : "text-xl text-text/40 group-hover:text-text/70"}`}>{t(`${s.key}.title`)}</span>
            </button>
            <AnimatePresence initial={false}>
              {on && (
                <motion.div key="body" initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={reduce ? undefined : { height: 0, opacity: 0 }} transition={{ duration: 0.35, ease }} className="overflow-hidden">
                  <div className="pb-6">
                    <p className="max-w-md text-pretty leading-relaxed text-muted">{t(`${s.key}.text`)}</p>
                    <Tags k={s.key} />
                    <div className="mt-5 h-0.5 overflow-hidden rounded-full bg-border" aria-hidden>
                      <motion.div className="h-full rounded-full bg-gradient-to-r from-accent to-[#4ade80]" initial={false} animate={{ width: `${((i + 1) / STEPS.length) * 100}%` }} transition={{ duration: 0.5, ease }} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ol>
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
        <h2 className="mt-3 max-w-2xl text-balance font-display text-4xl font-semibold tracking-[-0.01em] sm:text-5xl">{t("title")}</h2>
        <p className="mt-4 max-w-2xl text-lg text-muted">{t("subtitle")}</p>
      </div>

      {/* large screens: the list and the screen stay, the page scrolls past one marker per step */}
      <div className="mx-auto hidden max-w-6xl grid-cols-[0.9fr_1.25fr] gap-12 px-6 pb-24 pt-10 lg:grid">
        <div className="relative">
          {STEPS.map((s, i) => (
            <StepMarker key={s.key} i={i} onActive={setActive} />
          ))}
          <div className="absolute inset-0">
            <div className="sticky top-[max(6rem,calc(50vh-300px))]">
              <StepList active={active} />
            </div>
          </div>
        </div>
        <div>
          <div className="sticky top-[max(6rem,calc(50vh-230px))]">
            <div className="relative min-h-[420px]">
              <AnimatePresence initial={false}>
                <motion.div key={active} className="absolute inset-x-0 top-0" initial={reduce ? false : { opacity: 0, y: 28, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reduce ? undefined : { opacity: 0, y: -28, scale: 0.98 }} transition={{ duration: 0.4, ease }}>
                  <Screen className="w-full" />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* phones and tablets: each step with its screen */}
      <div className="mx-auto max-w-2xl px-4 pb-20 pt-10 sm:px-6 lg:hidden">
        {STEPS.map((s, i) => (
          <MobileStep key={s.key} k={s.key} Screen={s.Screen} />
        ))}
      </div>
    </section>
  );
}

function MobileStep({ k, Screen }: { k: string; Screen: Step["Screen"] }) {
  const t = useTranslations("home2.steps");
  return (
    <div className="border-t border-border py-10">
      <h3 className="text-balance font-sans text-2xl font-bold leading-tight tracking-[-0.02em]">{t(`${k}.title`)}</h3>
      <p className="mt-3 text-pretty leading-relaxed text-muted">{t(`${k}.text`)}</p>
      <Tags k={k} />
      <Screen className="mt-6 w-full" />
    </div>
  );
}

/** A real screenshot of the iPhone app in a phone frame (names and company details removed). */
const PHONE_SCREENS = [
  { src: "/immersive/phones/dashboard.webp", alt: "dashboard" },
  { src: "/immersive/phones/logbook.webp", alt: "logbook" },
  { src: "/immersive/phones/radar.webp", alt: "radar" },
] as const;

/** The phone alive: the app's real screens one after the other, the phone floating a little. */
function PhoneCycle() {
  const t = useTranslations("home2.phones");
  const reduce = !!useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setI((k) => (k + 1) % PHONE_SCREENS.length), 3600);
    return () => clearInterval(id);
  }, [reduce]);
  return (
    <motion.div animate={reduce ? undefined : { y: [0, -10, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>
      <div className="relative overflow-hidden rounded-[36px] border-[7px] border-[#0b0b0e] bg-[#0b0b0e] shadow-[0_40px_80px_-25px_rgba(0,0,0,.7)]">
        {/* the first screen holds the frame's size; the others slide over it */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={PHONE_SCREENS[0].src} alt="" width={736} height={1600} className="invisible block h-auto w-full" aria-hidden />
        <AnimatePresence initial={false}>
          <motion.img
            key={i}
            src={PHONE_SCREENS[i].src}
            alt={t(PHONE_SCREENS[i].alt)}
            width={736}
            height={1600}
            decoding="async"
            className="absolute inset-0 block h-full w-full rounded-[29px] object-cover"
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: 0.7, ease }}
          />
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/** The real app filling a flight from ADS-B, filmed in the page's language; the still frame with reduced motion. */
export function AppDemo() {
  const t = useTranslations("home2.demo");
  const locale = useLocale();
  const lang = locale === "fr" ? "fr" : "en";
  const reduce = !!useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const near = useInView(ref, { once: true, margin: "300px 0px" });
  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)] lg:gap-14">
        <div>
          <h2 className="text-balance font-display text-3xl tracking-[-0.02em] sm:text-4xl">{t("title")}</h2>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-muted">{t("text")}</p>
        </div>
        <div ref={ref} className="overflow-hidden rounded-2xl border border-border bg-[#0b1626] shadow-[0_40px_90px_-30px_rgba(2,6,23,.55)]">
          <video
            className="block aspect-[1140/900] h-auto w-full"
            poster={`/immersive/demo/adsb-${lang}-poster.webp`}
            autoPlay={!reduce}
            muted
            loop
            playsInline
            preload="none"
            aria-label={t("video")}
          >
            {near && !reduce && (
              <>
                <source src={`/immersive/demo/adsb-${lang}-1280.mp4`} type="video/mp4" media="(min-width: 768px)" />
                <source src={`/immersive/demo/adsb-${lang}-720.mp4`} type="video/mp4" />
              </>
            )}
          </video>
        </div>
      </div>
    </section>
  );
}

function PhoneShot({ src, alt }: { src: string; alt: "dashboard" | "logbook" | "radar" }) {
  const t = useTranslations("home2.phones");
  return (
    <div className="overflow-hidden rounded-[36px] border-[7px] border-[#0b0b0e] bg-[#0b0b0e] shadow-[0_40px_80px_-25px_rgba(0,0,0,.7)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={t(alt)} width={736} height={1600} loading="lazy" decoding="async" className="block h-auto w-full rounded-[29px]" />
    </div>
  );
}

/* ---------- And everything else ---------- */

const MORE = ["audit", "roster", "offline", "layovers", "exports", "radar", "cv", "badges"] as const;

/** Everything else, as a list between hairlines: the name, then what it does. */
export function MoreFeatures() {
  const t = useTranslations("home2.more");
  return (
    <section className="border-t border-border bg-surface/40">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <h2 className="max-w-2xl text-balance font-display text-3xl tracking-[-0.02em] sm:text-4xl">{t("title")}</h2>
        <p className="mt-3 max-w-xl text-lg text-muted">{t("lead")}</p>
        <dl className="mt-10 grid gap-x-16 border-b border-border sm:grid-cols-2 sm:border-b-0">
          {MORE.map((key, i) => (
            <div key={key} className={`grid gap-1 border-t border-border py-5 sm:grid-cols-[minmax(0,13rem)_1fr] sm:gap-5 ${i >= MORE.length - 2 ? "sm:border-b" : ""}`}>
              <dt className="font-bold">{t(`${key}.t`)}</dt>
              <dd className="text-[15.5px] leading-relaxed text-muted">{t(`${key}.d`)}</dd>
            </div>
          ))}
        </dl>
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
          <h2 className="mt-3 text-balance font-display text-4xl font-semibold tracking-[-0.01em] sm:text-5xl">{t("title")}</h2>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-muted">{t("text")}</p>
          <ul className="mt-6 space-y-2 text-[15px]">
            {(t.raw("points") as string[]).map((p) => (
              <li key={p} className="flex gap-2"><span className="text-accent">✓</span> {p}</li>
            ))}
          </ul>
          <StoreBadges className="mt-8" />
        </div>
        <div className="relative mx-auto h-[420px] w-full max-w-[360px] sm:h-[540px] sm:max-w-[460px]">
          <motion.div className="absolute left-0 top-6 w-[48%] sm:w-[220px]" style={{ rotate: r1 }}>
            <PhoneShot src="/immersive/phones/logbook.webp" alt="logbook" />
          </motion.div>
          <motion.div className="absolute right-0 top-0 w-[48%] sm:w-[220px]" style={{ rotate: r2, y: y2 }}>
            <PhoneShot src="/immersive/phones/radar.webp" alt="radar" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
