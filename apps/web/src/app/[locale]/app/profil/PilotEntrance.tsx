"use client";

import { UserRound } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useId } from "react";
import { useTranslations } from "next-intl";

/**
 * Profile hero: the crew badge sits on the left; on the right a uniformed pilot walks into frame, stops,
 * turns to three-quarter view and crosses their arms. The pilot's head is the subscriber's own photo,
 * or an illustrated avatar when there is none yet.
 */

const WALK = 2.4; // seconds of walking
const STEPS = 4; // full strides while walking

function stripesFor(rank?: string): number {
  const r = (rank ?? "").toLowerCase();
  if (/captain|commandant|cdb|capt/.test(r)) return 4;
  if (/second officer|cadet|élève/.test(r)) return 2;
  return 3;
}

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
    <section className="relative isolate overflow-hidden rounded-2xl border border-border bg-[#02040b]" style={{ minHeight: 380 }} aria-label={t("stageLabel")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/immersive/film/c68a/takeoff-poster-1280.webp" alt="" className="absolute inset-0 -z-10 h-full w-full scale-110 object-cover opacity-70 blur-[2px]" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#02040b]/85 via-[#02040b]/45 to-[#02040b]/20" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-t from-[#02040b]/80 to-transparent" />

      <div className="grid min-h-[380px] items-center gap-6 px-6 py-8 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:px-10">
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

        <div className="relative hidden h-[340px] self-end sm:block">
          <Pilot photo={photo} stripes={stripesFor(rank)} reduce={!!reduce} />
        </div>
      </div>
    </section>
  );
}

function Pilot({ photo, stripes, reduce }: { photo?: string; stripes: number; reduce: boolean }) {
  const uid = useId().replace(/:/g, "");
  const navy = "#13213a";
  const navyDark = "#0b1526";
  const gold = "#d4a72c";
  const skin = "#d9a988";

  // Stride keyframes for the walk, then rest at 0.
  const swing = (amp: number) => {
    if (reduce) return { rotate: 0 };
    const k: number[] = [];
    for (let i = 0; i < STEPS; i++) k.push(amp, -amp);
    return { rotate: [0, ...k, 0] };
  };
  const stride = { duration: WALK, ease: "linear" as const };
  const settle = WALK + 0.15;

  const sleeveStripes = (x: number, y: number, w: number) =>
    Array.from({ length: stripes }, (_, i) => <rect key={i} x={x} y={y - i * 5} width={w} height={2.6} rx={1} fill={gold} />);

  return (
    <motion.div
      className="absolute bottom-0 right-[6%] h-full"
      initial={reduce ? { opacity: 0 } : { x: "140%" }}
      animate={reduce ? { opacity: 1 } : { x: "0%" }}
      transition={reduce ? { duration: 0.4 } : { duration: WALK, ease: [0.3, 0.6, 0.45, 1] }}
    >
      {/* ground shadow */}
      <div className="absolute bottom-1 left-1/2 h-4 w-32 -translate-x-1/2 rounded-[50%] bg-black/45 blur-md" />
      <motion.svg
        viewBox="0 0 200 400"
        className="relative h-full w-auto drop-shadow-[0_20px_30px_rgba(0,0,0,.45)]"
        style={{ originX: 0.5, originY: 1 }}
        initial={reduce ? false : { scaleX: -0.9, y: 0 }}
        animate={
          reduce
            ? { scaleX: -1 }
            : { scaleX: [-0.9, -0.9, -1], y: [0, ...Array.from({ length: STEPS * 2 }, (_, i) => (i % 2 ? 0 : -4)), 0, 0] }
        }
        transition={reduce ? undefined : { scaleX: { duration: settle + 0.5, times: [0, settle / (settle + 0.5), 1] }, y: { duration: WALK, ease: "easeInOut" } }}
        aria-hidden
      >
        <defs>
          <clipPath id={`head-${uid}`}>
            <ellipse cx="100" cy="66" rx="27" ry="33" />
          </clipPath>
        </defs>

        {/* back leg */}
        <motion.g style={{ originX: "112px", originY: "222px" }} initial={false} animate={swing(-13)} transition={stride}>
          <path d="M100 214 h26 l-3 152 h-20 z" fill={navyDark} />
          <path d="M101 364 h22 a10 9 0 0 1 10 9 v5 h-32 z" fill="#05070c" />
        </motion.g>
        {/* front leg */}
        <motion.g style={{ originX: "88px", originY: "222px" }} initial={false} animate={swing(13)} transition={stride}>
          <path d="M74 214 h26 l-3 152 h-20 z" fill={navy} />
          <path d="M75 364 h22 a10 9 0 0 1 10 9 v5 h-32 z" fill="#0a0d14" />
        </motion.g>

        {/* back arm (walking) */}
        <motion.g
          style={{ originX: "128px", originY: "122px" }}
          initial={false}
          animate={reduce ? { opacity: 0 } : { ...swing(18), opacity: [1, 1, 0] }}
          transition={reduce ? undefined : { rotate: stride, opacity: { duration: settle + 0.3, times: [0, settle / (settle + 0.3), 1] } }}
        >
          <path d="M128 118 q-6 0 -8 10 l-2 92 h22 l-2 -92 q-2 -10 -10 -10 z" fill={navyDark} />
          <circle cx="129" cy="226" r="9" fill={skin} />
        </motion.g>

        {/* torso: jacket, shirt, tie, wings */}
        <path d="M54 130 q4 -24 46 -27 q42 3 46 27 l4 106 q-50 8 -100 0 z" fill={navy} />
        <path d="M88 106 L100 152 L112 106 Z" fill="#f4f6f9" />
        <path d="M97 110 h6 l3 34 l-6 10 l-6 -10 z" fill="#1d4ed8" />
        <path d="M88 106 L100 160 L76 120 Z M112 106 L100 160 L124 120 Z" fill={navyDark} opacity="0.55" />
        <g transform="translate(118 140)">
          <path d="M0 0 h18 l-3 3 h-12 z" fill={gold} />
          <circle cx="9" cy="1.5" r="2.4" fill={gold} />
        </g>
        <circle cx="100" cy="176" r="2" fill={gold} />
        <circle cx="100" cy="196" r="2" fill={gold} />
        {/* shoulder boards */}
        <rect x="62" y="114" width="24" height="9" rx="2" fill={navyDark} transform="rotate(-8 74 118)" />
        <rect x="114" y="114" width="24" height="9" rx="2" fill={navyDark} transform="rotate(8 126 118)" />

        {/* front arm (walking) */}
        <motion.g
          style={{ originX: "70px", originY: "122px" }}
          initial={false}
          animate={reduce ? { opacity: 0 } : { ...swing(-18), opacity: [1, 1, 0] }}
          transition={reduce ? undefined : { rotate: stride, opacity: { duration: settle + 0.3, times: [0, settle / (settle + 0.3), 1] } }}
        >
          <path d="M70 118 q-8 0 -10 10 l-2 92 h22 l-2 -92 q-2 -10 -8 -10 z" fill={navy} />
          {sleeveStripes(58, 212, 22)}
          <circle cx="69" cy="226" r="9" fill={skin} />
        </motion.g>

        {/* crossed arms (after the stop) */}
        <motion.g initial={{ opacity: reduce ? 1 : 0 }} animate={{ opacity: 1 }} transition={reduce ? { duration: 0 } : { delay: settle, duration: 0.45 }}>
          <path d="M56 130 q-8 30 -4 54 l26 4 l2 -50 z" fill={navyDark} />
          <path d="M144 130 q8 30 4 54 l-26 4 l-2 -50 z" fill={navy} />
          <rect x="52" y="168" width="92" height="22" rx="11" fill={navyDark} />
          <rect x="58" y="182" width="92" height="22" rx="11" fill={navy} />
          {Array.from({ length: stripes }, (_, i) => (
            <rect key={i} x={64 + i * 5} y={184} width={2.6} height={18} rx={1} fill={gold} />
          ))}
          <ellipse cx="146" cy="178" rx="9" ry="8" fill={skin} />
          <ellipse cx="54" cy="193" rx="9" ry="8" fill={skin} />
        </motion.g>

        {/* neck + head */}
        <rect x="90" y="92" width="20" height="18" rx="6" fill={skin} />
        {photo ? (
          <g>
            <ellipse cx="100" cy="66" rx="28.5" ry="34.5" fill="#0b1526" />
            {/* the headshot is mirrored back so the face is not flipped by the body's scaleX */}
            <g clipPath={`url(#head-${uid})`}>
              <image href={photo} x="54" y="28" width="92" height="92" preserveAspectRatio="xMidYMin slice" transform="translate(200 0) scale(-1 1)" />
            </g>
          </g>
        ) : (
          <g>
            <ellipse cx="100" cy="68" rx="26" ry="31" fill={skin} />
            <path d="M73 62 q1 -32 28 -32 q27 1 26 32 q-5 -13 -20 -15 q-19 -2 -34 15 z" fill="#2b1d14" />
            <ellipse cx="109" cy="70" rx="2.3" ry="3.2" fill="#1b1410" />
            <ellipse cx="91" cy="70" rx="2.3" ry="3.2" fill="#1b1410" />
            <path d="M93 84 q7 5 14 0" stroke="#7a4a35" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          </g>
        )}
      </motion.svg>
    </motion.div>
  );
}
