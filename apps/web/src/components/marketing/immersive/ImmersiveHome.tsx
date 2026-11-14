"use client";

import { ArrowRight, ChevronDown } from "lucide-react";
import {
  motion, useMotionTemplate, useMotionValue, useMotionValueEvent, useScroll, useSpring, useTransform, type MotionValue,
} from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AIRCRAFT_TYPES } from "@cielo/reference-data";
import { Link } from "@/i18n/navigation";
import { SKY_CREDITS, src, srcSet, type AircraftVisual, type Img } from "@/lib/aircraft-visuals";
import { useHomeAircraft, type HomeAircraft } from "@/lib/home-aircraft";
import { StoreBadges } from "../sections";
import { AircraftPicker } from "./AircraftPicker";
import { createReadouts, readoutsAt, type Readouts } from "./timeline";
import type { FlightScene } from "./scene";

const CHAPTER_VH = 112;
const CHAPTER_COUNT = 5;

const fmtClock = (m: number) => {
  const mm = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(mm / 60)).padStart(2, "0")}:${String(mm % 60).padStart(2, "0")}Z`;
};
const fmtDur = (m: number) => `${Math.floor(m / 60)}:${String(Math.round(m) % 60).padStart(2, "0")}`;
const fmtElev = (e: number) => `${e >= 0 ? "+" : "−"}${Math.abs(e).toFixed(1)}°`;

/**
 * Immersive home: a sticky stage of depth layers (sky, the pilot's own aircraft, haze, 3D photo cards, globe)
 * driven by scroll with Motion. The story itself is real DOM text on top, so it stays indexable and readable
 * by screen readers; with reduced motion the layers simply cross-fade, without parallax or tilt.
 */
export function ImmersiveHome() {
  const t = useTranslations("immersive");
  const th = useTranslations("hero");
  const locale = useLocale() as "fr" | "en";
  // Read after mount so the server and first client render match (no hydration mismatch)
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduce(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const aircraft = useHomeAircraft();
  const { visual } = aircraft;

  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<FlightScene | null>(null);
  const readouts = useRef<Readouts>(createReadouts());
  const [globeReady, setGlobeReady] = useState(false);

  // Scroll progress over the whole story, with ~1 s of lag for a cinematic scrub
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const sprung = useSpring(scrollYProgress, { stiffness: 70, damping: 22, restDelta: 0.0004 });
  const p = reduce ? scrollYProgress : sprung;

  // Pointer parallax (desktop): −1..1 on each axis
  const mx = useSpring(useMotionValue(0), { stiffness: 60, damping: 18 });
  const my = useSpring(useMotionValue(0), { stiffness: 60, damping: 18 });
  const onPointerMove = (e: React.PointerEvent) => {
    if (reduce || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width) * 2 - 1);
    my.set(((e.clientY - r.top) / r.height) * 2 - 1);
  };

  useMotionValueEvent(p, "change", (v) => {
    readoutsAt(v, readouts.current);
    // the globe scene has its own 0.55–1 timeline: map the "routes" chapter onto it
    sceneRef.current?.setProgress(0.55 + Math.min(1, Math.max(0, (v - 0.58) / 0.28)) * 0.45);
  });

  // Globe (Three.js), loaded lazily and only rendered while on screen
  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;
    let disposed = false;
    let inView = true;
    let scene: FlightScene | null = null;
    readoutsAt(p.get(), readouts.current);
    (async () => {
      const mod = await import("./scene");
      if (disposed || !mod.webglAvailable()) return;
      let dots: number[] = [];
      try {
        dots = await (await fetch("/data/globe-dots.json")).json();
      } catch {}
      if (disposed) return;
      try {
        scene = new mod.FlightScene(canvas, { reducedMotion: reduce, mobile: window.innerWidth < 768, globeDots: dots });
      } catch {
        return;
      }
      sceneRef.current = scene;
      if (inView && document.visibilityState === "visible") scene.start();
      setGlobeReady(true);
    })();
    const io = new IntersectionObserver(([e]) => {
      inView = !!e?.isIntersecting;
      if (inView && document.visibilityState === "visible") scene?.start();
      else scene?.stop();
    });
    io.observe(section);
    const vis = () => (document.visibilityState === "visible" && inView ? scene?.start() : scene?.stop());
    document.addEventListener("visibilitychange", vis);
    const ro = new ResizeObserver(() => scene?.resize());
    ro.observe(canvas.parentElement!);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", vis);
      io.disconnect();
      ro.disconnect();
      scene?.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  /* ---------- layer choreography (pure functions of scroll progress) ---------- */
  const skyX = useTransform(mx, [-1, 1], ["1.2%", "-1.2%"]);
  const skyY = useTransform(p, [0, 1], ["0%", "-5%"]);
  const dayOpacity = useTransform(p, [0.14, 0.3], [1, 0]);
  const dayScale = useTransform(p, [0, 0.3], reduce ? [1.06, 1.06] : [1.12, 1.02]);
  const duskOpacity = useTransform(p, [0.12, 0.26, 0.34, 0.44], [0, 1, 1, 0]);
  const nightOpacity = useTransform(p, [0.3, 0.42], [0, 1]);
  const nightScale = useTransform(p, [0.3, 0.84], reduce ? [1.06, 1.06] : [1.14, 1.02]);
  const dawnOpacity = useTransform(p, [0.86, 0.94], [0, 1]);
  const dawnScale = useTransform(p, [0.86, 1], reduce ? [1.06, 1.06] : [1.16, 1.04]);
  const hazeX = useTransform(p, [0, 0.4], ["8%", "-70%"]);
  const hazeOpacity = useTransform(p, [0, 0.3, 0.42], [0.55, 0.4, 0]);
  const globeOpacity = useTransform(p, [0.58, 0.66, 0.84, 0.9], [0, 1, 1, 0]);
  const dim = useTransform(p, [0.4, 0.5, 0.58, 0.64], [0, 0.45, 0.45, 0]);

  const chapters = t.raw("chapters") as string[];
  const type = AIRCRAFT_TYPES.find((x) => x.icao === aircraft.icao);
  const name = aircraft.label;

  return (
    <section ref={sectionRef} className="relative bg-[#03060f] text-white" style={{ height: `${CHAPTER_VH * CHAPTER_COUNT}vh` }}>
      {/* ---------- Stage ---------- */}
      <div className="sticky top-0 h-[100svh] overflow-hidden [perspective:1400px]" role="img" aria-label={t("canvasLabel")} onPointerMove={onPointerMove}>
        <Sky name="day" style={{ opacity: dayOpacity, scale: dayScale, x: skyX, y: skyY }} priority position="50% 62%" />
        <Sky name="dusk" style={{ opacity: duskOpacity, x: skyX, y: skyY, scale: 1.06 }} position="50% 55%" />
        <Sky name="night" style={{ opacity: nightOpacity, scale: nightScale, x: skyX }} position="50% 40%" />
        <motion.div className="absolute inset-0 bg-[#03060f]" style={{ opacity: dim }} aria-hidden />

        {/* Globe chapter */}
        <motion.div className="absolute inset-0" style={{ opacity: globeOpacity }} aria-hidden>
          <div className="immersive-space absolute inset-0" />
          <canvas ref={canvasRef} className={`absolute inset-0 block h-full w-full transition-opacity duration-700 ${globeReady ? "opacity-100" : "opacity-0"}`} />
        </motion.div>

        <Sky name="dusk" style={{ opacity: dawnOpacity, scale: dawnScale, x: skyX }} position="50% 55%" />

        {/* The pilot's aircraft: fades in once we know which one to show */}
        <motion.div className="absolute inset-0" initial={false} animate={{ opacity: aircraft.ready ? 1 : 0 }} transition={{ duration: 0.6 }} aria-hidden>
          <AircraftLayers key={visual.id} visual={visual} p={p} mx={mx} my={my} reduce={reduce} locale={locale} />
        </motion.div>

        {/* Foreground haze passes faster than the aircraft: depth */}
        {!reduce && (
          <motion.div className="pointer-events-none absolute inset-y-0 left-0 w-[220%]" style={{ x: hazeX, opacity: hazeOpacity }} aria-hidden>
            <div className="absolute bottom-[-8%] left-[8%] h-[46%] w-[34%] rounded-[50%] bg-white/60 blur-[90px]" />
            <div className="absolute bottom-[-14%] left-[46%] h-[52%] w-[30%] rounded-[50%] bg-white/50 blur-[110px]" />
            <div className="absolute bottom-[-6%] left-[78%] h-[38%] w-[24%] rounded-[50%] bg-white/40 blur-[80px]" />
          </motion.div>
        )}

        {/* Scrims, vignette and grain keep the text readable and the image filmic */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_60%_45%,transparent_52%,rgba(3,6,15,.6))]" aria-hidden />
        <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[58%] bg-gradient-to-r from-[#03060f]/75 via-[#03060f]/30 to-transparent md:block" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[62%] bg-gradient-to-b from-[#03060f]/85 to-transparent md:hidden" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#03060f]/85 to-transparent" aria-hidden />
        <div className="immersive-grain pointer-events-none absolute inset-0" aria-hidden />

        <FlightStrip readouts={readouts} />
        <ProgressRail readouts={readouts} labels={chapters} />
        <Credits visual={visual} />
      </div>

      {/* ---------- Story ---------- */}
      <div className="relative z-10 -mt-[100svh]">
        <Chapter align="left" eager>
          <p className="mono-label inline-flex items-center gap-2 rounded-full border border-[#22d3ee]/40 bg-[#22d3ee]/10 px-3 py-1.5 !text-[#67e8f9]">
            <span className="blink h-1.5 w-1.5 rounded-full bg-[#22d3ee]" aria-hidden />
            {th("eyebrow")}
          </p>
          <SplitTitle text={th("title")} />
          <p className="mt-6 max-w-lg text-pretty text-lg leading-relaxed text-white/80">{th("subtitle")}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/inscription" className="btn min-h-12 !bg-[#22d3ee] !px-6 text-base !text-[#0a1626] shadow-[0_10px_40px_-10px_#22d3ee] hover:!bg-[#67e8f9]">
              {th("ctaTrial")} <ArrowRight size={18} aria-hidden />
            </Link>
            <Link href={{ pathname: "/connexion", query: { demo: "1" } }} className="btn min-h-12 border border-white/25 !px-6 text-base text-white hover:border-white/60 hover:bg-white/10">
              {th("ctaDemo")}
            </Link>
          </div>
          <AircraftPicker aircraft={aircraft} />
          <StoreBadges className="mt-7 max-sm:hidden [&_a]:!border-white/15 [&_a]:!bg-white [&_a]:!text-[#0a1626]" />
          <p className="mt-10 flex items-center gap-2 text-sm text-white/60" aria-hidden>
            <ChevronDown size={16} className="animate-bounce motion-reduce:animate-none" /> {t("scroll")}
          </p>
        </Chapter>

        <Chapter align="right">
          <Panel>
            <Label>{t("c1.label")}</Label>
            <Title>{t("c1.title")}</Title>
            <p className="mt-4 leading-relaxed text-white/80">{t("c1.text")}</p>
            <NightHud readouts={readouts} />
          </Panel>
        </Chapter>

        <Chapter align="left">
          <Panel>
            <Label>{t("machine.label")}</Label>
            <Title>{name ? t("machine.title", { name }) : t("machine.titleGeneric")}</Title>
            <p className="mt-4 leading-relaxed text-white/80">{t("machine.text")}</p>
            {type && (
              <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/10 pt-5">
                <Fact k={t("machine.icao")} v={type.icao} />
                <Fact k={t("machine.rating")} v={type.classOrTypeRating ?? "—"} />
                <Fact k={t("machine.engines")} v={type.engineCount ? `${type.engineCount} × ${t(`machine.engineTypes.${type.engineType}`)}` : t(`machine.engineTypes.${type.engineType}`)} />
                <Fact k={t("machine.operation")} v={type.multiPilot ? t("machine.multi") : t("machine.single")} />
              </dl>
            )}
          </Panel>
        </Chapter>

        <Chapter align="left">
          <Panel>
            <Label>{t("c2.label")}</Label>
            <Title>{t("c2.title")}</Title>
            <p className="mt-4 leading-relaxed text-white/80">{t("c2.text")}</p>
          </Panel>
        </Chapter>

        <Chapter align="left">
          <Panel>
            <Label>{t("c3.label")}</Label>
            <Title>{t("c3.title")}</Title>
            <p className="mt-4 leading-relaxed text-white/80">{t("c3.text")}</p>
            <Link href="/inscription" className="btn mt-7 min-h-12 !bg-[#22d3ee] !px-6 text-base !text-[#0a1626] hover:!bg-[#67e8f9]">
              {t("c3.cta")} <ArrowRight size={18} aria-hidden />
            </Link>
          </Panel>
        </Chapter>
      </div>
    </section>
  );
}

/* ---------- stage layers ---------- */

function Picture({ img, sizes, className, style, priority }: { img: Img; sizes: string; className?: string; style?: React.CSSProperties; priority?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src(img)} srcSet={srcSet(img)} sizes={sizes} alt="" draggable={false} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding="async" className={className} style={style} />
  );
}

function Sky({ name, style, position, priority }: { name: "day" | "dusk" | "night"; style: Record<string, MotionValue<number> | MotionValue<string> | number>; position: string; priority?: boolean }) {
  const img: Img = { base: `/immersive/sky/${name}`, widths: [1200, 2400], ratio: 1.5 };
  return (
    <motion.div className="absolute inset-[-3%] will-change-transform" style={style} aria-hidden>
      <Picture img={img} sizes="106vw" priority={priority} className="h-full w-full object-cover" style={{ objectPosition: position }} />
    </motion.div>
  );
}

function AircraftLayers({ visual, p, mx, my, reduce, locale }: { visual: AircraftVisual; p: MotionValue<number>; mx: MotionValue<number>; my: MotionValue<number>; reduce: boolean; locale: "fr" | "en" }) {
  // pointer tilt: the aircraft turns slightly towards the cursor
  const rotY = useTransform(mx, [-1, 1], reduce ? [0, 0] : [-9, 9]);
  const rotX = useTransform(my, [-1, 1], reduce ? [0, 0] : [6, -6]);

  // 1 — three-quarter view cruising, then it flies past the camera
  const aOpacity = useTransform(p, [0.2, 0.3], [1, 0]);
  const aScale = useTransform(p, [0, 0.18, 0.3], reduce ? [1, 1, 1] : [0.94, 1.06, 1.9]);
  const aX = useTransform(p, [0, 0.18, 0.3], reduce ? ["0%", "0%", "0%"] : ["7%", "3%", "-34%"]);
  const aY = useTransform(p, [0, 0.18, 0.3], reduce ? ["0%", "0%", "0%"] : ["3%", "-2%", "-16%"]);
  const aRot = useTransform(p, [0, 0.3], reduce ? [0, 0] : [1.5, -7]);
  const aBright = useTransform(p, [0.1, 0.28], [1, 0.72]);
  const aFilter = useMotionTemplate`brightness(${aBright}) drop-shadow(0 40px 60px rgba(3,6,15,.45))`;

  // 2 — head-on, landing lights on, coming out of the dusk
  const fOpacity = useTransform(p, [0.24, 0.31, 0.4, 0.46], [0, 1, 1, 0]);
  const fScale = useTransform(p, [0.24, 0.46], reduce ? [1, 1] : [0.3, 1.35]);
  const fY = useTransform(p, [0.24, 0.46], reduce ? ["0%", "0%"] : ["-10%", "9%"]);
  const fBright = useTransform(p, [0.26, 0.4], [0.9, 0.62]);
  const fFilter = useMotionTemplate`brightness(${fBright}) drop-shadow(0 30px 50px rgba(3,6,15,.6))`;

  // 5 — back for the finale
  const zOpacity = useTransform(p, [0.88, 0.95], [0, 1]);
  const zX = useTransform(p, [0.86, 1], reduce ? ["0%", "0%"] : ["38%", "0%"]);
  const zScale = useTransform(p, [0.86, 1], reduce ? [0.8, 0.8] : [0.6, 0.86]);

  // full-bleed hero for sets without cut-outs
  const bOpacity = useTransform(p, [0.14, 0.26], [1, 0]);
  const bScale = useTransform(p, [0, 0.26], reduce ? [1.04, 1.04] : [1.16, 1.02]);

  const slot = "absolute inset-0 flex items-end justify-center px-4 pb-[13svh] md:items-center md:px-[5vw] md:pb-0";

  return (
    <>
      {visual.backdrop && (
        <motion.div className="absolute inset-0 will-change-transform" style={{ opacity: bOpacity, scale: bScale }}>
          <Picture img={visual.backdrop} sizes="100vw" priority className="h-full w-full object-cover" style={{ objectPosition: "58% 100%" }} />
        </motion.div>
      )}

      {visual.cutouts && (
        <>
          <motion.div className={`${slot} md:justify-end`} style={{ opacity: aOpacity }}>
            <motion.div className="w-[92vw] max-w-[960px] md:w-[50vw]" style={{ x: aX, y: aY, scale: aScale, rotate: aRot, rotateX: rotX, rotateY: rotY, transformStyle: "preserve-3d" }}>
              <motion.div animate={reduce ? undefined : { y: [0, -10, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>
                <motion.div style={{ filter: aFilter }}>
                  <Picture img={visual.cutouts.flight} sizes="(min-width: 768px) 50vw, 92vw" priority className="h-auto w-full select-none" />
                </motion.div>
              </motion.div>
            </motion.div>
          </motion.div>

          <motion.div className={`${slot} md:justify-start`} style={{ opacity: fOpacity }}>
            <motion.div className="w-[96vw] max-w-[1100px] md:w-[56vw]" style={{ y: fY, scale: fScale, rotateX: rotX, rotateY: rotY, filter: fFilter }}>
              <Picture img={visual.cutouts.front} sizes="(min-width: 768px) 56vw, 96vw" className="h-auto w-full select-none" />
            </motion.div>
          </motion.div>

          <motion.div className={`${slot} md:justify-end`} style={{ opacity: zOpacity }}>
            <motion.div className="w-[80vw] max-w-[820px] md:w-[46vw]" style={{ x: zX, scale: zScale, rotateX: rotX, rotateY: rotY, filter: "drop-shadow(0 30px 50px rgba(3,6,15,.5))" }}>
              <Picture img={visual.cutouts.flight} sizes="(min-width: 768px) 46vw, 80vw" className="h-auto w-full select-none" />
            </motion.div>
          </motion.div>
        </>
      )}

      {/* 3 — the type itself, as glass photo cards in 3D */}
      <div className="absolute inset-0 [transform-style:preserve-3d]">
        {visual.gallery.slice(0, 3).map((g, i) => (
          <GalleryCard key={g.base} img={g} caption={g.caption[locale]} index={i} p={p} mx={mx} reduce={reduce} />
        ))}
      </div>
    </>
  );
}

const CARD_POS = [
  "right-[5vw] top-[17svh] w-[44vw] max-w-[680px] max-md:left-1/2 max-md:right-auto max-md:top-auto max-md:bottom-[13svh] max-md:w-[88vw] max-md:-translate-x-1/2",
  "right-[33vw] top-[56svh] hidden w-[27vw] max-w-[420px] md:block",
  "right-[3vw] top-[60svh] hidden w-[25vw] max-w-[390px] md:block",
];

function GalleryCard({ img, caption, index, p, mx, reduce }: { img: Img; caption: string; index: number; p: MotionValue<number>; mx: MotionValue<number>; reduce: boolean }) {
  const a = 0.42 + index * 0.025;
  const b = a + 0.07;
  const opacity = useTransform(p, [a, b, 0.585, 0.63], [0, 1, 1, 0]);
  const rotateY = useTransform(p, [a, b, 0.63], reduce ? [0, 0, 0] : [-42, -12 + index * 5, -4 + index * 3]);
  const x = useTransform(p, [a, b, 0.63], reduce ? ["0%", "0%", "0%"] : ["45%", "0%", "-6%"]);
  const z = useTransform(p, [a, b], reduce ? [0, 0] : [-420, index === 0 ? 0 : -90 * index]);
  const tilt = useTransform(mx, [-1, 1], reduce ? [0, 0] : [-4, 4]);
  const rot = useTransform([rotateY, tilt] as MotionValue<number>[], ([r, k]: number[]) => (r ?? 0) + (k ?? 0));
  return (
    <motion.figure className={`absolute ${CARD_POS[index]} overflow-hidden rounded-2xl border border-white/15 bg-white/5 shadow-[0_40px_80px_-20px_rgba(0,0,0,.7)] will-change-transform`} style={{ opacity, x, z, rotateY: rot, transformPerspective: 1400 }}>
      <div style={{ aspectRatio: String(Math.min(img.ratio, 1.9)) }}>
        <Picture img={img} sizes="(min-width: 768px) 44vw, 88vw" className="h-full w-full object-cover" />
      </div>
      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-4 pb-3 pt-8 text-[13px] font-medium text-white/90">{caption}</figcaption>
      <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,.18),transparent_38%)]" />
    </motion.figure>
  );
}

/* ---------- story pieces ---------- */

function Chapter({ align, children, eager }: { align: "left" | "right"; children: ReactNode; eager?: boolean }) {
  return (
    <div className="flex items-start md:items-center" style={{ height: `${CHAPTER_VH}vh` }}>
      <div className={`mx-auto flex w-full max-w-6xl px-4 pt-24 sm:px-6 md:pt-0 ${align === "right" ? "md:justify-end" : ""}`}>
        <motion.div
          className="w-full max-w-xl"
          initial={eager ? false : { opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ amount: 0.35, once: false }}
          transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}

const Panel = ({ children }: { children: ReactNode }) => (
  <div className="hud-frame rounded-2xl border border-white/10 bg-[#03060f]/50 p-6 shadow-2xl backdrop-blur-xl sm:p-8">{children}</div>
);
const Label = ({ children }: { children: ReactNode }) => <p className="mono-label !text-[#67e8f9]">{children}</p>;
const Title = ({ children }: { children: ReactNode }) => (
  <h2 className="mt-3 text-balance font-display text-[2rem] font-semibold leading-[1.1] tracking-[-0.01em] sm:text-[2.6rem]">{children}</h2>
);
const Fact = ({ k, v }: { k: string; v: string }) => (
  <div>
    <dt className="mono-label !text-[10px] !text-white/50">{k}</dt>
    <dd className="num mt-1 text-lg font-semibold">{v}</dd>
  </div>
);

/** Headline that rises word by word. */
function SplitTitle({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <h1 className="mt-6 font-display text-[2.9rem] font-semibold leading-[1.02] tracking-[-0.02em] [text-shadow:0_2px_40px_rgba(3,6,15,.55)] sm:text-6xl lg:text-[4.6rem]" aria-label={text}>
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.12em] align-bottom" aria-hidden>
          <motion.span className="inline-block motion-reduce:![transform:none]" initial={{ y: "115%" }} animate={{ y: 0 }} transition={{ duration: 0.8, delay: 0.15 + i * 0.07, ease: [0.2, 0.8, 0.2, 1] }}>
            {w}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </h1>
  );
}

function Credits({ visual }: { visual: AircraftVisual }) {
  const t = useTranslations("immersive.credits");
  const list = [...visual.credits, ...SKY_CREDITS];
  return (
    <details className="group absolute bottom-4 right-4 z-20 text-[11px] text-white/70">
      <summary className="cursor-pointer list-none rounded-full border border-white/10 bg-[#03060f]/50 px-3 py-1.5 backdrop-blur-md transition-colors hover:text-white [&::-webkit-details-marker]:hidden">{t("title")}</summary>
      <ul className="absolute bottom-9 right-0 max-h-[50svh] w-[min(88vw,380px)] space-y-1.5 overflow-auto rounded-xl border border-white/10 bg-[#03060f]/85 p-3 backdrop-blur-xl">
        {list.map((c) => (
          <li key={c.sourceUrl}>
            <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-white/30 hover:text-white">{c.subject}</a>
            {" · "}{c.author}{" · "}
            <a href={c.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-white/30 hover:text-white">{c.license}</a>
            {c.modified ? ` · ${t("modified")}` : ""}
          </li>
        ))}
      </ul>
    </details>
  );
}

/* ---------- live instruments (write straight into the DOM every frame) ---------- */

function useLiveText(readouts: React.RefObject<Readouts>, write: (r: Readouts) => void) {
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      write(readouts.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [readouts, write]);
}

function NightHud({ readouts }: { readouts: React.RefObject<Readouts> }) {
  const t = useTranslations("immersive.hud");
  const elev = useRef<HTMLSpanElement>(null);
  const utc = useRef<HTMLSpanElement>(null);
  const night = useRef<HTMLSpanElement>(null);
  const badge = useRef<HTMLSpanElement>(null);
  const needle = useRef<HTMLSpanElement>(null);
  const labels = useRef({ day: t("day"), night: t("nightOn") });
  const write = useRef((r: Readouts) => {
    if (elev.current) elev.current.textContent = fmtElev(r.sunElevation);
    if (utc.current) utc.current.textContent = fmtClock(r.utcMinutes);
    if (night.current) night.current.textContent = fmtDur(r.nightMinutes);
    const isNight = r.sunElevation < -6;
    if (badge.current) {
      badge.current.textContent = isNight ? labels.current.night : labels.current.day;
      badge.current.dataset.night = String(isNight);
    }
    if (needle.current) needle.current.style.left = `${Math.min(100, Math.max(0, ((8 - r.sunElevation) / 20) * 100))}%`;
  }).current;
  useLiveText(readouts, write);

  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-4" aria-hidden>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="mono-label !text-[10px] !text-white/55">{t("sun")}</p>
          <span ref={elev} className="num mt-1 block text-2xl font-semibold">+6.5°</span>
        </div>
        <div>
          <p className="mono-label !text-[10px] !text-white/55">{t("utc")}</p>
          <span ref={utc} className="num mt-1 block text-2xl font-semibold">18:40Z</span>
        </div>
        <div>
          <p className="mono-label !text-[10px] !text-white/55">{t("night")}</p>
          <span ref={night} className="num mt-1 block text-2xl font-semibold text-[#67e8f9]">0:00</span>
        </div>
      </div>
      <div className="mt-4">
        <div className="relative h-2 rounded-full bg-gradient-to-r from-[#f2c08a] via-[#7a4d78] to-[#0b1533]">
          <span className="absolute -top-1 bottom-[-4px] w-px bg-white/70" style={{ left: "70%" }} />
          <span ref={needle} className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#22d3ee] shadow-[0_0_14px_#22d3ee]" style={{ left: "7%" }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-white/55">
          <span className="num">+8°</span>
          <span className="num">{t("threshold")}</span>
          <span
            ref={badge}
            className="num rounded px-1.5 py-0.5 font-semibold data-[night=false]:bg-[#fbbf24]/20 data-[night=false]:text-[#fbbf24] data-[night=true]:bg-[#22d3ee]/20 data-[night=true]:text-[#67e8f9]"
            data-night="false"
          >
            {t("day")}
          </span>
        </div>
      </div>
    </div>
  );
}

function FlightStrip({ readouts }: { readouts: React.RefObject<Readouts> }) {
  const utc = useRef<HTMLSpanElement>(null);
  const sun = useRef<HTMLSpanElement>(null);
  const alt = useRef<HTMLSpanElement>(null);
  const write = useRef((r: Readouts) => {
    if (utc.current) utc.current.textContent = fmtClock(r.utcMinutes);
    if (sun.current) sun.current.textContent = fmtElev(r.sunElevation);
    const fl = r.progress < 0.2 ? 250 + (r.progress / 0.2) * 180 : 430;
    if (alt.current) alt.current.textContent = `FL${Math.round(fl)}`;
  }).current;
  useLiveText(readouts, write);
  const item = "flex items-baseline gap-1.5";
  return (
    <div className="num pointer-events-none absolute bottom-5 left-1/2 hidden -translate-x-1/2 items-center gap-6 rounded-full border border-white/10 bg-[#03060f]/45 px-5 py-2 text-xs text-white/80 backdrop-blur-md md:flex" aria-hidden>
      <span className={item}><span className="text-white/45">ALT</span><span ref={alt}>FL250</span></span>
      <span className={item}><span className="text-white/45">SUN</span><span ref={sun}>+6.5°</span></span>
      <span className={item}><span className="text-white/45">UTC</span><span ref={utc}>18:40Z</span></span>
    </div>
  );
}

function ProgressRail({ readouts, labels }: { readouts: React.RefObject<Readouts>; labels: string[] }) {
  const items = useRef<(HTMLLIElement | null)[]>([]);
  const fill = useRef<HTMLSpanElement>(null);
  const write = useRef((r: Readouts) => {
    if (fill.current) fill.current.style.transform = `scaleY(${r.progress})`;
    items.current.forEach((el, i) => el && (el.dataset.active = String(i === r.chapter)));
  }).current;
  useLiveText(readouts, write);
  return (
    <div className="pointer-events-none absolute right-6 top-1/2 hidden -translate-y-1/2 items-stretch gap-3 xl:flex" aria-hidden>
      <ol className="flex flex-col justify-between gap-9 text-right">
        {labels.map((l, i) => (
          <li key={l} ref={(el) => { items.current[i] = el; }} className="mono-label !text-[10px] !text-white/40 transition-colors data-[active=true]:!text-[#67e8f9]">
            {String(i + 1).padStart(2, "0")} {l}
          </li>
        ))}
      </ol>
      <span className="relative w-px overflow-hidden bg-white/15">
        <span ref={fill} className="absolute inset-0 origin-top bg-[#22d3ee]" style={{ transform: "scaleY(0)" }} />
      </span>
    </div>
  );
}

export type { HomeAircraft };
