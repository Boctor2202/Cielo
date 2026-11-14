/**
 * Strato mark: three flight levels and the arrow of a career climbing through them.
 */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <rect width="32" height="32" rx="8" fill="#0E2A47" />
      <path d="M6 11h14M6 16.5h10M6 22h6" stroke="#E8EEF5" strokeOpacity=".55" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M12.5 27L25.5 7.5" stroke="#22D3EE" strokeWidth="3" strokeLinecap="round" />
      <path d="M19.5 7h6.5v6.5" stroke="#22D3EE" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <LogoMark />
      <span className="font-brand text-[19px] font-semibold lowercase leading-none tracking-[-0.02em]">strato</span>
    </span>
  );
}
