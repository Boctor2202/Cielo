import React from "react";
import { View } from "react-native";
import { Row, Txt } from "./ui";
import { useTheme } from "../theme";

/** A thin progress track, used for limits and shares. */
export function Track({ ratio, color }: { ratio: number; color?: string }) {
  const c = useTheme();
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: c.scheme === "dark" ? "rgba(255,255,255,0.12)" : "rgba(10,22,38,0.10)" }}>
      <View style={{ height: 6, borderRadius: 3, width: `${Math.max(0, Math.min(1, ratio)) * 100}%`, backgroundColor: color ?? c.accent }} />
    </View>
  );
}

/** Label, value on the right, bar underneath. */
export function BarRow({ label, value, ratio, sub, color }: { label: string; value: string; ratio: number; sub?: string; color?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Row style={{ justifyContent: "space-between" }}>
        <Txt numberOfLines={1} style={{ flex: 1 }}>{label}</Txt>
        <Txt mono variant="small">{value}</Txt>
      </Row>
      <Track ratio={ratio} color={color} />
      {sub ? <Txt variant="small">{sub}</Txt> : null}
    </View>
  );
}
