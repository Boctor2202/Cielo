import { useColorScheme, type TextStyle } from "react-native";

export interface Palette {
  scheme: "light" | "dark";
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  muted: string;
  brand: string;
  accent: string;
  onAccent: string;
  success: string;
  caution: string;
  warning: string;
}

export const DARK: Palette = {
  scheme: "dark",
  bg: "#0A1626",
  surface: "#11223A",
  surface2: "#1C3352",
  border: "#1C3352",
  text: "#E8EEF5",
  muted: "#93A6BC",
  brand: "#0E2A47",
  accent: "#22C55E",
  onAccent: "#0A1626",
  success: "#4ADE80",
  caution: "#FBBF24",
  warning: "#F87171",
};

export const LIGHT: Palette = {
  scheme: "light",
  bg: "#FFFFFF",
  surface: "#F3F6F9",
  surface2: "#E8EDF2",
  border: "#DCE3EB",
  text: "#0A1626",
  muted: "#4A5D73",
  brand: "#0E2A47",
  accent: "#15803D",
  onAccent: "#FFFFFF",
  success: "#15803D",
  caution: "#B45309",
  warning: "#B91C1C",
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 20, xl: 28 } as const;

/** Manrope, as on the web app (loaded in app/_layout.tsx). */
export const font = {
  regular: "Manrope_400Regular",
  medium: "Manrope_500Medium",
  semibold: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
} as const;
export const fontFor = (weight?: TextStyle["fontWeight"]) =>
  weight === "700" || weight === "bold" || weight === "800" ? font.bold : weight === "600" ? font.semibold : weight === "500" ? font.medium : font.regular;

/** Figures: Manrope with tabular digits (same as the web dashboard). */
export const mono: TextStyle = {
  fontFamily: font.medium,
  fontVariant: ["tabular-nums"],
  letterSpacing: -0.3,
};

/** Glass material of the web dashboard (blur 22, surface at ~30–45 %). */
export function glass(c: Palette) {
  const dark = c.scheme === "dark";
  return {
    tint: (dark ? "dark" : "light") as "dark" | "light",
    intensity: dark ? 40 : 50,
    pane: dark ? "rgba(17,34,58,0.45)" : "rgba(243,246,249,0.42)",
    strong: dark ? "rgba(17,34,58,0.72)" : "rgba(243,246,249,0.72)",
    edge: dark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.65)",
    shade: dark ? "rgba(10,22,38,0.62)" : "rgba(255,255,255,0.18)",
    input: dark ? "rgba(10,22,38,0.45)" : "rgba(255,255,255,0.6)",
  };
}

export function useTheme(): Palette {
  return useColorScheme() === "dark" ? DARK : LIGHT;
}
