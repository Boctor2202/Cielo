import React from "react";
import { View } from "react-native";
import { SvgXml } from "react-native-svg";
import * as FLAGS from "country-flag-icons/string/3x2";

/** A round flag: the 3:2 flag cropped to a circle. */
export function Flag({ code, size = 26 }: { code: string; size?: number }) {
  const svg = (FLAGS as Record<string, string>)[code];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: "rgba(127,127,127,0.25)" }}>
      {svg ? <SvgXml xml={svg.replace("<svg ", '<svg preserveAspectRatio="xMidYMid slice" ')} width={size} height={size} /> : null}
    </View>
  );
}
