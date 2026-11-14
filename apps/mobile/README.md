# Sillage — application mobile (iOS / Android)

Carnet de vol électronique *local-first* (EASA Part-FCL en priorité, interface FR/EN), construit avec
Expo SDK 58, expo-router et TypeScript. Toute la logique métier (calcul des temps, nuit, expérience
récente FCL.060, FTL, échéances, exports PDF/CSV) provient des paquets du monorepo :

| Paquet | Utilisation dans l'app |
| --- | --- |
| `@cielo/core` | `deriveFlightTimes`, `dashboardPeriods`, `computeRecency`, `licenseStatus`, `analyseFtl`, `LocalStore`, `stamp`… |
| `@cielo/reference-data` | `AIRCRAFT_TYPES` (semés en base au 1er lancement), `AirportIndex` + `airports.json` embarqué |
| `@cielo/export` | `buildLogbookPdf` (PDF au format carnet EASA/FAA/CASA), `flightsToCsv` |

## Structure

```
app/                     routes expo-router
  (tabs)/index.tsx       Tableau de bord (totaux, 28 j / 90 j / 12 mois, FCL.060, échéances, FTL cumulés)
  (tabs)/logbook.tsx     Carnet (groupé par mois + totaux ; appui = modifier, appui long = supprimer)
  (tabs)/roster.tsx      Planning à venir (bouton « Saisir ce vol »)
  (tabs)/documents.tsx   Licences / médical / qualifications avec statut couleur
  (tabs)/more.tsx        Réglages, exports, compte, abonnement, RGPD
  flight/[id].tsx        Saisie / modification d'un vol (aperçu calculé en direct) — id = "new" pour créer
  document/[id].tsx      Saisie / modification d'un document (catalogue LICENSE_CATALOGUE, rappels)
  auth.tsx, auth-callback.tsx, subscription.tsx
src/
  db/sqliteStore.ts      Implémentation SQLite (expo-sqlite) du contrat LocalStore de @cielo/core
  db/seed.ts             Semis des types d'aéronefs + création du pilote local
  airports.ts            Singleton AirportIndex (JSON chargé une seule fois)
  state.tsx              Contexte applicatif (données, put/remove avec suppression logique)
  auth.ts                Supabase : lien magique, Apple, Google — désactivé sans variables d'env
  sync.ts                ⚠️ POINT D'ACCROCHE pour @cielo/sync (createSupabaseSync)
  notifications.ts       Rappels d'échéance locaux (expo-notifications)
  purchases.ts           RevenueCat (react-native-purchases), désactivé sans clé
  exporters.ts           PDF / CSV / JSON (RGPD) → expo-file-system + expo-sharing
  i18n.ts, theme.ts      Dictionnaires FR/EN, thème « cockpit » clair/sombre
```

## Lancer en local

Prérequis : Node 22, pnpm 10 (voir `packageManager` à la racine).

```bash
# à la racine du monorepo
pnpm install
cd apps/mobile
pnpm start          # = expo start
```

- **Expo Go** : scannez le QR code. Tout fonctionne en mode local (SQLite, notifications locales,
  exports). La connexion Apple native et les achats intégrés RevenueCat nécessitent un *development build*.
- **Development build** (recommandé) :
  ```bash
  npx expo run:ios       # Xcode requis (macOS)
  npx expo run:android   # Android Studio / SDK requis
  # ou sur les serveurs EAS :
  eas build --profile development --platform ios|android
  ```
  Les dossiers `ios/` et `android/` sont générés (Continuous Native Generation) et ignorés par git.

Vérifications :

```bash
pnpm --filter @cielo/mobile typecheck           # tsc --noEmit
cd apps/mobile && npx expo export --platform android   # prouve que Metro résout le monorepo
npx expo-doctor
```

### Monorepo pnpm

pnpm installe les dépendances en mode isolé (liens symboliques). Depuis le SDK 52, Expo détecte
automatiquement les workspaces et Metro suit les liens symboliques et les champs `exports` : aucun
`node-linker=hoisted` n'est nécessaire. `metro.config.js` se contente d'expliciter `watchFolders`
(racine du dépôt, pour transformer les sources TypeScript de `packages/*`) et `resolver.nodeModulesPaths`.
Les modules natifs sont liés par l'autolinking Expo depuis `apps/mobile/node_modules`.

## Variables d'environnement

Toutes facultatives. Copiez `.env.example` en `.env.local` (non versionné). Les variables `EXPO_PUBLIC_*`
sont injectées dans le bundle au moment du build : **n'y mettez jamais de secret serveur**.

| Variable | Rôle | Absente → |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | URL du projet Supabase | mode local (pas de connexion ni de synchro) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | clé publique *anon* Supabase | mode local |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | clé publique RevenueCat Apple (`appl_…`) | écran abonnement désactivé sur iOS |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | clé publique RevenueCat Google (`goog_…`) | écran abonnement désactivé sur Android |

Pour les builds EAS, déclarez-les côté serveur : `eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value …`
(ou dans la section `env` du profil concerné de `eas.json`).

### Supabase (authentification)

Dans le tableau de bord Supabase → *Authentication* :

1. **URL Configuration** : ajoutez `cielo://auth-callback` (et `exp://**` pour Expo Go) aux *Redirect URLs*.
2. **E-mail** : activez les liens magiques (flux PKCE, le lien doit être ouvert sur le même appareil).
3. **Apple** : activez le fournisseur ; renseignez le *Services ID*, la clé `.p8` et le Team ID. Sur iOS,
   l'app utilise Sign in with Apple natif (`signInWithIdToken` + nonce) : ajoutez aussi le bundle id
   `app.cielo.logbook` dans *Authorized Client IDs*.
4. **Google** : créez des identifiants OAuth (Google Cloud Console) et renseignez-les dans Supabase.
   L'app ouvre le flux OAuth dans un navigateur sécurisé (`expo-web-browser`).

Sans ces variables, l'app crée un pilote local et fonctionne intégralement hors-ligne.

### Synchronisation

`src/sync.ts` est le point d'accroche unique : quand `@cielo/sync` sera disponible, ajoutez la dépendance
`"@cielo/sync": "workspace:*"` et remplacez le corps de `startSync` par `createSupabaseSync({ supabase, store, pilotId })`.
`AppProvider` l'appelle dès qu'une session Supabase existe et l'arrête à la déconnexion.

## Build et publication (EAS)

### Comptes nécessaires

- **Expo** (gratuit) : `npm i -g eas-cli && eas login`.
- **Apple Developer Program** (99 $/an) avec accès à App Store Connect.
- **Google Play Console** (25 $ une fois) ; vérification d'identité du compte développeur.
- **RevenueCat** (gratuit jusqu'à un certain CA) si les abonnements sont activés.

### Première configuration

```bash
cd apps/mobile
eas init            # crée le projet EAS et remplit expo.extra.eas.projectId dans app.json
eas build:configure # facultatif : eas.json est déjà fourni
```

Profils (`eas.json`) :

| Profil | Usage |
| --- | --- |
| `development` | client de développement (`expo-dev-client`), distribution interne |
| `preview` | build de test interne (APK Android, ad hoc iOS) |
| `production` | build magasin (AAB Android, IPA iOS), numéro de build auto-incrémenté |

EAS envoie tout le dépôt git : lancez les commandes **depuis `apps/mobile`** ; pnpm et le workspace sont
détectés automatiquement (versions Node/pnpm figées dans le profil `base`).

### Identifiants (credentials)

- **iOS** : `eas credentials` (ou au premier `eas build`) génère et stocke le certificat de distribution et le
  profil de provisionnement. La capacité *Sign in with Apple* est activée via `ios.usesAppleSignIn`.
  Les notifications utilisées sont locales : aucun certificat APNs n'est nécessaire.
- **Android** : EAS génère et conserve le keystore d'upload. Activez *Play App Signing* dans la console.
  Pour `eas submit`, créez un **compte de service Google Cloud** avec accès à l'API Google Play Developer,
  invitez-le dans la Play Console (droits de publication) et placez sa clé JSON dans
  `apps/mobile/secrets/google-play-service-account.json` (dossier ignoré par git) ou en secret EAS.

### Build et soumission

```bash
eas build --profile production --platform ios
eas build --profile production --platform android

# Renseignez d'abord submit.production dans eas.json :
#   ios.appleId (e-mail Apple), ios.ascAppId (ID numérique de l'app dans App Store Connect), ios.appleTeamId
#   android.serviceAccountKeyPath, android.track (internal → production)
eas submit --profile production --platform ios      # → TestFlight puis revue App Store
eas submit --profile production --platform android  # → piste « internal » de Google Play (brouillon)
```

> Google Play : le **tout premier** AAB doit être envoyé manuellement depuis la Play Console ; ensuite `eas submit` fonctionne.

### Fiche magasin (store listing)

- **App Store Connect** : créez l'app (bundle `app.cielo.logbook`, SKU), nom « Sillage », sous-titre, description FR/EN,
  mots-clés (carnet de vol, logbook, EASA, pilote…), catégorie *Navigation* ou *Productivité*, captures 6,9″ et 13″ iPad,
  URL de politique de confidentialité, questionnaire *App Privacy* (données de contact et contenu utilisateur si la
  synchro est activée), classification d'âge, coordonnées de revue (fournir un compte de démonstration si la connexion
  est requise — ici l'app fonctionne sans compte).
- **Google Play Console** : fiche principale (titre, descriptions courte/longue, icône 512 px, image de présentation
  1024×500, captures), formulaire *Sécurité des données*, classification du contenu, public cible, déclaration
  publicité, politique de confidentialité, autorisation `SCHEDULE_EXACT_ALARM` justifiée (rappels d'échéance).
- Les deux magasins exigent, pour une app avec comptes, une **suppression de compte accessible depuis l'app** :
  l'écran « Plus → Données personnelles » efface les données locales ; la suppression du compte Supabase devra être
  branchée côté serveur (Edge Function) avant publication avec la synchro.

### Mises à jour OTA (facultatif)

`npx expo install expo-updates && eas update:configure`, puis `eas update --channel production`
(les canaux sont déjà déclarés dans les profils).

## Abonnements — RevenueCat

1. Créez un projet RevenueCat et deux apps : **App Store** (bundle `app.cielo.logbook`, clé *In-App Purchase* `.p8`
   d'App Store Connect) et **Play Store** (package `app.cielo.logbook`, JSON du compte de service avec accès financier).
2. Créez les produits dans les magasins (ex. `cielo_premium_monthly`, `cielo_premium_yearly` — abonnements
   auto-renouvelables, même groupe d'abonnement côté Apple), puis importez-les dans RevenueCat.
3. Créez l'**entitlement** `premium` (identifiant utilisé par `src/purchases.ts`), rattachez-y les produits, et une
   **offering** marquée *current* contenant les packages (mensuel / annuel).
4. Copiez les clés publiques SDK dans `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`.
5. Testez avec un development build (sandbox Apple / testeurs de licence Google). Dans Expo Go, le SDK fonctionne
   en mode aperçu sans achat réel.
6. Optionnel : webhook RevenueCat → Supabase pour mettre à jour `subscription_tier` côté serveur. Une fois connecté,
   l'app appelle `Purchases.logIn(<id utilisateur Supabase>)`.

Sans clé, l'écran « Abonnement » affiche simplement que les achats ne sont pas configurés.

## Limites connues

- Pas de synchro tant que `@cielo/sync` n'est pas branché (`src/sync.ts`).
- Les plannings (roster) ne s'importent pas encore depuis le mobile (import via l'app web puis synchro).
- Pas de saisie des soldes d'ouverture, signatures, équipage ni temps IMC / navigation sur mobile (champs conservés
  lors d'une modification).
- Suppression par appui long (pas de balayage), sélecteurs de date en saisie texte `AAAA-MM-JJ`.
