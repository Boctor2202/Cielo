"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Fades children in when they enter the viewport. Children with `.reveal` get a 45 ms stagger via --i. */
export function Reveal({ children, className = "", as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "ul" }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const items = [root, ...Array.from(root.querySelectorAll<HTMLElement>(".reveal"))].filter((el) => el.classList.contains("reveal"));
    items.forEach((el, i) => el.style.setProperty("--i", String(el === root ? 0 : i)));
    if (typeof IntersectionObserver === "undefined") {
      items.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    // @ts-expect-error -- polymorphic ref
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
