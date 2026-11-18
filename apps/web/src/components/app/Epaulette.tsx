/** A pilot's shoulder board: navy, with its 2, 3 or 4 gold stripes. */
export function Epaulette({ stripes, className, title }: { stripes: 2 | 3 | 4; className?: string; title?: string }) {
  // just long enough for the stripes, after the pointed collar end
  const H = 22;
  const gap = 5.5;
  const bar = 3.4;
  const W = 14 + stripes * gap + 4;
  const x0 = 14;
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
      <path d={`M0 ${H / 2} L8 1 H${W - 3} Q${W - 1} 1 ${W - 1} 3 V${H - 3} Q${W - 1} ${H - 1} ${W - 3} ${H - 1} H8 Z`} fill="url(#ep-navy)" stroke="rgba(255,255,255,.18)" />
      {Array.from({ length: stripes }, (_, i) => (
        <rect key={i} x={x0 + i * gap} y="3" width={bar} height={H - 6} rx="0.6" fill="url(#ep-gold)" />
      ))}
    </svg>
  );
}
