"use client";

import { ArrowRight, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Reveal } from "../Reveal";
import { StoreBadges } from "../sections";
import { createReadouts, readoutsAt, smooth, type Readouts } from "./timeline";
import type { FlightScene } from "./scene";

const CHAPTER_VH = 115;
const CHAPTERS = 4;

const fmtClock = (m: number) => {
  const mm = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(mm / 60)).padStart(2, "0")}:${String(mm % 60).padStart(2, "0")}Z`;
};
const fmtDur = (m: number) => `${Math.floor(m / 60)}:${String(Math.round(m) % 60).padStart(2, "0")}`;
const fmtElev = (e: number) => `${e >= 0 ? "+" : "−"}${Math.abs(e).toFixed(1)}°`;

/**
 * Immersive home: a sticky WebGL scene scrubbed by scroll, with the story told in real DOM text on top
 * (headings stay indexable and readable by screen readers; the canvas carries an aria description).
 */
export function ImmersiveHome() {
  const t = useTranslations("immersive");
  const th = useTranslations("hero");
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readouts = useRef<Readouts>(createReadouts());
  const [fallback, setFallback] = useState(false);
  const [ready, setReady] = useState(false);

  const layers = useRef<Record<string, HTMLElement | null>>({});
  const setLayer = (k: string) => (el: HTMLElement | null) => {
    layers.current[k] = el;
  };

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;
    let scene: FlightScene | null = null;
    let disposed = false;
    let inView = true;
    let raf = 0;
    let target = 0;
    let cur = 0;
    let last = performance.now();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const progress = () => {
      const r = section.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      return span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
    };

    // Photo layers: cross-fades and slow Ken Burns zooms, all pure functions of scroll progress
    const paint = (p: number) => {
      const L = layers.current;
      const r = readouts.current;
      readoutsAt(p, r);
      const kb = (from: number, to: number, a: number, b: number) => (reduced ? 1.04 : from + (to - from) * smooth(a, b, p));
      const set = (k: string, opacity: number, transform?: string) => {
        const el = L[k];
        if (!el) return;
        el.style.opacity = opacity.toFixed(3);
        if (transform) el.style.transform = transform;
      };
      const globe = smooth(0.56, 0.66, p);
      set("takeoff", 1 - smooth(0.2, 0.3, p), `scale(${kb(1.14, 1.0, 0, 0.3)}) translateY(${(reduced ? 0 : -3 * smooth(0, 0.3, p)).toFixed(2)}%)`);
      set("wing", smooth(0.2, 0.3, p) * (1 - smooth(0.36, 0.46, p)), `scale(${kb(1.0, 1.1, 0.2, 0.46)}) translateX(${(reduced ? 0 : -2 * smooth(0.2, 0.46, p)).toFixed(2)}%)`);
      set("sunset", smooth(0.36, 0.46, p) * (1 - globe), `scale(${kb(1.04, 1.14, 0.36, 0.64)})`);
      const night = smooth(-2, -11, r.sunElevation);
      set("night", night * 0.88 * (1 - globe));
      set("stars", smooth(-5, -11, r.sunElevation) * (1 - globe));
      set("globe", globe);
      set("clouds", smooth(0.9, 0.98, p), `scale(${kb(1.12, 1.0, 0.9, 1)})`);
    };

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      // ~1 s of scrub lag for a cinematic feel (instant under reduced motion)
      cur = reduced ? target : cur + (target - cur) * (1 - Math.exp(-dt * 4.5));
      paint(cur);
      raf = inView ? requestAnimationFrame(loop) : 0;
    };
    const kick = () => {
      if (!raf && inView) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };
    const onScroll = () => {
      target = progress();
      scene?.setProgress(target);
      kick();
    };
    target = cur = progress();
    paint(cur);
    window.addEventListener("scroll", onScroll, { passive: true });

    (async () => {
      const mod = await import("./scene");
      if (disposed) return;
      if (!mod.webglAvailable()) {
        setFallback(true);
        return;
      }
      let dots: number[] = [];
      try {
        dots = await (await fetch("/data/globe-dots.json")).json();
      } catch {}
      if (disposed) return;
      try {
        scene = new mod.FlightScene(canvas, { reducedMotion: reduced, mobile: window.innerWidth < 768, globeDots: dots });
      } catch {
        setFallback(true);
        return;
      }
      scene.setProgress(target);
      if (inView && document.visibilityState === "visible") scene.start();
      setReady(true);
    })();

    // Work only while the section is on screen and the tab is visible
    const io = new IntersectionObserver(([e]) => {
      inView = !!e?.isIntersecting;
      if (inView && document.visibilityState === "visible") {
        scene?.start();
        kick();
      } else scene?.stop();
    });
    io.observe(section);
    const vis = () => (document.visibilityState === "visible" && inView ? scene?.start() : scene?.stop());
    document.addEventListener("visibilitychange", vis);
    const ro = new ResizeObserver(() => scene?.resize());
    ro.observe(canvas.parentElement!);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", vis);
      io.disconnect();
      ro.disconnect();
      scene?.dispose();
    };
  }, []);

  const chapters = t.raw("chapters") as string[];

  return (
    <section ref={sectionRef} className="relative bg-[#050a1a] text-white" style={{ height: `${CHAPTER_VH * CHAPTERS}vh` }}>
      {/* Stage */}
      <div className="sticky top-0 h-[100svh] overflow-hidden" role="img" aria-label={t("canvasLabel")}>
        <Photo name="takeoff" layer={setLayer("takeoff")} priority position="58% 100%" />
        <Photo name="wing" layer={setLayer("wing")} position="70% 50%" />
        <Photo name="sunset" layer={setLayer("sunset")} position="60% 50%" />
        {/* night falls over the photos as the sun passes −6° */}
        <div ref={setLayer("night")} className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(3,7,20,.95),rgba(9,18,44,.8)_55%,rgba(3,7,20,.92))] opacity-0" aria-hidden />
        <div ref={setLayer("stars")} className="immersive-stars absolute inset-0 opacity-0" aria-hidden />
        <div ref={setLayer("globe")} className="absolute inset-0 opacity-0">
          <div className="immersive-space absolute inset-0" aria-hidden />
          <canvas ref={canvasRef} aria-hidden className={`absolute inset-0 block h-full w-full transition-opacity duration-700 ${ready && !fallback ? "opacity-100" : "opacity-0"}`} />
        </div>
        <Photo name="clouds" layer={setLayer("clouds")} position="55% 60%" />
        {/* scrims and vignette keep the text readable on any photo */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_60%_45%,transparent_55%,rgba(3,7,20,.55))]" aria-hidden />
        <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[60%] bg-gradient-to-r from-[#050a1a]/75 via-[#050a1a]/30 to-transparent md:block" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[60%] bg-gradient-to-b from-[#050a1a]/80 to-transparent md:hidden" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#050a1a]/80 to-transparent" aria-hidden />
        <FlightStrip readouts={readouts} />
        <ProgressRail readouts={readouts} labels={chapters} />
      </div>

      {/* Story */}
      <div className="relative z-10 -mt-[100svh]">
        <Chapter align="left">
          <p className="mono-label inline-flex items-center gap-2 rounded-full border border-[#22d3ee]/40 bg-[#22d3ee]/10 px-3 py-1.5 !text-[#67e8f9]">
            <span className="blink h-1.5 w-1.5 rounded-full bg-[#22d3ee]" aria-hidden />
            {th("eyebrow")}
          </p>
          <h1 className="mt-6 text-balance text-[2.7rem] font-bold leading-[1.02] tracking-[-0.035em] [text-shadow:0_2px_30px_rgba(5,10,26,.6)] sm:text-6xl lg:text-[4.4rem]">{th("title")}</h1>
          <p className="mt-6 max-w-lg text-pretty text-lg leading-relaxed text-white/80">{th("subtitle")}</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/inscription" className="btn min-h-12 !bg-[#22d3ee] !px-6 text-base !text-[#0a1626] shadow-[0_10px_40px_-10px_#22d3ee] hover:!bg-[#67e8f9]">
              {th("ctaTrial")} <ArrowRight size={18} aria-hidden />
            </Link>
            <Link href={{ pathname: "/connexion", query: { demo: "1" } }} className="btn min-h-12 border border-white/25 !px-6 text-base text-white hover:border-white/60 hover:bg-white/10">
              {th("ctaDemo")}
            </Link>
          </div>
          <StoreBadges className="mt-8 [&_a]:!border-white/15 [&_a]:!bg-white [&_a]:!text-[#0a1626]" />
          <p className="mt-14 flex items-center gap-2 text-sm text-white/60" aria-hidden>
            <ChevronDown size={16} className="animate-bounce motion-reduce:animate-none" /> {t("scroll")}
          </p>
        </Chapter>

        <Chapter align="right">
          <Panel>
            <p className="mono-label !text-[#67e8f9]">{t("c1.label")}</p>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">{t("c1.title")}</h2>
            <p className="mt-4 leading-relaxed text-white/80">{t("c1.text")}</p>
            <NightHud readouts={readouts} />
          </Panel>
        </Chapter>

        <Chapter align="left">
          <Panel>
            <p className="mono-label !text-[#67e8f9]">{t("c2.label")}</p>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">{t("c2.title")}</h2>
            <p className="mt-4 leading-relaxed text-white/80">{t("c2.text")}</p>
          </Panel>
        </Chapter>

        <Chapter align="left">
          <Panel>
            <p className="mono-label !text-[#67e8f9]">{t("c3.label")}</p>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">{t("c3.title")}</h2>
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

/** Full-bleed HD photo layer (Unsplash), WebP in two sizes. Decorative: the stage carries the description. */
function Photo({ name, layer, priority, position }: { name: string; layer: (el: HTMLElement | null) => void; priority?: boolean; position: string }) {
  return (
    <div ref={layer} className="absolute inset-0 will-change-[opacity,transform]" style={{ opacity: name === "takeoff" ? 1 : 0 }} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/immersive/${name}-2400.webp`}
        srcSet={`/immersive/${name}-1200.webp 1200w, /immersive/${name}-2400.webp 2400w`}
        sizes="100vw"
        alt=""
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        className="h-full w-full object-cover"
        style={{ objectPosition: position }}
      />
    </div>
  );
}

function Chapter({ align, children }: { align: "left" | "right"; children: ReactNode }) {
  return (
    <div className="flex items-start md:items-center" style={{ height: `${CHAPTER_VH}vh` }}>
      <div className={`mx-auto flex w-full max-w-6xl px-4 pt-24 sm:px-6 md:pt-0 ${align === "right" ? "md:justify-end" : ""}`}>
        <Reveal className="reveal w-full max-w-xl">{children}</Reveal>
      </div>
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="hud-frame rounded-2xl border border-white/10 bg-[#050a1a]/45 p-6 shadow-2xl backdrop-blur-md sm:p-8">{children}</div>;
}

/** Writes live values straight into the DOM every frame. */
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
    // gauge: +8° (left) … −12° (right)
    if (needle.current) needle.current.style.left = `${Math.min(100, Math.max(0, ((8 - r.sunElevation) / 20) * 100))}%`;
  }).current;
  useLiveText(readouts, write);

  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-black/25 p-4" aria-hidden>
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

/** Instrument strip along the bottom of the stage (decorative). */
function FlightStrip({ readouts }: { readouts: React.RefObject<Readouts> }) {
  const utc = useRef<HTMLSpanElement>(null);
  const sun = useRef<HTMLSpanElement>(null);
  const alt = useRef<HTMLSpanElement>(null);
  const write = useRef((r: Readouts) => {
    if (utc.current) utc.current.textContent = fmtClock(r.utcMinutes);
    if (sun.current) sun.current.textContent = fmtElev(r.sunElevation);
    const fl = r.progress < 0.26 ? 50 + (r.progress / 0.26) * 320 : 370;
    if (alt.current) alt.current.textContent = fl < 5 ? "GND" : `FL${String(Math.round(fl)).padStart(3, "0")}`;
  }).current;
  useLiveText(readouts, write);
  const item = "flex items-baseline gap-1.5";
  return (
    <div className="num pointer-events-none absolute bottom-5 left-1/2 hidden -translate-x-1/2 items-center gap-6 rounded-full border border-white/10 bg-[#050a1a]/40 px-5 py-2 text-xs text-white/80 backdrop-blur-md md:flex" aria-hidden>
      <span className={item}><span className="text-white/45">ALT</span><span ref={alt}>FL370</span></span>
      <span className={item}><span className="text-white/45">GS</span>462 KT</span>
      <span className={item}><span className="text-white/45">HDG</span>142°</span>
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
    <div className="pointer-events-none absolute right-6 top-1/2 hidden -translate-y-1/2 items-stretch gap-3 lg:flex" aria-hidden>
      <ol className="flex flex-col justify-between gap-10 text-right">
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
