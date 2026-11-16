"use client";

import { useEffect, useState } from "react";
import { currentTheme } from "./theme";

export type MapMode = "auto" | "light" | "dark";
const KEY = "geardown-map-theme";

/** Light or dark map, chosen on the map itself; "auto" follows the app theme. Remembered on this device. */
export function useMapTheme(): { dark: boolean; mode: MapMode; setMode: (m: MapMode) => void } {
  const [mode, setModeState] = useState<MapMode>("auto");
  const [appDark, setAppDark] = useState(false);
  useEffect(() => {
    setAppDark(currentTheme() === "dark");
    try {
      const v = localStorage.getItem(KEY);
      if (v === "light" || v === "dark") setModeState(v);
    } catch {}
  }, []);
  const setMode = (m: MapMode) => {
    setModeState(m);
    try {
      localStorage.setItem(KEY, m);
    } catch {}
  };
  return { dark: mode === "auto" ? appDark : mode === "dark", mode, setMode };
}
