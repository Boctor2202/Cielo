"use client";

import { UserRound } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";

/** Profile hero: the crew badge, still, on the left of the apron photo. */


export function PilotEntrance({ photo, name, rank, employer, base }: { photo?: string; name: string; rank?: string; employer?: string; base?: string }) {
  const t = useTranslations("app.profile");
  const reduce = useReducedMotion();

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

  return (
    <section className="relative isolate overflow-hidden rounded-2xl border border-border bg-[#02040b]" style={{ minHeight: 340 }} aria-label={t("stageLabel")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/immersive/film/c68a/takeoff-poster-1280.webp" alt="" className="absolute inset-0 -z-10 h-full w-full scale-110 object-cover opacity-70 blur-[2px]" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#02040b]/85 via-[#02040b]/45 to-[#02040b]/20" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-t from-[#02040b]/80 to-transparent" />

      <div className="grid min-h-[340px] items-center gap-6 px-6 py-8 sm:px-10">
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.8, 0.3, 1] }}
          className="w-[min(100%,320px)] rounded-2xl border border-white/15 bg-[#02040b]/65 p-5 text-white shadow-[0_30px_60px_-20px_rgba(0,0,0,.7)] backdrop-blur-xl"
        >
          <div className="flex items-center gap-4">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl ring-2 ring-[#22c55e]/80">
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
        </motion.div>
      </div>
    </section>
  );
}
