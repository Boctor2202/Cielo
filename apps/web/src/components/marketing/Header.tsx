"use client";

import { Menu, X } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Logo } from "../Logo";
import { ThemeToggle } from "../ThemeToggle";
import { LocaleSwitch } from "../LocaleSwitch";

export function Header() {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const links = [
    { href: "/fonctionnalites", label: t("features") },
    { href: "/tarifs", label: t("pricing") },
    { href: "/compagnies", label: t("airlines") },
    { href: "/blog", label: t("blog") },
  ] as const;
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="shrink-0" aria-label="Cielo">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-md px-3 py-2 text-[15px] font-medium text-muted transition-colors hover:text-text">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-1 md:flex">
          <LocaleSwitch />
          <ThemeToggle />
          <Link href="/connexion" className="btn btn-ghost">
            {t("login")}
          </Link>
          <Link href="/inscription" className="btn btn-primary">
            {t("trial")}
          </Link>
        </div>
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button type="button" className="btn btn-ghost !px-2" aria-label={t("menu")} aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-border bg-bg px-4 pb-4 md:hidden">
          <nav className="flex flex-col py-2" aria-label="Mobile">
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="border-b border-border/60 py-3 text-base font-medium">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex items-center gap-2">
            <Link href="/connexion" className="btn btn-secondary flex-1" onClick={() => setOpen(false)}>
              {t("login")}
            </Link>
            <Link href="/inscription" className="btn btn-primary flex-1" onClick={() => setOpen(false)}>
              {t("trial")}
            </Link>
            <LocaleSwitch />
          </div>
        </div>
      )}
    </header>
  );
}
