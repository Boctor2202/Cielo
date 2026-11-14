/**
 * Sillage mark: the contrail of a climbing aircraft, rising above the horizon line.
 */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <rect width="32" height="32" rx="8" fill="#0E2A47" />
      <path d="M5.5 23.5h21" stroke="#E8EEF5" strokeOpacity=".3" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M8.5 23.4C15.5 23 20.5 18.5 25.3 9.8" stroke="#E8EEF5" strokeOpacity=".5" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M5.8 20.8C12.8 20.4 18 16 22.6 7.6" stroke="#22D3EE" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="22.9" cy="7.4" r="2.3" fill="#22D3EE" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <LogoMark />
      <span className="font-display text-[22px] font-semibold italic leading-none tracking-[-0.01em]">Sillage</span>
    </span>
  );
}
