"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useLocale } from "next-intl";

/** The app's own colours, so the screens read as Geardown (dark theme). */
export const C = { bg: "#0b1626", surface: "#11223a", surface2: "#1c3352", line: "#ffffff14", text: "#e8eef5", muted: "#93a6bc", accent: "#22c55e", accent2: "#4ade80", sky: "#38bdf8", indigo: "#818cf8", amber: "#fbbf24", red: "#f87171" };

/** Starts once, when the screen is well in view; with reduced motion, everything is shown at its final state. */
export function useLive<T extends Element>(amount = 0.35): { ref: RefObject<T | null>; on: boolean; reduce: boolean } {
  const ref = useRef<T>(null);
  const inView = useInView(ref, { once: true, amount });
  const reduce = !!useReducedMotion();
  return { ref, on: inView || reduce, reduce };
}

export const useFr = () => useLocale() === "fr";
const nf = (locale: string) => (v: number) => Math.round(v).toLocaleString(locale === "fr" ? "fr-FR" : "en-GB").replace(/[  ]/g, " ");
/** Minutes as h:mm, thousands spaced. */
export const hm = (locale: string) => (m: number) => {
  const t = Math.round(m);
  return `${nf(locale)(Math.floor(t / 60))}:${String(t % 60).padStart(2, "0")}`;
};

/** A figure that counts up to its value when the screen comes in. */
export function Count({ to, on, format, duration = 1.6, delay = 0, className = "" }: { to: number; on: boolean; format?: (v: number) => string; duration?: number; delay?: number; className?: string }) {
  const locale = useLocale();
  const f = format ?? nf(locale);
  const reduce = !!useReducedMotion();
  const [v, setV] = useState(reduce ? to : 0);
  useEffect(() => {
    if (!on) return;
    if (reduce) return setV(to);
    const c = animate(0, to, { duration, delay, ease: [0.2, 0.8, 0.2, 1], onUpdate: setV });
    return () => c.stop();
  }, [on, to, duration, delay, reduce]);
  return <span className={`tabular-nums ${className}`}>{f(v)}</span>;
}

/** A window of the app: title bar and dark body, with a soft shadow and the glass edge. */
export function AppWindow({ title, children, className = "", bodyClass = "p-4" }: { title: string; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl text-left shadow-[0_40px_80px_-30px_rgba(0,0,0,.65)] ring-1 ring-white/10 ${className}`} style={{ background: C.bg, color: C.text }}>
      <div className="flex h-8 items-center gap-1.5 px-3" style={{ background: "#08111f" }}>
        <i className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <i className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <i className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="ml-3 truncate text-[11px]" style={{ color: C.muted }}>{title}</span>
      </div>
      <div className={bodyClass}>{children}</div>
    </div>
  );
}

/** A small label in capitals, as in the app. */
export const Label = ({ children }: { children: ReactNode }) => (
  <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: C.muted }}>{children}</p>
);

/** A round green check that pops in. */
export function Check({ on, delay = 0, color = C.accent }: { on: boolean; delay?: number; color?: string }) {
  const reduce = !!useReducedMotion();
  return (
    <span
      className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full text-[11px] font-black transition-transform"
      style={{ background: color, color: "#04140a", transform: on ? "scale(1)" : "scale(0)", transitionDuration: reduce ? "0ms" : "320ms", transitionDelay: `${delay}s`, transitionTimingFunction: "cubic-bezier(.3,1.6,.5,1)" }}
      aria-hidden
    >
      ✓
    </span>
  );
}
