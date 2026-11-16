/**
 * Geardown logo. The name in spaced capitals, its O drawn as the cockpit's "three greens" (nose and main
 * gear down and locked). The three greens on their own are the app icon and favicon.
 */
export const GREEN = "#22C55E";

/** The O of the wordmark: a ring around the three greens (nose gear on top, main gears below). */
function ThreeGreensO({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden className={className}>
      <circle cx="20" cy="20" r="17.3" stroke="currentColor" strokeWidth="3.4" />
      <circle cx="20" cy="13.4" r="4.6" fill={GREEN} />
      <circle cx="14" cy="23.8" r="4.6" fill={GREEN} />
      <circle cx="26" cy="23.8" r="4.6" fill={GREEN} />
    </svg>
  );
}

/** Three greens: nose gear on top, the two main gears below. */
export const MARK_SVG = `<rect width="40" height="40" rx="10" fill="#0B1A2E"/><circle cx="20" cy="13.5" r="5" fill="${GREEN}"/><circle cx="11.5" cy="26.5" r="5" fill="${GREEN}"/><circle cx="28.5" cy="26.5" r="5" fill="${GREEN}"/>`;

export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden className={className}>
      <rect width="40" height="40" rx="10" fill="#0B1A2E" />
      <circle cx="20" cy="13.5" r="5" fill={GREEN} />
      <circle cx="11.5" cy="26.5" r="5" fill={GREEN} />
      <circle cx="28.5" cy="26.5" r="5" fill={GREEN} />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline text-[17px] font-bold leading-none tracking-[0.18em] ${className ?? ""}`} aria-label="Geardown">
      {/* GEAR bold, DOWN regular: the ring of the O drawn at the weight of the regular letters */}
      <span aria-hidden>GEAR</span>
      <span aria-hidden className="font-normal">D</span>
      {/* 1.3 times the height of the letters, centred on them: the box sits on the baseline (flex, items-baseline),
          so it is lowered by half its height less the middle of the capitals (0.36em) */}
      <ThreeGreensO className="relative top-[0.29em] mr-[0.18em] h-[1.3em] w-[1.3em] shrink-0" />
      <span aria-hidden className="font-normal">WN</span>
    </span>
  );
}
