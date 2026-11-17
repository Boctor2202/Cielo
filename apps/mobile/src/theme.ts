import { type TextStyle } from "react-native";
import { useScheme } from "./appearance";

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

/**
 * The system font (San Francisco on iPhone), as in Apple's own apps: it renders crisply at every size and weight
 * and follows the user's text settings. Weights are styles to spread into a TextStyle.
 */
export const font = {
  light: { fontWeight: "300" },
  regular: { fontWeight: "400" },
  medium: { fontWeight: "500" },
  semibold: { fontWeight: "600" },
  bold: { fontWeight: "700" },
} as const satisfies Record<string, TextStyle>;

/** Figures: tabular digits so columns of times line up. */
export const mono: TextStyle = {
  ...font.medium,
  fontVariant: ["tabular-nums"],
  letterSpacing: -0.2,
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
  return useScheme() === "dark" ? DARK : LIGHT;
}
