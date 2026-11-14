/**
 * Geardown logo. The name in spaced capitals, its O drawn as a landing-gear indicator light that shows
 * green. The mark is the cockpit's "three greens": nose and main gear down and locked.
 */
export const GREEN = "#22C55E";

function GearO({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden className={className}>
      <circle cx="20" cy="20" r="16.5" stroke="currentColor" strokeWidth="5" />
      <circle cx="20" cy="20" r="7.5" fill={GREEN} />
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
      <GearO className="mx-[0.06em] h-[0.8em] w-[0.8em]" />
      <span aria-hidden>WN</span>
    </span>
  );
}
