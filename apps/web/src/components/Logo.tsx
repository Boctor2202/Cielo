/**
 * Geardown logo. The name in spaced capitals, its O drawn as the cockpit's "three greens" (nose and main
 * gear down and locked). The three greens on their own are the app icon and favicon.
 */
export const GREEN = "#22C55E";

/** The O of the wordmark: a ring around the three greens (nose gear on top, main gears below). */
function ThreeGreensO({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden className={className}>
      <circle cx="20" cy="20" r="16.5" stroke="currentColor" strokeWidth="5" />
      <circle cx="20" cy="13.4" r="4.1" fill={GREEN} />
      <circle cx="14" cy="23.8" r="4.1" fill={GREEN} />
      <circle cx="26" cy="23.8" r="4.1" fill={GREEN} />
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
    <span className={`inline-flex items-center text-[17px] font-bold leading-none tracking-[0.18em] ${className ?? ""}`} aria-label="Geardown">
      <span aria-hidden>GEARD</span>
      <ThreeGreensO className="mx-[0.04em] h-[0.84em] w-[0.84em]" />
      <span aria-hidden>WN</span>
    </span>
  );
}
