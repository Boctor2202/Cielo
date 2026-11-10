import { Platform, useColorScheme, type TextStyle } from "react-native";

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
  accent: "#22D3EE",
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
  accent: "#0891B2",
  onAccent: "#FFFFFF",
  success: "#15803D",
  caution: "#B45309",
  warning: "#B91C1C",
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 14 } as const;

/** Platform monospace with tabular figures — used for every number, time and ICAO code. */
export const mono: TextStyle = {
  fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  fontVariant: ["tabular-nums"],
};

export function useTheme(): Palette {
  return useColorScheme() === "dark" ? DARK : LIGHT;
}
