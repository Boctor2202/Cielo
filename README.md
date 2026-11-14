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

## Page d'accueil : l'avion du pilote

La page d'accueil est un film piloté par le défilement : l'avion aligné en bout de piste accélère à mesure que l'on
fait défiler, effectue sa rotation, décolle, rentre son train et traverse les nuages, puis la Terre prend le relais
(globe 3D NASA, routes en grand cercle, rotation au cliquer-glisser). Les clips sont dans
`apps/web/public/immersive/film/<id>/` (`takeoff`, `gear`, `clouds`, en 1080p et 720p, encodés avec une image clé
toutes les 4 à 6 images pour un défilement fluide) ; l'enchaînement est réglé par `SHOTS` dans
`components/marketing/immersive/timeline.ts`.

L'avion affiché est celui du visiteur : le type choisi dans « Vous volez sur… », sinon le type le plus volé dans son
carnet. Les types qui ont un film (`film` dans `apps/web/src/lib/aircraft-visuals.ts`) le jouent ; les autres
affichent leurs photos. Les visiteurs sans carnet voient le Citation Latitude.

## Crédits photos

- Cessna Citation Latitude : Wikimedia Commons, licences CC BY / CC BY-SA (auteurs et liens dans
  `aircraft-visuals.ts`, affichés sur la page via « Crédits photo »). Les versions détourées ou recadrées restent sous la
  licence de l'original.
- Ciels et avion de ligne : Unsplash (licence Unsplash, usage commercial autorisé).
- Film de décollage : vidéos générées par IA (Veo 3.1 et Kling 2.6 via SYZEL) ; avion et aéroport fictifs, sans
  marquage.
- Globe : NASA Blue Marble Next Generation (jour) et Black Marble 2016 (nuit), domaine public, via Wikimedia
  Commons ; nuages et masque des océans NASA via three-globe (MIT).
