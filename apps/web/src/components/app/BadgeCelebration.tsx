"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { useReducedMotion } from "motion/react";
import { badgeEmblemSvg, TIER_COLORS, type DiscoveryBadge } from "@cielo/core";

/** How long each badge stays on screen before the next one comes. */
const SHOW_MS = 3500;
const OUT_MS = 450;

/**
 * Full-screen celebration of the badges just unlocked, one after the other: rays in the badge's metal, a burst of
 * confetti, the badge popping in with a shine, its name and what it rewards. A click (or Space / Enter) moves to
 * the next one, Escape skips them all. Reduced motion: no rays, no confetti, a plain fade.
 */
export function BadgeCelebration({ badges, onDone }: { badges: DiscoveryBadge[]; onDone: () => void }) {
  const t = useTranslations("app.badges");
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const burst = useRef<(c: string[]) => void>(() => {});
  const b = badges[i];

  const next = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(() => {
      setLeaving(false);
      if (i + 1 < badges.length) setI(i + 1);
      else onDone();
    }, OUT_MS);
  };

  // each badge: confetti, then the next one after a few seconds
  useEffect(() => {
    if (!b) return;
    if (!reduce) burst.current([...TIER_COLORS[b.tier], "#22c55e", "#86efac", "#ffffff", "#60a5fa"]);
    const id = setTimeout(next, SHOW_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDone();
      else if (e.key === " " || e.key === "Enter") next();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  // the confetti, drawn on a canvas
  useEffect(() => {
    const cv = canvas.current;
    const cx = cv?.getContext("2d");
    if (!cv || !cx || reduce) return;
    type P = { x: number; y: number; vx: number; vy: number; r: number; c: string; rot: number; vr: number; life: number };
    let parts: P[] = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = () => {
      cv.width = window.innerWidth * dpr;
      cv.height = window.innerHeight * dpr;
    };
    size();
    window.addEventListener("resize", size);
    burst.current = (cols) => {
      for (let k = 0; k < 170; k++) {
        const a = Math.random() * Math.PI * 2;
        const s = (8 + Math.random() * 22) * (dpr / 2);
        parts.push({ x: cv.width / 2, y: cv.height * 0.4, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 10 * (dpr / 2), r: (6 + Math.random() * 10) * (dpr / 2), c: cols[k % cols.length]!, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, life: 0 });
      }
    };
    let raf = 0;
    const tick = () => {
      cx.clearRect(0, 0, cv.width, cv.height);
      for (const p of parts) {
        p.vy += 0.55 * (dpr / 2);
        p.vx *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life++;
        cx.save();
        cx.translate(p.x, p.y);
        cx.rotate(p.rot);
        cx.globalAlpha = Math.max(0, 1 - p.life / 160);
        cx.fillStyle = p.c;
        cx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
        cx.restore();
      }
      parts = parts.filter((p) => p.life < 160 && p.y < cv.height + 40);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // the first badge was set before the canvas was ready
    if (b) burst.current([...TIER_COLORS[b.tier], "#22c55e", "#86efac", "#ffffff", "#60a5fa"]);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  const svg = useMemo(() => (b ? badgeEmblemSvg({ series: b.series, id: b.id, tier: b.tier, rank: b.rank, of: b.of, size: 220, key: `cel-${b.id}` }) : ""), [b]);
  const mask = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  if (!b || typeof document === "undefined") return null;
  const [c1, c2] = TIER_COLORS[b.tier];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("unlockedTitle")}
      onClick={next}
      className="badge-cel fixed inset-0 z-[100] flex cursor-pointer select-none flex-col items-center justify-center overflow-hidden"
      style={{ ["--c1" as string]: c1, ["--c2" as string]: c2, background: "radial-gradient(circle at 50% 42%, #1c2f52 0%, #07101f 70%)" }}
    >
      <style>{CSS}</style>
      {!reduce && <div className="bc-glow" />}
      {!reduce && <div className="bc-rays" />}
      <canvas ref={canvas} className="pointer-events-none absolute inset-0 h-full w-full" />
      <div key={i} className={`relative flex flex-col items-center px-6 text-center ${leaving ? "bc-out" : "bc-in"}`}>
        <p className="bc-kick font-mono text-[13px] font-bold uppercase tracking-[0.25em] text-[#86efac]">{t("unlockedTitle")}</p>
        <div className="bc-badge relative mt-5 mb-3" style={{ width: 220, height: (220 * 68) / 64 }}>
          <div dangerouslySetInnerHTML={{ __html: svg }} />
          {!reduce && (
            <div className="absolute inset-0 overflow-hidden" style={{ WebkitMaskImage: mask, maskImage: mask, WebkitMaskSize: "100% 100%", maskSize: "100% 100%" }}>
              <div className="bc-sweep" />
            </div>
          )}
        </div>
        <h2 className="bc-name text-[32px] font-extrabold leading-tight text-white">{t(`d.${b.id}`)}</h2>
        <p className="bc-desc mt-1.5 text-base text-[#c8d4e4]">{t(`dd.${b.id}`)}</p>
        <p className="bc-tier mt-3.5 rounded-full px-3 py-1 font-mono text-xs font-bold text-[#0a1626]" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
          {t(`tiers.${b.tier}`)}{b.of > 1 ? ` · ${b.rank}/${b.of}` : ""}
        </p>
      </div>
      {badges.length > 1 && (
        <div className="absolute bottom-24 flex gap-2">
          {badges.map((x, k) => (
            <span key={x.id} className={`h-2 rounded-full transition-all ${k === i ? "w-6 bg-white" : "w-2 bg-white/25"}`} />
          ))}
        </div>
      )}
      <div className="absolute bottom-12 flex items-center gap-4 text-[13px] text-[#8ea0b8]">
        <span>{t("tapNext")}</span>
        {badges.length > 1 && (
          <button type="button" className="rounded-full border border-white/20 px-3 py-1 text-white/80 hover:bg-white/10" onClick={(e) => { e.stopPropagation(); onDone(); }}>
            {t("skipAll")}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

const CSS = `
.badge-cel{animation:bc-fade .35s ease-out}
@keyframes bc-fade{from{opacity:0}}
.bc-rays{position:absolute;left:50%;top:40%;width:900px;height:900px;margin:-450px 0 0 -450px;border-radius:50%;opacity:.55;animation:bc-spin 14s linear infinite;
 background:repeating-conic-gradient(from 0deg,var(--c1) 0 6deg,transparent 6deg 18deg);-webkit-mask:radial-gradient(circle,#000 0%,transparent 62%);mask:radial-gradient(circle,#000 0%,transparent 62%)}
@keyframes bc-spin{to{transform:rotate(360deg)}}
.bc-glow{position:absolute;left:50%;top:40%;width:340px;height:340px;margin:-170px 0 0 -170px;border-radius:50%;background:radial-gradient(circle,var(--c1) 0%,transparent 65%);opacity:.45}
.bc-in .bc-badge{animation:bc-pop .9s cubic-bezier(.2,1.6,.4,1) both;filter:drop-shadow(0 18px 40px rgba(0,0,0,.6))}
.bc-in .bc-kick{animation:bc-up .5s .35s both}.bc-in .bc-name{animation:bc-up .5s .55s both}.bc-in .bc-desc{animation:bc-up .5s .7s both}.bc-in .bc-tier{animation:bc-up .5s .85s both}
.bc-out .bc-badge{animation:bc-away .45s forwards}.bc-out .bc-kick,.bc-out .bc-name,.bc-out .bc-desc,.bc-out .bc-tier{animation:bc-hide .3s forwards}
@keyframes bc-pop{0%{transform:scale(0) rotate(-25deg)}70%{transform:scale(1.12) rotate(4deg)}100%{transform:none}}
@keyframes bc-up{from{opacity:0;transform:translateY(12px)}}
@keyframes bc-hide{to{opacity:0}}
@keyframes bc-away{to{transform:scale(.4) translateY(-120px);opacity:0}}
.bc-sweep{position:absolute;top:0;left:-60%;width:40%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.75),transparent);transform:skewX(-18deg);animation:bc-sw 1.1s 1s ease-in-out both}
@keyframes bc-sw{from{left:-60%}to{left:130%}}
@media (prefers-reduced-motion: reduce){.bc-in .bc-badge,.bc-in .bc-kick,.bc-in .bc-name,.bc-in .bc-desc,.bc-in .bc-tier{animation:bc-hide .01s reverse both}}
`;
