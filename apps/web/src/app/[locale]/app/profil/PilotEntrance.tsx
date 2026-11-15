"use client";

import { UserRound } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * The pilot's entrance on the profile page. One generic clip for every subscriber (a uniformed pilot walks in,
 * stops in three-quarter view, arms crossed, face in backlight) plays once; the subscriber's own photo then
 * appears on a crew badge beside them. Until the clip exists at CLIP, the badge itself walks in.
 */
const CLIP = "/immersive/pilot/walk-in";

export function PilotEntrance({ photo, name, rank, employer, base }: { photo?: string; name: string; rank?: string; employer?: string; base?: string }) {
  const t = useTranslations("app.profile");
  const reduce = useReducedMotion();
  const [clip, setClip] = useState<"checking" | "yes" | "no">("checking");

  useEffect(() => {
    let alive = true;
    fetch(`${CLIP}-1280.mp4`, { method: "HEAD" })
      .then((r) => alive && setClip(r.ok ? "yes" : "no"))
      .catch(() => alive && setClip("no"));
    return () => {
      alive = false;
    };
  }, []);

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

  // Walk in from the left with a light step rhythm, then turn to three-quarter view and settle.
  const walk = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.4 } }
    : {
        initial: { x: "-70vw", rotateY: 0, y: 0, opacity: 1 },
        animate: { x: ["-70vw", "-30vw", "0vw", "0vw"], y: [0, -6, 0, -5, 0, -4, 0, 0], rotateY: [0, 0, 0, -22] },
        transition: { duration: 2.4, times: [0, 0.4, 0.78, 1], ease: [0.25, 0.8, 0.3, 1] as const, y: { duration: 1.9, ease: "easeInOut" as const } },
      };

  return (
    <section className="relative isolate overflow-hidden rounded-2xl border border-border bg-[#02040b] [perspective:1200px]" style={{ minHeight: 340 }} aria-label={t("stageLabel")}>
      {/* apron at dawn, from the home film */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/immersive/film/c68a/takeoff-poster-1280.webp" alt="" className="absolute inset-0 -z-10 h-full w-full scale-110 object-cover opacity-70 blur-[2px]" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#02040b]/85 via-[#02040b]/45 to-[#02040b]/20" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-t from-[#02040b]/80 to-transparent" />

      {clip === "yes" && (
        <video className="absolute inset-0 h-full w-full object-cover" src={`${CLIP}-1280.mp4`} poster={`${CLIP}-poster.webp`} muted playsInline autoPlay={!reduce} preload="auto" />
      )}

      <div className="flex min-h-[340px] items-center px-6 py-8 sm:px-10">
        {clip !== "checking" && (
          <motion.div className="ml-auto mr-[4%] [transform-style:preserve-3d]" {...walk}>
            <div className="w-[min(78vw,300px)] rounded-2xl border border-white/15 bg-[#02040b]/65 p-5 text-white shadow-[0_30px_60px_-20px_rgba(0,0,0,.7)] backdrop-blur-xl">
              <div className="flex items-center gap-4">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl ring-2 ring-[#22c55e]/80 ring-offset-2 ring-offset-transparent">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt={name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center bg-[#0e2a47] text-2xl font-semibold">{initials || <UserRound size={34} />}</div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="mono-label !text-[10px] !text-[#86efac]">{t("crew")}</p>
                  <p className="truncate font-display text-xl font-semibold leading-tight">{name || t("noName")}</p>
                  {rank && <p className="truncate text-sm text-white/80">{rank}</p>}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-xs text-white/70">
                <span className="truncate">{employer || "—"}</span>
                <span className="num font-semibold text-white">{base || "····"}</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
