import { type TextStyle } from "react-native";
import { ACCENTS, useLook, useScheme, type AccentId, type BackdropId } from "./appearance";

export interface Palette {
  scheme: "light" | "dark";
  /** the backdrop behind the screens */
  look?: BackdropId | "pearl";
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
    pane: dark ? withAlpha(c.surface, 0.5) : "rgba(255,255,255,0.55)",
    strong: dark ? withAlpha(c.surface, 0.76) : "rgba(255,255,255,0.78)",
    edge: dark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.65)",
    shade: dark ? "rgba(10,22,38,0.62)" : "rgba(255,255,255,0.18)",
    input: dark ? withAlpha(c.bg, 0.45) : "rgba(255,255,255,0.6)",
  };
}

/** The dark backdrops: a near-black and a graphite next to the default midnight blue. */
const DARK_LOOKS: Record<BackdropId, Partial<Palette>> = {
  midnight: {},
  black: { bg: "#050507", surface: "#141419", surface2: "#1F1F26", border: "#26262F", muted: "#9BA1AC", brand: "#141419", onAccent: "#050507" },
  slate: { bg: "#12161C", surface: "#1B2129", surface2: "#262E38", border: "#2B343F", muted: "#9AA6B4", brand: "#1B2129", onAccent: "#12161C" },
};
const cache = new Map<string, Palette>();
/** The palette for a scheme, an accent and a backdrop (the same object each time, so screens don't redraw). */
export function paletteFor(scheme: "light" | "dark", accent: AccentId, backdrop: BackdropId): Palette {
  const key = `${scheme}.${accent}.${backdrop}`;
  let p = cache.get(key);
  if (!p) {
    const a = ACCENTS[accent];
    p = scheme === "dark" ? { ...DARK, ...DARK_LOOKS[backdrop], accent: a.dark, look: backdrop } : { ...LIGHT, accent: a.light, look: "pearl" };
    cache.set(key, p);
  }
  return p;
}

export function useTheme(): Palette {
  const scheme = useScheme();
  const { accent, backdrop } = useLook();
  return paletteFor(scheme, accent, backdrop);
}

/** "#22C55E" + alpha → "rgba(34,197,94,0.2)". */
export function withAlpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
