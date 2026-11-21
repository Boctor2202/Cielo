"use client";

import { ArrowRight, ChevronDown, Move3d } from "lucide-react";
import { motion, useMotionValueEvent, useScroll, useSpring, useTransform, type MotionValue } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { EARTH_CREDITS, FILM_CREDITS } from "@/lib/aircraft-visuals";
import { StoreBadges } from "../sections";
import { createReadouts, GLOBE_FROM, ON_BLOCK_AT, readoutsAt, SHOTS, TOUCHDOWN_AT, utcAt, type Readouts } from "./timeline";
import type { FlightScene } from "./scene";

const CHAPTER_VH = 180;
const CHAPTER_COUNT = 5;

const fmtClock = (m: number) => {
  const mm = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(mm / 60)).padStart(2, "0")}:${String(mm % 60).padStart(2, "0")}Z`;
};
const fmtDur = (m: number) => `${Math.floor(m / 60)}:${String(Math.round(m) % 60).padStart(2, "0")}`;

/**
 * Immersive home, the same for every visitor. A sticky stage plays a film scrubbed by the scroll — an airliner on final
 * on a summer midday, the gear coming down, touchdown, then the taxi to its gate — then hands over to a photographic 3D Earth with the pilot's routes, which the visitor turns by click-and-drag.
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
  const film = FILM;

  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<FlightScene | null>(null);
  const readouts = useRef<Readouts>(createReadouts());
  const [globeReady, setGlobeReady] = useState(false);
  const [globeActive, setGlobeActive] = useState(false);
  const nearGlobe = useRef(false);
  const syncScene = useRef<() => void>(() => {});

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  // a little lag makes the scrub feel like a camera move, not a scrollbar
  const sprung = useSpring(scrollYProgress, { stiffness: 90, damping: 24, restDelta: 0.0002 });
  const p = reduce ? scrollYProgress : sprung;

  useMotionValueEvent(p, "change", (v) => {
    readoutsAt(v, readouts.current);
    sceneRef.current?.setProgress((v - GLOBE_FROM) / (1 - GLOBE_FROM));
    const active = v > GLOBE_FROM + 0.02;
    setGlobeActive((a) => (a === active ? a : active));
    // the WebGL Earth only renders once the film is about to hand over, so it never competes with the film
    const near = v > GLOBE_FROM - 0.06;
    if (near !== nearGlobe.current) {
      nearGlobe.current = near;
      syncScene.current();
    }
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
    const phone = window.innerWidth < 900;
    const cancelLoad = afterFirstPaint(() => void (async () => {
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
      syncScene.current();
    })(), phone);
    const sync = () => (inView && nearGlobe.current && document.visibilityState === "visible" ? scene?.start() : scene?.stop());
    syncScene.current = sync;
    const io = new IntersectionObserver(([e]) => {
      inView = !!e?.isIntersecting;
      sync();
    });
    io.observe(section);
    const vis = sync;
    document.addEventListener("visibilitychange", vis);
    const ro = new ResizeObserver(() => scene?.resize());
    ro.observe(canvas.parentElement!);
    return () => {
      disposed = true;
      cancelLoad();
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
  // a short dip between shots, like a cut in a film
  const cut = useTransform(
    p,
    [SHOTS.approach.to - 0.012, SHOTS.approach.to, SHOTS.touchdown.from + 0.012, SHOTS.touchdown.to - 0.012, SHOTS.touchdown.to, SHOTS.taxi.from + 0.012],
    [0, 0.6, 0, 0, 0.6, 0],
  );
  // the film fades out before the Earth appears
  const dusk = useTransform(p, [SHOTS.taxi.to - 0.02, GLOBE_FROM + 0.02], [0, 0.55]);
  const filmOpacity = useTransform(p, [GLOBE_FROM - 0.015, GLOBE_FROM + 0.03], [1, 0]);
  const globeOpacity = useTransform(p, [GLOBE_FROM - 0.025, GLOBE_FROM + 0.02], [0, 1]);

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
          <motion.div className="absolute inset-0 bg-[#02040b]" style={{ opacity: cut }} />
          <motion.div className="absolute inset-0 bg-[#02040b]" style={{ opacity: dusk }} />
        </motion.div>

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
          <ul className="mt-5 flex max-w-xl flex-wrap gap-2">
            {(th.raw("features") as string[]).map((f) => (
              <li key={f} className="rounded-full border border-white/15 bg-[#02040b]/40 px-3 py-1 text-[13px] text-white/85 backdrop-blur-md">
                {f}
              </li>
            ))}
          </ul>
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
            <LogHud readouts={readouts} />
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
const FRAME_COUNT: Record<ShotId, number> = { approach: 192, touchdown: 135, taxi: 192 };
const FILM = { base: "/immersive/film/landing", poster: "/immersive/film/landing/poster" };


/**
 * Runs `cb` once the page has finished loading and the main thread is idle, or at the first scroll / touch,
 * whichever comes first: the heavy parts of the hero (film frames, WebGL Earth) never compete with the first paint.
 */
function afterFirstPaint(cb: () => void, onInteractionOnly = false): () => void {
  let done = false;
  let idle = 0;
  let timer = 0;
  const events = ["scroll", "pointerdown", "touchstart", "keydown", "wheel"] as const;
  const run = () => {
    if (done) return;
    done = true;
    cleanup();
    cb();
  };
  const schedule = () => {
    const w = window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) idle = w.requestIdleCallback(run, { timeout: 2500 });
    else timer = window.setTimeout(run, 1200);
  };
  const cleanup = () => {
    events.forEach((e) => window.removeEventListener(e, run));
    window.removeEventListener("load", schedule);
    const w = window as Window & { cancelIdleCallback?: (h: number) => void };
    if (idle && w.cancelIdleCallback) w.cancelIdleCallback(idle);
    if (timer) clearTimeout(timer);
  };
  events.forEach((e) => window.addEventListener(e, run, { once: true, passive: true }));
  // on phones the heavy parts wait for the visitor to scroll or touch: the poster frame is shown until then
  if (!onInteractionOnly) {
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
  }
  return () => {
    done = true;
    cleanup();
  };
}

/**
 * The film is a sequence of still frames (24 per second of footage) drawn on a canvas: any scroll position
 * shows its frame at once, with no video seeking. Frames load coarse-to-fine (every 8th, then every 4th…)
 * so the whole sequence is scrubbable within a second and sharpens as the rest arrives.
 */
function Film({ base, poster, p, reduce }: { base: string; poster: string; p: MotionValue<number>; reduce: boolean }) {
  const frames = useRef<Record<ShotId, (HTMLImageElement | null)[]>>({ approach: [], touchdown: [], taxi: [] });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (reduce) return;
    // frame size from the pixels actually drawn (CSS width × device pixel ratio, capped as in the draw loop)
    const small = window.innerWidth < 900 || (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    const drawn = window.innerWidth * Math.min(window.devicePixelRatio || 1, 1.5);
    const q = small ? "720" : drawn >= 1500 ? "1920" : "1280";
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
        if (id === SHOT_IDS[0] && i === 0) setReady(true);
      }
    };
    // fewer parallel downloads on phones and slow links, so the page stays responsive
    const cancel = afterFirstPaint(() => {
      for (let w = 0; w < (small ? 3 : 6); w++) void worker();
    }, !!small);
    return () => {
      alive = false;
      cancel();
    };
  }, [base, reduce]);

  // Draw loop: a slow dolly-in on the approach; no shake or zoom blur, so the frame stays sharp.
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
    // The two frames around the exact scroll position are cross-faded, so motion stays fluid between frames.
    let drawn = "";
    const loop = () => {
      const v = p.get();
      const id = SHOT_IDS.find((k) => v < SHOTS[k].to) ?? SHOT_IDS[SHOT_IDS.length - 1]!;
      const s = SHOTS[id];
      const k = Math.min(1, Math.max(0, (v - s.from) / (s.to - s.from)));
      const pos = k * (FRAME_COUNT[id] - 1);
      const f0 = Math.floor(pos);
      const frac = pos - f0;
      const list = frames.current[id];
      const exact = list[f0] && (frac < 0.02 || list[f0 + 1]);
      const img = exact ? list[f0]! : nearest(id, Math.round(pos));
      const next = exact && frac >= 0.02 ? list[f0 + 1] : null;
      const key = `${cv?.clientWidth}x${cv?.clientHeight}:${id}:${f0}:${exact ? "" : "~"}:${next ? frac.toFixed(3) : ""}`;
      if (cv && ctx && img && key !== drawn) {
        drawn = key;
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
        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        const fit = Math.max(w / iw, h / ih);
        const dw = iw * fit;
        const dh = ih * fit;
        const fx = w / 2;
        const fy = h * cy;
        const x0 = (w - dw) / 2;
        const y0 = (h - dh) / 2;
        // the frame scaled around the focal point
        const put = (im: HTMLImageElement) => ctx.drawImage(im, fx + (x0 - fx) * push, fy + (y0 - fy) * push, dw * push, dh * push);
        ctx.globalAlpha = 1;
        put(img);
        if (next) {
          ctx.globalAlpha = frac;
          put(next);
          ctx.globalAlpha = 1;
        }
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

/** Camera move per shot: `push` the dolly-in around the focal height `cy`. */
function speedFx(id: ShotId, v: number): { push: number; cy: number } {
  const s = SHOTS[id];
  const k = Math.min(1, Math.max(0, (v - s.from) / (s.to - s.from)));
  if (id === "approach") return { push: 1 + 0.04 * k, cy: 0.5 };
  return { push: 1, cy: 0.5 };
}

/** Reduced motion: a few still frames that cross-fade instead of a moving film. */
function StillFrames({ base, p }: { base: string; p: MotionValue<number> }) {
  const a = useTransform(p, [SHOTS.approach.to * 0.3, SHOTS.approach.to * 0.5], [0, 1]);
  const b = useTransform(p, [SHOTS.approach.to - 0.02, SHOTS.approach.to], [0, 1]);
  const c = useTransform(p, [SHOTS.touchdown.to - 0.02, SHOTS.touchdown.to], [0, 1]);
  return (
    <>
      <motion.img src={`${base}/still-approach-1280.webp`} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: a }} />
      <motion.img src={`${base}/still-touchdown-1280.webp`} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: b }} />
      <motion.img src={`${base}/still-gate-1280.webp`} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: c }} />
    </>
  );
}

/* ---------- story pieces ---------- */

function Chapter({ align, children, eager }: { align: "left" | "right"; children: ReactNode; eager?: boolean }) {
  return (
    <div className={`flex items-start ${eager ? "" : "md:items-center"}`} style={{ height: `${CHAPTER_VH}vh` }}>
      <div className={`mx-auto flex w-full max-w-6xl px-4 pt-24 sm:px-6 ${eager ? "md:pt-[max(6rem,calc(50svh-17rem))]" : "md:pt-0"} ${align === "right" ? "md:justify-end" : ""}`}>
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
    <h1 className="mt-6 font-display text-[2.9rem] font-semibold leading-[1.02] tracking-[-0.02em] [filter:drop-shadow(0_2px_18px_rgba(2,4,11,.55))] sm:text-[3.4rem] lg:text-[3.9rem]" aria-label={text}>
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

/** The logbook line of the flight being filmed, filled in as it happens: landing at touchdown, block time at the gate. */
function LogHud({ readouts }: { readouts: React.RefObject<Readouts> }) {
  const t = useTranslations("immersive.hud");
  const ldg = useRef<HTMLSpanElement>(null);
  const ldgDay = useRef<HTMLSpanElement>(null);
  const onBlock = useRef<HTMLSpanElement>(null);
  const block = useRef<HTMLSpanElement>(null);
  const badge = useRef<HTMLSpanElement>(null);
  const labels = useRef({ inFlight: t("inFlight"), logged: t("logged") });
  // a 1 h 42 block: off block 1 h 42 before the aircraft reaches its gate
  const BLOCK_MIN = 102;
  const write = useRef((r: Readouts) => {
    const landed = r.progress >= TOUCHDOWN_AT;
    const parked = r.progress >= ON_BLOCK_AT;
    if (ldg.current) ldg.current.textContent = landed ? fmtClock(utcAt(TOUCHDOWN_AT)) : "—";
    if (ldgDay.current) ldgDay.current.textContent = landed ? "1" : "0";
    if (onBlock.current) onBlock.current.textContent = parked ? fmtClock(utcAt(ON_BLOCK_AT)) : "—";
    if (block.current) block.current.textContent = parked ? fmtDur(BLOCK_MIN) : "—";
    if (badge.current) {
      badge.current.textContent = parked ? labels.current.logged : labels.current.inFlight;
      badge.current.dataset.logged = String(parked);
    }
  }).current;
  useLiveText(readouts, write);
  const cell = (label: string, ref: React.RefObject<HTMLSpanElement | null>, init: string, accent = false) => (
    <div>
      <p className="mono-label !text-[10px] !text-white/55">{label}</p>
      <span ref={ref} className={`num mt-1 block text-2xl font-semibold ${accent ? "text-[#86efac]" : ""}`}>{init}</span>
    </div>
  );
  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-4" aria-hidden>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cell(t("landing"), ldg, "—")}
        {cell(t("dayLdg"), ldgDay, "0", true)}
        {cell(t("onBlock"), onBlock, "—")}
        {cell(t("block"), block, "—", true)}
      </div>
      <div className="mt-4 flex items-center justify-between text-[11px] text-white/55">
        <span className="num">{t("night")} 0:00</span>
        <span
          ref={badge}
          className="num rounded px-1.5 py-0.5 font-semibold data-[logged=false]:bg-[#fbbf24]/20 data-[logged=false]:text-[#fbbf24] data-[logged=true]:bg-[#22c55e]/20 data-[logged=true]:text-[#86efac]"
          data-logged="false"
        >
          {t("inFlight")}
        </span>
      </div>
    </div>
  );
}

/** Instruments strip that follows the film: flight phase, indicated airspeed, altitude. */
function FlightStrip({ readouts }: { readouts: React.RefObject<Readouts> }) {
  const t = useTranslations("immersive.phase");
  const phase = useRef<HTMLSpanElement>(null);
  const ias = useRef<HTMLSpanElement>(null);
  const spd = useRef<HTMLSpanElement>(null);
  const alt = useRef<HTMLSpanElement>(null);
  const labels = useRef<Record<string, string>>({});
  for (const k of ["approach", "gearDown", "touchdown", "taxi", "logged"]) labels.current[k] = t(k);
  const write = useRef((r: Readouts) => {
    if (phase.current) {
      phase.current.textContent = labels.current[r.phase] ?? "";
      phase.current.dataset.phase = r.phase;
    }
    if (ias.current) ias.current.textContent = r.phase === "logged" ? "—" : `${Math.round(r.speed)} kt`;
    if (spd.current) spd.current.textContent = r.phase === "taxi" || r.phase === "logged" ? "GS" : "IAS";
    if (alt.current) alt.current.textContent = r.phase === "logged" ? "—" : r.altitudeFt >= 10000 ? `FL${Math.round(r.altitudeFt / 100)}` : `${Math.round(r.altitudeFt / 10) * 10} ft`;
  }).current;
  useLiveText(readouts, write);
  const item = "flex items-baseline gap-1.5";
  return (
    <div className="num pointer-events-none absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-4 whitespace-nowrap rounded-full border border-white/10 bg-[#02040b]/55 px-4 py-2 text-[11px] text-white/85 backdrop-blur-md sm:gap-6 sm:px-5 sm:text-xs" aria-hidden>
      <span ref={phase} className="font-semibold text-[#86efac] data-[phase=gearDown]:text-[#4ade80]" />
      <span className={item}><span ref={spd} className="text-white/45">IAS</span>{/* before the film starts (or without WebGL): no figure rather than a meaningless 0 */}<span ref={ias}>—</span></span>
      <span className={item}><span className="text-white/45">ALT</span><span ref={alt}>—</span></span>
    </div>
  );
}

function ProgressRail({ readouts, labels }: { readouts: React.RefObject<Readouts>; labels: string[] }) {
  const items = useRef<(HTMLLIElement | null)[]>([]);
  const fill = useRef<HTMLSpanElement>(null);
  const write = useRef((r: Readouts) => {
    if (fill.current) fill.current.style.transform = `scaleY(${r.progress})`;
    // the welcome screen is chapter 0 and has no entry in the rail
    items.current.forEach((el, i) => el && (el.dataset.active = String(i === r.chapter - 1)));
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

