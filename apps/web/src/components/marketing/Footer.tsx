import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SITE } from "@/config/site";
import { Logo } from "../Logo";

function Social({ href, label, d }: { href: string; label: string; d: string }) {
  return (
    <a href={href} aria-label={label} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:border-accent hover:text-accent" target="_blank" rel="noopener noreferrer">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d={d} /></svg>
    </a>
  );
}

export function Footer() {
  const t = useTranslations("footer");
  const n = useTranslations("nav");
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-muted">{t("tagline")}</p>
          <div className="mt-5 flex gap-2">
            <Social href={SITE.social.linkedin} label="LinkedIn" d="M4.98 3.5A2.5 2.5 0 1 1 5 8.5a2.5 2.5 0 0 1 0-5zM3 9h4v12H3zm7 0h3.8v1.7h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6V21h-4v-5.6c0-1.3 0-3-1.9-3s-2.2 1.5-2.2 3V21h-4z" />
            <Social href={SITE.social.instagram} label="Instagram" d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4zM17.3 5.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zM12 2c-2.7 0-3 0-4.1.1C3.7 2.3 2.3 3.7 2.1 7.9 2 9 2 9.3 2 12s0 3 .1 4.1c.2 4.2 1.6 5.6 5.8 5.8 1.1.1 1.4.1 4.1.1s3 0 4.1-.1c4.2-.2 5.6-1.6 5.8-5.8.1-1.1.1-1.4.1-4.1s0-3-.1-4.1c-.2-4.2-1.6-5.6-5.8-5.8C15 2 14.7 2 12 2z" />
            <Social href={SITE.social.youtube} label="YouTube" d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.7 15V9l5.8 3z" />
            <Social href={SITE.social.x} label="X" d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.2L1.8 3h6.4l4.4 5.8zm-1.1 16.2h1.7L7.4 4.7H5.6z" />
          </div>
        </div>
        <FooterCol title={t("product")}>
          <Link href="/fonctionnalites">{n("features")}</Link>
          <Link href="/tarifs">{n("pricing")}</Link>
          <Link href="/compagnies">{n("airlines")}</Link>
          <Link href="/blog">{n("blog")}</Link>
        </FooterCol>
        <FooterCol title={t("company")}>
          <Link href="/contact">{t("contact")}</Link>
          <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
        </FooterCol>
        <FooterCol title={t("legal")}>
          <Link href="/legal/mentions-legales">{t("legalNotice")}</Link>
          <Link href="/legal/confidentialite">{t("privacy")}</Link>
          <Link href="/legal/cgu">{t("terms")}</Link>
          <Link href="/legal/cookies">{t("cookies")}</Link>
        </FooterCol>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted sm:px-6 md:flex-row md:justify-between">
          <span>© {year} Geardown. {t("rights")}</span>
          <span className="max-w-xl md:text-right">{t("disclaimer")}</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="label-caps">{title}</h3>
      <div className="mt-4 flex flex-col gap-2.5 text-sm text-text/85 [&_a:hover]:text-accent">{children}</div>
    </div>
  );
}
