"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { applyTheme, currentTheme } from "@/lib/theme";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const t = useTranslations("nav");
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => setDark(currentTheme() === "dark"), []);
  return (
    <button
      type="button"
      aria-label={t("theme")}
      title={t("theme")}
      className={`btn btn-ghost btn-sm !px-2 ${className}`}
      onClick={() => {
        const next = currentTheme() === "dark" ? "light" : "dark";
        applyTheme(next);
        setDark(next === "dark");
      }}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
