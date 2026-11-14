/**
 * Strato mark: pilot wings around an S, the universal badge of the profession.
 */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <rect width="32" height="32" rx="8" fill="#0E2A47" />
      <g transform="translate(.54 .54) scale(.646)">
        <path d="M19 24C14 20 8 19 2 19c3 3 7 5 12 6-3 1-6 1-9 1 4 2 9 3 14 1" fill="#E8EEF5" />
        <path d="M29 24c5-4 11-5 17-5-3 3-7 5-12 6 3 1 6 1 9 1-4 2-9 3-14 1" fill="#E8EEF5" />
        <path d="M28 17.5c-1.5-1.3-3-2-4.6-2-2.5 0-4.2 1.4-4.2 3.3 0 4.5 9.2 2.7 9.2 7.7 0 2.2-2 3.8-4.9 3.8-1.9 0-3.6-.8-5-2.2" stroke="#22D3EE" strokeWidth="2.6" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <LogoMark />
      <span className="font-brand text-[17px] font-bold uppercase leading-none tracking-[0.08em]">Strato</span>
    </span>
  );
}
