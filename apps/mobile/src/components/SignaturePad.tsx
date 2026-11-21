import React, { useContext, useMemo, useRef, useState } from "react";
import { PanResponder, View } from "react-native";
import Svg, { Path, SvgXml } from "react-native-svg";
import { useTheme } from "../theme";
import { ScrollLock } from "./ui";

const W = 320;
const H = 150;

/** Strokes drawn with the finger, kept as SVG paths in a fixed 320×150 box. */
export function SignaturePad({ onChange }: { onChange: (paths: string[]) => void }) {
  const c = useTheme();
  // the screen must not scroll while the finger signs
  const lock = useContext(ScrollLock);
  const lockRef = useRef(lock);
  lockRef.current = lock;
  const [paths, setPaths] = useState<string[]>([]);
  const current = useRef<string>("");
  const size = useRef({ w: W, h: H });
  const scale = (x: number, y: number) => `${((x / size.current.w) * W).toFixed(1)},${((y / size.current.h) * H).toFixed(1)}`;
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderTerminate: () => lockRef.current(false),
        onPanResponderGrant: (e) => {
          current.current = `M${scale(e.nativeEvent.locationX, e.nativeEvent.locationY)}`;
          setPaths((p) => [...p, current.current]);
        },
        onPanResponderMove: (e) => {
          current.current += ` L${scale(e.nativeEvent.locationX, e.nativeEvent.locationY)}`;
          setPaths((p) => [...p.slice(0, -1), current.current]);
        },
        onPanResponderRelease: () => {
          lockRef.current(false);
          setPaths((p) => {
            onChange(p);
            return p;
          });
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  return (
    <View
      {...pan.panHandlers}
      // locks the scroll at the very first touch, before the scroll view can claim the gesture
      onTouchStart={() => lock(true)}
      onTouchEnd={() => lock(false)}
      onTouchCancel={() => lock(false)}
      onLayout={(e) => (size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={{ height: 160, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: "#ffffff", overflow: "hidden" }}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {paths.map((d, i) => (
          <Path key={i} d={d} stroke="#0a1626" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        ))}
      </Svg>
    </View>
  );
}

/** The signature as an SVG data URL (what the web app shows in an <img>). */
export function signatureSvg(paths: string[]): string {
  const body = paths.map((d) => `<path d="${d}" stroke="#0a1626" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#ffffff"/>${body}</svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/** Shows a stored signature: SVG (signed on a phone) or PNG (signed on the website). */
export function SignatureImage({ dataUrl }: { dataUrl: string }) {
  const svg = dataUrl.match(/^data:image\/svg\+xml;base64,(.+)$/);
  if (svg) return <SvgXml xml={atob(svg[1]!)} width="100%" height={70} />;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Image } = require("expo-image") as typeof import("expo-image");
  return <Image source={{ uri: dataUrl }} style={{ width: "100%", height: 70 }} contentFit="contain" />;
}
