/**
 * Strato logo: the name in spaced capitals, the O drawn as an artificial horizon in a climb.
 * The O on its own is the app icon and favicon.
 */
function HorizonO({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden className={className}>
      <circle cx="20" cy="20" r="16.5" stroke="currentColor" strokeWidth="5" />
      <path d="M6 23.5 34 16.5" stroke="#22D3EE" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden className={className}>
      <rect width="40" height="40" rx="10" fill="#0B1A2E" />
      <circle cx="20" cy="20" r="12" stroke="#EEF3F8" strokeWidth="3.6" />
      <path d="M9.5 22.6 30.5 17.4" stroke="#22D3EE" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center text-[18px] font-bold leading-none tracking-[0.2em] ${className ?? ""}`} aria-label="Strato">
      <span aria-hidden>STRAT</span>
      <HorizonO className="ml-[0.02em] h-[0.8em] w-[0.8em]" />
    </span>
  );
}
