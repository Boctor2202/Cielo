"use client";

import { useEffect, useState, type ReactNode } from "react";

const DIGITS = "0123456789";

/**
 * A figure whose digits roll into place like an odometer when it shows (and when it changes): each digit is a
 * column 0–9 slid to its value. Works on any formatted text ("744:02", "1 234", "12 %"): only digits roll.
 * Static when the visitor asks for reduced motion.
 */
export function Roll({ children }: { children: ReactNode }) {
  const text = typeof children === "number" ? String(children) : children;
  const [shown, setShown] = useState(false);
  const [still, setStill] = useState(false);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setStill(true);
    // one frame at 0 first, so the columns have somewhere to roll from
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    return () => cancelAnimationFrame(id);
  }, []);
  if (typeof text !== "string" || still) return <>{children}</>;
  const chars = [...text];
  const n = chars.length;
  return (
    <span className="roll" aria-label={text}>
      {chars.map((ch, i) => {
        const d = DIGITS.indexOf(ch);
        // keyed from the right, so 99 → 100 rolls the right columns
        const key = n - i;
        if (d < 0) return <span key={`c${key}`} className="roll-sep" aria-hidden="true">{ch === " " ? "\u00a0" : ch}</span>;
        return (
          <span key={`d${key}`} className="roll-digit" aria-hidden="true">
            <span className="roll-col" style={{ transform: `translateY(-${(shown ? d : 0) * 10}%)`, transitionDelay: `${(n - i) * 45}ms` }}>
              {DIGITS.split("").map((x) => (
                <span key={x}>{x}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}
