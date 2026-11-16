"use client";

import { ArrowRight, ChevronDown, Move3d } from "lucide-react";
import { motion, useMotionValueEvent, useScroll, useSpring, useTransform, type MotionValue } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { DEFAULT_VISUAL, EARTH_CREDITS, FILM_CREDITS } from "@/lib/aircraft-visuals";
import { StoreBadges } from "../sections";
import { createReadouts, GLOBE_FROM, readoutsAt, SHOTS, type Readouts } from "./timeline";
import type { FlightScene } from "./scene";

const CHAPTER_VH = 180;
const CHAPTER_COUNT = 5;

const fmtClock = (m: number) => {
  const mm = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(mm / 60)).padStart(2, "0")}:${String(mm % 60).padStart(2, "0")}Z`;
};
const fmtDur = (m: number) => `${Math.floor(m / 60)}:${String(Math.round(m) % 60).padStart(2, "0")}`;
const fmtElev = (e: number) => `${e >= 0 ? "+" : "−"}${Math.abs(e).toFixed(1)}°`;

/**
 * Immersive home, the same for every visitor. A sticky stage plays a film scrubbed by the scroll — a business jet lined up at the
 * runway threshold, the takeoff roll that speeds up as you scroll, rotation, gear up, into the clouds — then
 * hands over to a photographic 3D Earth with the pilot's routes, which the visitor turns by click-and-drag.
 * The story is real DOM text on top (indexable, screen-reader friendly); with reduced motion the film is
 * replaced by still frames.
 */
export function ImmersiveHome() {
  const t = useTranslations("immersive");
  const th = useTranslations("hero");
  const locale = useLocale() as "fr" | "en";
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduce(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  // the same film for every visitor
  const film = DEFAULT_VISUAL.film!;

  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<FlightScene | null>(null);
  const readouts = useRef<Readouts>(createReadouts());
  const [globeReady, setGlobeReady] = useState(false);
  const [globeActive, setGlobeActive] = useState(false);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  // a little lag makes the scrub feel like a camera move, not a scrollbar
  const sprung = useSpring(scrollYProgress, { stiffness: 90, damping: 24, restDelta: 0.0002 });
  const p = reduce ? scrollYProgress : sprung;

  useMotionValueEvent(p, "change", (v) => {
    readoutsAt(v, readouts.current, film);
    sceneRef.current?.setProgress((v - GLOBE_FROM) / (1 - GLOBE_FROM));
    const active = v > GLOBE_FROM + 0.02;
    setGlobeActive((a) => (a === active ? a : active));
  });

  // Globe (Three.js), loaded lazily and only rendered while on screen
  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;
    let disposed = false;
    let inView = true;
    let scene: FlightScene | null = null;
    readoutsAt(p.get(), readouts.current, film);
    (async () => {
      const mod = await import("./scene");
      if (disposed || !mod.webglAvailable()) return;
      try {
        scene = new mod.FlightScene(canvas, { reducedMotion: reduce, mobile: window.innerWidth < 768 });
      } catch {
        return;
      }
      scene.onReady = () => !disposed && setGlobeReady(true);
      scene.setProgress((p.get() - GLOBE_FROM) / (1 - GLOBE_FROM));
      sceneRef.current = scene;
      if (inView && document.visibilityState === "visible") scene.start();
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

  // click & drag on the globe (touch: horizontal drag turns it, vertical swipe still scrolls the page)
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (!globeActive || !sceneRef.current) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
    sceneRef.current.pointerDown(e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (drag.current?.id !== e.pointerId) return;
    sceneRef.current?.pointerMove(e.clientX, e.pointerType === "touch" ? drag.current.y : e.clientY);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    sceneRef.current?.pointerUp();
  };

  /* ---------- choreography ---------- */
  const whiteout = useTransform(p, [SHOTS.clouds.from + 0.02, SHOTS.clouds.to - 0.01, GLOBE_FROM + 0.04, GLOBE_FROM + 0.1], [0, 0.92, 0.92, 0]);
  const filmOpacity = useTransform(p, [GLOBE_FROM, GLOBE_FROM + 0.02], [1, 0]);
  const globeOpacity = useTransform(p, [GLOBE_FROM - 0.01, GLOBE_FROM + 0.06], [0, 1]);

  const chapters = t.raw("chapters") as string[];

  return (
    <section ref={sectionRef} className="relative bg-[#02040b] text-white" style={{ height: `${CHAPTER_VH * CHAPTER_COUNT}vh` }}>
      {/* ---------- Stage ---------- */}
      <div
        className={`sticky top-0 h-[100svh] touch-pan-y overflow-hidden select-none ${globeActive ? "cursor-grab active:cursor-grabbing" : ""}`}
        role="img"
        aria-label={t("canvasLabel")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Globe in space */}
        <motion.div className="absolute inset-0" style={{ opacity: globeOpacity }} aria-hidden>
          <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_62%_50%,#0a1630_0%,#02040b_70%)]" />
          <canvas ref={canvasRef} className={`absolute inset-0 block h-full w-full transition-opacity duration-1000 ${globeReady ? "opacity-100" : "opacity-0"}`} />
        </motion.div>

        {/* Film */}
        <motion.div className="absolute inset-0" style={{ opacity: filmOpacity }} aria-hidden>
          <Film base={film.base} poster={film.poster} p={p} reduce={reduce} />
          <motion.div className="absolute inset-0 bg-[#f4f1ea]" style={{ opacity: whiteout }} />
        </motion.div>
        <motion.div className="pointer-events-none absolute inset-0 bg-[#f4f1ea]" style={{ opacity: useTransform(p, [GLOBE_FROM - 0.004, GLOBE_FROM, GLOBE_FROM + 0.08], [0, 0.92, 0]) }} aria-hidden />

        {/* Scrims, vignette and grain keep the text readable and the image filmic */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_55%_45%,transparent_55%,rgba(2,4,11,.55))]" aria-hidden />
        <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[55%] bg-gradient-to-r from-[#02040b]/70 via-[#02040b]/25 to-transparent md:block" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[58%] bg-gradient-to-b from-[#02040b]/80 to-transparent md:hidden" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#02040b]/80 to-transparent" aria-hidden />
        <div className="immersive-grain pointer-events-none absolute inset-0" aria-hidden />

        <motion.p
          className="mono-label pointer-events-none absolute bottom-28 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-white/15 bg-[#02040b]/50 px-3 py-1.5 !text-[11px] !text-white/80 backdrop-blur-md md:bottom-16 md:left-auto md:right-[22%] md:translate-x-0 max-sm:!text-[10px]"
          initial={false}
          animate={{ opacity: globeActive && globeReady ? 1 : 0 }}
          aria-hidden
        >
          <Move3d size={14} /> {t("drag")}
        </motion.p>

        <FlightStrip readouts={readouts} />
        <ProgressRail readouts={readouts} labels={chapters} />
        <Credits />
      </div>

      {/* ---------- Story ---------- */}
      <div className="pointer-events-none relative z-10 -mt-[100svh]">
        <Chapter align="left" eager>
          <p className="mono-label inline-flex items-center gap-2 rounded-full border border-[#22c55e]/40 bg-[#22c55e]/10 px-3 py-1.5 !text-[#86efac]">
            <span className="blink h-1.5 w-1.5 rounded-full bg-[#22c55e]" aria-hidden />
            {th("eyebrow")}
          </p>
          <SplitTitle text={th("title")} />
          <p className="mt-6 max-w-lg text-pretty text-lg leading-relaxed text-white/85 [text-shadow:0_1px_20px_rgba(2,4,11,.6)]">{th("subtitle")}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/inscription" className="btn min-h-12 !bg-[#22c55e] !px-6 text-base !text-[#0a1626] shadow-[0_10px_40px_-10px_#22c55e] hover:!bg-[#86efac]">
              {th("ctaTrial")} <ArrowRight size={18} aria-hidden />
            </Link>
            <Link href={{ pathname: "/connexion", query: { demo: "1" } }} className="btn min-h-12 border border-white/25 bg-[#02040b]/30 !px-6 text-base text-white backdrop-blur-md hover:border-white/60 hover:bg-white/10">
              {th("ctaDemo")}
            </Link>
          </div>
          <StoreBadges className="mt-7 max-sm:hidden [&_a]:!border-white/15 [&_a]:!bg-white [&_a]:!text-[#0a1626]" />
          <p className="mt-10 flex items-center gap-2 text-sm text-white/70" aria-hidden>
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
            <Title>{t("machine.titleGeneric")}</Title>
            <p className="mt-4 leading-relaxed text-white/80">{t("machine.text")}</p>
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
            <Link href="/inscription" className="btn mt-7 min-h-12 !bg-[#22c55e] !px-6 text-base !text-[#0a1626] hover:!bg-[#86efac]">
              {t("c3.cta")} <ArrowRight size={18} aria-hidden />
            </Link>
          </Panel>
        </Chapter>
      </div>
    </section>
  );
}

/* ---------- film: image sequences scrubbed by scroll ---------- */

type ShotId = keyof typeof SHOTS;
const SHOT_IDS = Object.keys(SHOTS) as ShotId[];
const FRAME_COUNT: Record<ShotId, number> = { takeoff: 190, gear: 121, clouds: 40 };

/**
 * The film is a sequence of still frames (24 per second of footage) drawn on a canvas: any scroll position
 * shows its frame at once, with no video seeking. Frames load coarse-to-fine (every 8th, then every 4th…)
 * so the whole sequence is scrubbable within a second and sharpens as the rest arrives.
 */
function Film({ base, poster, p, reduce }: { base: string; poster: string; p: MotionValue<number>; reduce: boolean }) {
  const frames = useRef<Record<ShotId, (HTMLImageElement | null)[]>>({ takeoff: [], gear: [], clouds: [] });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (reduce) return;
    // frame size from the pixels actually drawn (CSS width × device pixel ratio, capped as in the draw loop)
    const small = window.innerWidth < 900 || (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    const drawn = window.innerWidth * Math.min(window.devicePixelRatio || 1, 1.5);
    const q = small ? "720" : drawn >= 1700 ? "1920" : "1280";
    let alive = true;
    const queue: [ShotId, number][] = [];
    const seen = new Set<string>();
    for (const step of [8, 4, 2, 1])
      for (const id of SHOT_IDS)
        for (let i = 0; i < FRAME_COUNT[id]; i += step) {
          const k = `${id}/${i}`;
          if (!seen.has(k)) {
            seen.add(k);
            queue.push([id, i]);
          }
        }
    let next = 0;
    const worker = async () => {
      while (alive && next < queue.length) {
        const [id, i] = queue[next++]!;
        const img = new Image();
        img.decoding = "async";
        img.src = `${base}/frames-${q}/${id}/${i}.webp`;
        try {
          await img.decode();
        } catch {
          continue;
        }
        if (!alive) return;
        frames.current[id][i] = img;
        if (id === "takeoff" && i === 0) setReady(true);
      }
    };
    for (let w = 0; w < 6; w++) void worker();
    return () => {
      alive = false;
    };
  }, [base, reduce]);

  // Draw loop. During the takeoff roll the image pushes in gently; no shake or zoom blur, so the frame stays sharp.
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const cv = canvas.current;
    const ctx = cv?.getContext("2d", { alpha: false });
    const nearest = (id: ShotId, f: number) => {
      const list = frames.current[id];
      for (let d = 0; d < FRAME_COUNT[id]; d++) {
        const a = list[f - d] ?? list[f + d];
        if (a) return a;
      }
      return null;
    };
    const loop = () => {
      const v = p.get();
      const id = SHOT_IDS.find((k) => v < SHOTS[k].to) ?? SHOT_IDS[SHOT_IDS.length - 1]!;
      const s = SHOTS[id];
      const k = Math.min(1, Math.max(0, (v - s.from) / (s.to - s.from)));
      const img = nearest(id, Math.round(k * (FRAME_COUNT[id] - 1)));
      if (cv && ctx && img) {
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const w = Math.round(cv.clientWidth * dpr);
        const h = Math.round(cv.clientHeight * dpr);
        if (cv.width !== w || cv.height !== h) {
          cv.width = w;
          cv.height = h;
        }
        // high-quality resampling when the frame is scaled up (browsers default to a softer filter)
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        const { push, cy } = speedFx(id, v);
        // object-fit: cover
        const fit = Math.max(w / img.naturalWidth, h / img.naturalHeight);
        const dw = img.naturalWidth * fit;
        const dh = img.naturalHeight * fit;
        const fx = w / 2;
        const fy = h * cy;
        const x0 = (w - dw) / 2;
        const y0 = (h - dh) / 2;
        // the frame scaled around the focal point
        ctx.drawImage(img, fx + (x0 - fx) * push, fy + (y0 - fy) * push, dw * push, dh * push);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [p, reduce]);

  return (
    <div className="absolute inset-0">
      {/* poster: the first frame, shown at once (LCP) until the sequence is ready */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${poster}-1280.webp`}
        srcSet={`${poster}-1280.webp 1280w, ${poster}-1920.webp 1920w`}
        sizes="100vw"
        alt=""
        fetchPriority="high"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {reduce ? (
        <StillFrames base={base} p={p} />
      ) : (
        <canvas ref={canvas} className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`} />
      )}
    </div>
  );
}

/**
 * Camera move per shot: `push` the dolly-in, `speed` its pace (kept for the HUD),
 * `cy` the point the image rushes away from (the end of the runway / the aircraft).
 */
function speedFx(id: ShotId, v: number): { speed: number; push: number; cy: number } {
  const s = SHOTS[id];
  const k = Math.min(1, Math.max(0, (v - s.from) / (s.to - s.from)));
  if (id === "takeoff") {
    const roll = Math.min(1, Math.max(0, (k - 0.05) / 0.57));
    // builds up with the roll, fades once the wheels leave the runway
    const speed = k < 0.62 ? Math.pow(roll, 1.15) : Math.max(0, 1 - (k - 0.62) / 0.16);
    const push = 1 + 0.14 * (roll * roll * (3 - 2 * roll));
    return { speed, push, cy: 0.42 };
  }
  if (id === "gear") return { speed: 0, push: 1, cy: 0.4 };
  return { speed: 0.35 + 0.4 * k, push: 1 + 0.08 * k, cy: 0.5 };
}

/** Reduced motion: a few still frames that cross-fade instead of a moving film. */
function StillFrames({ base, p }: { base: string; p: MotionValue<number> }) {
  const b = useTransform(p, [SHOTS.takeoff.to - 0.08, SHOTS.takeoff.to], [0, 1]);
  const c = useTransform(p, [SHOTS.gear.to - 0.04, SHOTS.gear.to], [0, 1]);
  return (
    <>
      <motion.img src={`${base}/still-rotate-1280.webp`} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: b }} />
      <motion.img src={`${base}/still-climb-1280.webp`} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: c }} />
    </>
  );
}

/* ---------- story pieces ---------- */

function Chapter({ align, children, eager }: { align: "left" | "right"; children: ReactNode; eager?: boolean }) {
  return (
    <div className="flex items-start md:items-center" style={{ height: `${CHAPTER_VH}vh` }}>
      <div className={`mx-auto flex w-full max-w-6xl px-4 pt-24 sm:px-6 md:pt-0 ${align === "right" ? "md:justify-end" : ""}`}>
        <motion.div
          className="pointer-events-auto w-full max-w-xl"
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
  <div className="hud-frame rounded-2xl border border-white/10 bg-[#02040b]/55 p-6 shadow-2xl backdrop-blur-xl sm:p-8">{children}</div>
);
const Label = ({ children }: { children: ReactNode }) => <p className="mono-label !text-[#86efac]">{children}</p>;
const Title = ({ children }: { children: ReactNode }) => (
  <h2 className="mt-3 text-balance font-display text-[2rem] font-semibold leading-[1.1] tracking-[-0.01em] sm:text-[2.6rem]">{children}</h2>
);

/** Headline that rises word by word. */
function SplitTitle({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <h1 className="mt-6 font-display text-[2.9rem] font-semibold leading-[1.02] tracking-[-0.02em] [filter:drop-shadow(0_2px_18px_rgba(2,4,11,.55))] sm:text-6xl lg:text-[4.6rem]" aria-label={text}>
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.12em] align-bottom" aria-hidden>
          <motion.span className="inline-block motion-reduce:![transform:none]" initial={{ y: "115%" }} animate={{ y: 0 }} transition={{ duration: 0.8, delay: 0.15 + i * 0.07, ease: [0.2, 0.8, 0.2, 1] }}>
            {w}
          </motion.span>
        </span>
      )).flatMap((el, i) => (i < words.length - 1 ? [el, " "] : [el]))}
    </h1>
  );
}

function Credits() {
  const t = useTranslations("immersive.credits");
  const list = [...FILM_CREDITS, ...EARTH_CREDITS];
  return (
    <details className="group absolute bottom-16 right-4 z-20 md:bottom-4 text-[11px] text-white/70">
      <summary className="cursor-pointer list-none rounded-full border border-white/10 bg-[#02040b]/50 px-3 py-1.5 backdrop-blur-md transition-colors hover:text-white [&::-webkit-details-marker]:hidden">{t("title")}</summary>
      <ul className="absolute bottom-9 right-0 max-h-[50svh] w-[min(88vw,380px)] space-y-1.5 overflow-auto rounded-xl border border-white/10 bg-[#02040b]/85 p-3 backdrop-blur-xl">
        {list.map((c) => (
          <li key={c.subject}>
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
          <span ref={elev} className="num mt-1 block text-2xl font-semibold">−7.0°</span>
        </div>
        <div>
          <p className="mono-label !text-[10px] !text-white/55">{t("utc")}</p>
          <span ref={utc} className="num mt-1 block text-2xl font-semibold">05:12Z</span>
        </div>
        <div>
          <p className="mono-label !text-[10px] !text-white/55">{t("night")}</p>
          <span ref={night} className="num mt-1 block text-2xl font-semibold text-[#86efac]">0:00</span>
        </div>
      </div>
      <div className="mt-4">
        <div className="relative h-2 rounded-full bg-gradient-to-r from-[#f2c08a] via-[#7a4d78] to-[#0b1533]">
          <span className="absolute -top-1 bottom-[-4px] w-px bg-white/70" style={{ left: "70%" }} />
          <span ref={needle} className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#22c55e] shadow-[0_0_14px_#22c55e]" style={{ left: "75%" }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-white/55">
          <span className="num">+8°</span>
          <span className="num">{t("threshold")}</span>
          <span
            ref={badge}
            className="num rounded px-1.5 py-0.5 font-semibold data-[night=false]:bg-[#fbbf24]/20 data-[night=false]:text-[#fbbf24] data-[night=true]:bg-[#22c55e]/20 data-[night=true]:text-[#86efac]"
            data-night="true"
          >
            {t("nightOn")}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Instruments strip that follows the film: flight phase, indicated airspeed, altitude. */
function FlightStrip({ readouts }: { readouts: React.RefObject<Readouts> }) {
  const t = useTranslations("immersive.phase");
  const phase = useRef<HTMLSpanElement>(null);
  const ias = useRef<HTMLSpanElement>(null);
  const alt = useRef<HTMLSpanElement>(null);
  const labels = useRef<Record<string, string>>({});
  for (const k of ["lineup", "roll", "rotate", "gearUp", "climb", "cruise"]) labels.current[k] = t(k);
  const write = useRef((r: Readouts) => {
    if (phase.current) {
      phase.current.textContent = labels.current[r.phase] ?? "";
      phase.current.dataset.phase = r.phase;
    }
    if (ias.current) ias.current.textContent = r.phase === "cruise" ? "M.80" : `${Math.round(r.ias)} kt`;
    if (alt.current) alt.current.textContent = r.altitudeFt >= 10000 ? `FL${Math.round(r.altitudeFt / 100)}` : `${Math.round(r.altitudeFt / 10) * 10} ft`;
  }).current;
  useLiveText(readouts, write);
  const item = "flex items-baseline gap-1.5";
  return (
    <div className="num pointer-events-none absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-4 whitespace-nowrap rounded-full border border-white/10 bg-[#02040b]/55 px-4 py-2 text-[11px] text-white/85 backdrop-blur-md sm:gap-6 sm:px-5 sm:text-xs" aria-hidden>
      <span ref={phase} className="font-semibold text-[#86efac] data-[phase=gearUp]:text-[#fde68a]" />
      <span className={item}><span className="text-white/45">IAS</span><span ref={ias}>0 kt</span></span>
      <span className={item}><span className="text-white/45">ALT</span><span ref={alt}>0 ft</span></span>
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
          <li key={l} ref={(el) => { items.current[i] = el; }} className="mono-label !text-[10px] !text-white/45 transition-colors data-[active=true]:!text-[#86efac]">
            {String(i + 1).padStart(2, "0")} {l}
          </li>
        ))}
      </ol>
      <span className="relative w-px overflow-hidden bg-white/15">
        <span ref={fill} className="absolute inset-0 origin-top bg-[#22c55e]" style={{ transform: "scaleY(0)" }} />
      </span>
    </div>
  );
}

