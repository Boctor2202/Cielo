import React from "react";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

/** A pilot's shoulder board: navy, with its 2, 3 or 4 gold stripes. */
export function Epaulette({ stripes }: { stripes: 2 | 3 | 4 }) {
  // just long enough for the stripes, after the pointed collar end
  const H = 22;
  const gap = 5.5;
  const bar = 3.4;
  const W = 14 + stripes * gap + 4;
  const x0 = 14;
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
      <Path d={`M0 ${H / 2} L8 1 H${W - 3} Q${W - 1} 1 ${W - 1} 3 V${H - 3} Q${W - 1} ${H - 1} ${W - 3} ${H - 1} H8 Z`} fill="url(#epn)" stroke="rgba(255,255,255,0.18)" />
      {Array.from({ length: stripes }, (_, i) => (
        <Rect key={i} x={x0 + i * gap} y={3} width={bar} height={H - 6} rx={0.6} fill="url(#epg)" />
      ))}
    </Svg>
  );
}
