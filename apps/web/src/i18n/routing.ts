import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "en"],
  defaultLocale: "fr",
  localePrefix: "always",
  pathnames: {
    "/": "/",
    "/fonctionnalites": { fr: "/fonctionnalites", en: "/features" },
    "/tarifs": { fr: "/tarifs", en: "/pricing" },
    "/compagnies": { fr: "/compagnies", en: "/airlines" },
    "/blog": "/blog",
    "/blog/[slug]": "/blog/[slug]",
    "/contact": "/contact",
    "/connexion": { fr: "/connexion", en: "/login" },
    "/inscription": { fr: "/inscription", en: "/signup" },
    "/legal/mentions-legales": { fr: "/legal/mentions-legales", en: "/legal/legal-notice" },
    "/legal/confidentialite": { fr: "/legal/confidentialite", en: "/legal/privacy" },
    "/legal/cgu": { fr: "/legal/cgu", en: "/legal/terms" },
    "/legal/cookies": "/legal/cookies",
    "/app": "/app",
    "/app/carnet": { fr: "/app/carnet", en: "/app/logbook" },
    "/app/carnet/nouveau": { fr: "/app/carnet/nouveau", en: "/app/logbook/new" },
    "/app/carnet/[id]": { fr: "/app/carnet/[id]", en: "/app/logbook/[id]" },
    "/app/carnet/import": { fr: "/app/carnet/import", en: "/app/logbook/import" },
    "/app/carnet/audit": { fr: "/app/carnet/audit", en: "/app/logbook/audit" },
    "/app/carnet/export": { fr: "/app/carnet/export", en: "/app/logbook/export" },
    "/app/carnet/report": { fr: "/app/carnet/report", en: "/app/logbook/carry-forward" },
    "/app/appareils": { fr: "/app/appareils", en: "/app/aircraft" },
    "/app/roster": "/app/roster",
    "/app/roster/escale/[id]": { fr: "/app/roster/escale/[id]", en: "/app/roster/layover/[id]" },
    "/app/ftl": "/app/ftl",
    "/app/documents": "/app/documents",
    "/app/statistiques": { fr: "/app/statistiques", en: "/app/statistics" },
    "/app/carte": { fr: "/app/carte", en: "/app/map" },
    "/app/emplois": { fr: "/app/emplois", en: "/app/jobs" },
    "/app/cv": "/app/cv",
    "/app/parametres": { fr: "/app/parametres", en: "/app/settings" },
  },
});

export type AppPathname = keyof typeof routing.pathnames;
export type StaticPathname = Exclude<AppPathname, `${string}[${string}`>;
