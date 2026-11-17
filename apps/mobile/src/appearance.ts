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
