import { useSyncExternalStore } from "react";
import { Appearance } from "react-native";
import Storage from "expo-sqlite/kv-store";

/** The pilot's theme choice, kept on this device. Dark unless they pick otherwise. */
export type ThemePref = "dark" | "light" | "system";
const KEY = "appearance.theme";

export function loadThemePref(): ThemePref {
  try {
    const v = Storage.getItemSync(KEY);
    return v === "light" || v === "system" ? v : "dark";
  } catch {
    return "dark";
  }
}

/*
 * The scheme the app shows, kept here rather than read from useColorScheme(): React Native does not tell its
 * listeners when an override is removed, so "follow the iPhone" stayed on the forced scheme until the next
 * system change. Here the system scheme is read again from the native side once the override is gone.
 */
let pref: ThemePref = "dark";
let scheme: "light" | "dark" = "dark";
const listeners = new Set<() => void>();
const set = (s: "light" | "dark") => {
  if (s === scheme) return;
  scheme = s;
  listeners.forEach((f) => f());
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const native = (): "light" | "dark" | null => {
  try {
    const m = require("react-native/Libraries/Utilities/NativeAppearance").default as { getColorScheme?: () => string | null } | null;
    const v = m?.getColorScheme?.();
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
};
Appearance.addChangeListener(({ colorScheme }) => {
  if (pref === "system" && (colorScheme === "light" || colorScheme === "dark")) set(colorScheme);
});

/** Forces the app's colour scheme (native alerts and pickers follow too); "system" follows the iPhone. */
export function applyThemePref(p: ThemePref): void {
  pref = p;
  try {
    Appearance.setColorScheme(p === "system" ? "auto" : p);
  } catch {
    try {
      Appearance.setColorScheme(p === "system" ? ("unspecified" as never) : p);
    } catch {
      /* older runtimes: keep following the system */
    }
  }
  if (p !== "system") return set(p);
  // the window drops the override asynchronously: read the iPhone's scheme once it has
  const read = () => {
    if (pref !== "system") return;
    const s = native() ?? Appearance.getColorScheme();
    if (s === "light" || s === "dark") set(s);
  };
  read();
  setTimeout(read, 150);
  setTimeout(read, 600);
}

export function setThemePref(p: ThemePref): void {
  try {
    Storage.setItemSync(KEY, p);
  } catch {
    // not persisted: still applied for this session
  }
  applyThemePref(p);
}

/** The scheme the app is shown in. */
export function useScheme(): "light" | "dark" {
  return useSyncExternalStore(
    (f) => (listeners.add(f), () => void listeners.delete(f)),
    () => scheme,
  );
}

/*
 * The pilot's colours, kept on this device: the accent used across the app (buttons, active tab, bars, chips,
 * the glow of the backdrop) and, in dark mode, the backdrop (light mode is always "pearl").
 */
export type AccentId = "emerald" | "azure" | "violet" | "gold" | "coral" | "lagoon" | "amber" | "platinum";
export type BackdropId = "midnight" | "black" | "slate";
/** Each accent in dark mode, and a deeper shade that reads on light backgrounds. */
export const ACCENTS: Record<AccentId, { dark: string; light: string }> = {
  emerald: { dark: "#22C55E", light: "#15803D" },
  azure: { dark: "#38BDF8", light: "#0369A1" },
  violet: { dark: "#A78BFA", light: "#6D28D9" },
  gold: { dark: "#E9C25A", light: "#A16207" },
  coral: { dark: "#FB7185", light: "#BE123C" },
  lagoon: { dark: "#2DD4BF", light: "#0F766E" },
  amber: { dark: "#FB923C", light: "#C2410C" },
  platinum: { dark: "#CBD5E1", light: "#475569" },
};
export const BACKDROPS: BackdropId[] = ["midnight", "black", "slate"];

const ACCENT_KEY = "appearance.accent";
const BACKDROP_KEY = "appearance.backdrop";
const read = <T extends string>(key: string, ok: readonly T[], fallback: T): T => {
  try {
    const v = Storage.getItemSync(key);
    return v && (ok as readonly string[]).includes(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
};
let look = {
  accent: read<AccentId>(ACCENT_KEY, Object.keys(ACCENTS) as AccentId[], "emerald"),
  backdrop: read<BackdropId>(BACKDROP_KEY, BACKDROPS, "midnight"),
};
const lookListeners = new Set<() => void>();
const saveLook = (next: typeof look, key: string, value: string) => {
  look = next;
  try {
    Storage.setItemSync(key, value);
  } catch {
    // not persisted: still applied for this session
  }
  lookListeners.forEach((f) => f());
};
export const setAccent = (a: AccentId) => saveLook({ ...look, accent: a }, ACCENT_KEY, a);
export const setBackdrop = (b: BackdropId) => saveLook({ ...look, backdrop: b }, BACKDROP_KEY, b);

/** The accent and backdrop the pilot chose. */
export function useLook(): { accent: AccentId; backdrop: BackdropId } {
  return useSyncExternalStore(
    (f) => (lookListeners.add(f), () => void lookListeners.delete(f)),
    () => look,
  );
}
