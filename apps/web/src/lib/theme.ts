export type ThemePref = "light" | "dark" | "system";

/** Inline script run before paint, so the page never flashes the wrong theme. */
export const themeScript = `(function(){try{var p=localStorage.getItem('cielo-theme')||'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){document.documentElement.dataset.theme='light';}})();`;

export function applyTheme(pref: ThemePref) {
  try {
    localStorage.setItem("cielo-theme", pref);
  } catch {}
  const dark = pref === "dark" || (pref === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function currentTheme(): "light" | "dark" {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}
