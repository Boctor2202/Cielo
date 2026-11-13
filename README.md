# Cielo — carnet de vol électronique

Carnet de vol pour pilotes professionnels et privés (EASA Part-FCL en priorité, puis FAA et CASA), en français et en anglais.

## Structure

```
apps/
  web/            Next.js 16 : site vitrine + espace connecté (/app), FR/EN, mode sombre
  mobile/         Expo SDK 58 (iOS / Android) — voir apps/mobile/README.md
packages/
  core/           Logique métier pure et testée : nuit EASA, calcul des colonnes, totaux, FCL.060,
                  audit (17 règles), FTL ORO.FTL, import CSV/iCal, contrat de stockage
  export/         PDF EASA (AMC1 FCL.050), FAA, CASA + CSV
  reference-data/ 19 106 aérodromes (OurAirports, avec fuseaux) et 148 types d'avions
  sync/           Synchronisation hors ligne ↔ Supabase (last-write-wins)
supabase/         Schéma Postgres + RLS, fonctions (Stripe, RevenueCat, alertes, RGPD) — voir docs/backend.md
```

## Démarrer

```bash
pnpm install
pnpm dev            # http://localhost:3000 (web)
pnpm test           # tests core, export, sync
pnpm typecheck
```

Sans variables Supabase, l'application web fonctionne en **mode local** : les données restent dans le navigateur
(IndexedDB). « Voir la démo » charge un carnet de démonstration (pilote de ligne A320 + aéroclub).

Configuration : `apps/web/src/config/site.ts` (statistiques du bandeau, prix, liens stores, réseaux, mentions
légales) et `apps/web/.env.example`.

Captures d'écran du site vitrine : elles sont générées depuis l'application réelle.

```bash
cd apps/web && pnpm build && pnpm start &
node scripts/screenshots.mjs
```

## Mise en production

1. Backend : `docs/backend.md` (Supabase UE, Stripe, RevenueCat, cron des alertes).
2. Web : déployer `apps/web` (Vercel, Render…) avec `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Mobile : `apps/mobile/README.md` (EAS Build / Submit vers App Store Connect et Google Play).

## Crédits photos

Page d'accueil : photos Unsplash (licence Unsplash, usage commercial autorisé), recadrées et converties en WebP dans
`apps/web/public/immersive/` — IDs `1544016768-982d1554f0b9` (décollage, recadrée pour retirer la livrée),
`1436491865332-7a61a109cc05` (aile au-dessus des nuages), `1506012787146-f92b2d7d6d96` (coucher de soleil),
`1517479149777-5f3b1511d5ad` (mer de nuages). Globe : aérodromes OurAirports (domaine public).
