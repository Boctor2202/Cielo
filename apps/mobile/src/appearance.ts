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

/** Forces the app's colour scheme (native alerts and pickers follow too); "system" follows the iPhone. */
export function applyThemePref(p: ThemePref): void {
  try {
    Appearance.setColorScheme(p === "system" ? "unspecified" : p);
  } catch {
    // older runtimes: keep following the system
  }
}

export function setThemePref(p: ThemePref): void {
  try {
    Storage.setItemSync(KEY, p);
  } catch {
    // not persisted: still applied for this session
  }
  applyThemePref(p);
}
