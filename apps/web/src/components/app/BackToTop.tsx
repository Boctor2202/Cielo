"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** Back to the top of a long page: shows once the pilot has scrolled down, goes away near the top. */
export function BackToTop({ label }: { label: string }) {
  const [shown, setShown] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const on = () => setShown(window.scrollY > 900);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  // on the page itself: an animated ancestor (the page transition) would make "fixed" relative to it
  if (!mounted) return null;
  return createPortal(
    <button
      type="button"
      aria-label={label}
      title={label}
      tabIndex={shown ? 0 : -1}
      onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}
      className={`fixed bottom-24 right-4 z-40 grid h-11 w-11 place-items-center rounded-full bg-accent text-accent-contrast shadow-lg transition-all duration-200 hover:brightness-110 lg:bottom-6 lg:right-6 ${shown ? "pointer-events-auto scale-100 opacity-100" : "pointer-events-none scale-90 opacity-0"}`}
    >
      <ArrowUp size={20} />
    </button>,
    document.body,
  );
}
