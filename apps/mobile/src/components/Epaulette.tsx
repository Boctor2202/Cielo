import React from "react";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

/** A pilot's shoulder board: navy, with 2, 3 or 4 gold stripes at the outer end and a button at the collar end. */
export function Epaulette({ stripes }: { stripes: 2 | 3 | 4 }) {
  const W = 84;
  const H = 26;
  const gap = 6;
  const bar = 3.6;
  const x0 = W - 8 - stripes * bar - (stripes - 1) * (gap - bar);
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <LinearGradient id="epg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#F6D77A" />
          <Stop offset="0.5" stopColor="#D4A93A" />
          <Stop offset="1" stopColor="#A97C1E" />
        </LinearGradient>
        <LinearGradient id="epn" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#1B2C47" />
          <Stop offset="1" stopColor="#0B1526" />
        </LinearGradient>
      </Defs>
      <Path d={`M0 ${H / 2} L10 1 H${W - 3} Q${W - 1} 1 ${W - 1} 3 V${H - 3} Q${W - 1} ${H - 1} ${W - 3} ${H - 1} H10 Z`} fill="url(#epn)" stroke="rgba(255,255,255,0.18)" />
      <Circle cx={12} cy={H / 2} r={3.4} fill="url(#epg)" />
      {Array.from({ length: stripes }, (_, i) => (
        <Rect key={i} x={x0 + i * gap} y={3} width={bar} height={H - 6} rx={0.6} fill="url(#epg)" />
      ))}
    </Svg>
  );
}
