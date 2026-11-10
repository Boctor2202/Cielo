/**
 * Cielo mark: a climbing flight path that draws the letter C, ending on a heading marker.
 */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <rect width="32" height="32" rx="8" fill="#0E2A47" />
      <path d="M22.5 9.2A9 9 0 1 0 23.6 21.4" stroke="#22D3EE" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M8.5 16h6" stroke="#E8EEF5" strokeOpacity=".35" strokeWidth="1.4" strokeLinecap="round" />
      <path d="m21.2 6.6 4.4 1.1-2.1 4z" fill="#22D3EE" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <LogoMark />
      <span className="text-[19px] font-bold tracking-tight">Cielo</span>
    </span>
  );
}
