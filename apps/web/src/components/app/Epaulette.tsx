/** A pilot's shoulder board: navy, with 2, 3 or 4 gold stripes at the outer end and a button at the collar end. */
export function Epaulette({ stripes, className, title }: { stripes: 2 | 3 | 4; className?: string; title?: string }) {
  const W = 84;
  const H = 26;
  const gap = 6;
  const bar = 3.6;
  const x0 = W - 8 - stripes * bar - (stripes - 1) * (gap - bar);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className={className} role="img" aria-label={title}>
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id="ep-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F6D77A" />
          <stop offset=".5" stopColor="#D4A93A" />
          <stop offset="1" stopColor="#A97C1E" />
        </linearGradient>
        <linearGradient id="ep-navy" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1B2C47" />
          <stop offset="1" stopColor="#0B1526" />
        </linearGradient>
      </defs>
      {/* the board, pointed at the collar end */}
      <path d={`M0 ${H / 2} L10 1 H${W - 3} Q${W - 1} 1 ${W - 1} 3 V${H - 3} Q${W - 1} ${H - 1} ${W - 3} ${H - 1} H10 Z`} fill="url(#ep-navy)" stroke="rgba(255,255,255,.18)" />
      <circle cx="12" cy={H / 2} r="3.4" fill="url(#ep-gold)" />
      {Array.from({ length: stripes }, (_, i) => (
        <rect key={i} x={x0 + i * gap} y="3" width={bar} height={H - 6} rx="0.6" fill="url(#ep-gold)" />
      ))}
    </svg>
  );
}
