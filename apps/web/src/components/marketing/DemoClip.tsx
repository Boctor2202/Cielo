"use client";

import { useRef } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { useLocale } from "next-intl";

/**
 * A clip filmed on the real app (demo account, fictional data), in the page's language: loaded only near the
 * viewport, the still frame with reduced motion.
 */
export function DemoClip({ name, label, className = "" }: { name: "adsb" | "import" | "audit" | "sign"; label: string; className?: string }) {
  const lang = useLocale() === "fr" ? "fr" : "en";
  const reduce = !!useReducedMotion();
  const ref = useRef<HTMLVideoElement>(null);
  const near = useInView(ref, { once: true, margin: "300px 0px" });
  return (
    <video
      ref={ref}
      className={`block aspect-[1140/900] h-auto w-full bg-[#0b1626] ${className}`}
      poster={`/immersive/demo/${name}-${lang}-poster.webp`}
      autoPlay={!reduce}
      muted
      loop
      playsInline
      preload="none"
      aria-label={label}
    >
      {near && !reduce && (
        <>
          <source src={`/immersive/demo/${name}-${lang}-1280.mp4`} type="video/mp4" media="(min-width: 768px)" />
          <source src={`/immersive/demo/${name}-${lang}-720.mp4`} type="video/mp4" />
        </>
      )}
    </video>
  );
}
