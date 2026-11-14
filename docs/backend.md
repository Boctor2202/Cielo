# Backend Geardown (Supabase)

Ce document décrit la mise en place du backend : base Postgres, authentification, stockage,
fonctions edge (Stripe, RevenueCat, alertes de validité, RGPD) et synchronisation hors-ligne.

```
supabase/
  config.toml                 configuration CLI (project_id "cielo")
  migrations/0001_init.sql    schéma, RLS, triggers, bucket "attachments"
  seed.sql                    types d'aéronefs publics (généré depuis packages/reference-data)
  functions/
    _shared/                  helpers communs (http, clients Supabase, Stripe, abonnements, licences, i18n)
    stripe-webhook/           webhook Stripe -> subscriptions + pilots.subscription_*
    create-checkout-session/  URL Stripe Checkout pour un plan + périodicité
    revenuecat-webhook/       webhook RevenueCat (achats intégrés iOS / Android)
    license-alerts/           alertes quotidiennes d'échéance (e-mail Resend + push Expo)
    gdpr-export/              export RGPD (JSON + URLs signées des pièces jointes)
    gdpr-delete/              suppression du compte (confirmation {"confirm":"DELETE"})
packages/sync/                moteur de synchronisation @cielo/sync (LWW)
```

## 1. Créer le projet Supabase (région UE)

1. Sur <https://supabase.com/dashboard>, **New project** :
   - nom : `cielo` (ou `cielo-staging` pour la pré-production) ;
   - **Region : Central EU (Frankfurt) — `eu-central-1`**. Les données de vol et les documents
     médicaux restent ainsi dans l'UE (RGPD). La région ne peut pas être changée ensuite ;
   - mot de passe de base de données fort, conservé dans le gestionnaire de secrets de l'équipe.
2. Installer la CLI : `brew install supabase/tap/supabase` (ou `npx supabase@latest …`).
3. Depuis la racine du dépôt :

   ```bash
   supabase login
   supabase link --project-ref <ref-du-projet>   # ref visible dans l'URL du dashboard
   ```

4. Récupérer dans **Project Settings → API** l'URL du projet et la clé `anon` (publique) pour les apps
   web/mobile. La clé `service_role` ne doit **jamais** quitter le serveur : elle est injectée
   automatiquement dans les fonctions edge (`SUPABASE_SERVICE_ROLE_KEY`).

## 2. Appliquer les migrations

```bash
supabase db push                 # applique supabase/migrations/*.sql sur le projet lié
psql "$DATABASE_URL" -f supabase/seed.sql   # une fois : types d'aéronefs publics
```

En local : `supabase start` puis `supabase db reset` (applique migrations + `seed.sql`).

Points clés du schéma :

- une table par `TableName` de `packages/core/src/store.ts`, colonnes = champs TS en snake_case
  (ainsi `rowToDb`/`rowFromDb` suffisent, sans code par table) ;
- `pilots.id` référence `auth.users(id)` ; toutes les autres tables ont `pilot_id → pilots(id)`
  `on delete cascade` : supprimer l'utilisateur auth supprime toutes ses données ;
- `aircraft_types.owner_pilot_id` nul = donnée de référence publique, lisible par tout utilisateur
  connecté, non modifiable par les clients. `aircraft_types.id` est de type `text` car les lignes de
  référence ont des ids stables `ref-A320` ;
- pas de clés étrangères entre tables synchronisées (hors `pilot_id`) : la synchro pousse table par
  table et les références peuvent arriver dans n'importe quel ordre ;
- RLS sur toutes les tables (`pilot_id = auth.uid()`, `id = auth.uid()` pour `pilots`) ;
- trigger `on_auth_user_created` : crée la ligne `pilots` (locale `fr`, EASA, PIC, IFR `ask`,
  pilot flying `always`, affichage `hhmm`, offre `free`) ;
- trigger `cielo_lww_guard` : une mise à jour portant un `updated_at` plus ancien que la ligne
  stockée est ignorée (dernier écrit gagnant côté serveur) ;
- trigger `pilots_protect_subscription` : un utilisateur ne peut pas modifier lui-même
  `subscription_tier/source/expires_at` ; seules les fonctions (service role) le font ;
- tables serveur : `subscriptions` (lecture par le pilote, écriture service role uniquement),
  `push_tokens` (jetons Expo enregistrés par l'app mobile), `license_alert_log` (idempotence des alertes) ;
- bucket privé `attachments` : chaque utilisateur n'accède qu'aux objets sous `<uid>/…`
  (ex. `<uid>/licenses/<license-id>/medical.pdf`).

## 3. Secrets des fonctions

`SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis par la plateforme.
Les autres secrets se définissent avec la CLI (jamais dans le code ni dans git) :

```bash
supabase secrets set \
  APP_URL=https://app.cielo.example \
  STRIPE_SECRET_KEY=sk_live_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  STRIPE_PRICE_BASIC_MONTHLY=price_... \
  STRIPE_PRICE_BASIC_YEARLY=price_... \
  STRIPE_PRICE_PREMIUM_MONTHLY=price_... \
  STRIPE_PRICE_PREMIUM_YEARLY=price_... \
  REVENUECAT_WEBHOOK_AUTH='<longue valeur aléatoire>' \
  RESEND_API_KEY=re_... \
  ALERTS_FROM_EMAIL='Geardown <alertes@cielo.example>' \
  CRON_SECRET='<longue valeur aléatoire>'
# optionnels
supabase secrets set CORS_ALLOW_ORIGIN=https://app.cielo.example EXPO_ACCESS_TOKEN=...
```

En local, mettre ces valeurs dans `supabase/functions/.env` (ignoré par git) et lancer
`supabase functions serve --env-file supabase/functions/.env`.

## 4. Déployer les fonctions

```bash
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy revenuecat-webhook --no-verify-jwt
supabase functions deploy license-alerts --no-verify-jwt
supabase functions deploy create-checkout-session
supabase functions deploy gdpr-export
supabase functions deploy gdpr-delete
```

(`config.toml` déclare déjà `verify_jwt = false` pour les trois premières : elles sont appelées par
Stripe, RevenueCat et pg_cron et vérifient elles-mêmes leur secret.)

Appels côté apps (avec le JWT de l'utilisateur, `supabase.functions.invoke`) :

| Fonction | Corps | Réponse |
|---|---|---|
| `create-checkout-session` | `{ plan: "basic"\|"premium", interval: "monthly"\|"yearly", returnPath?: "/settings" }` | `{ url }` → rediriger le navigateur |
| `gdpr-export` | — | JSON de toutes les lignes + `attachments[{ path, signedUrl }]` (1 h) |
| `gdpr-delete` | `{ confirm: "DELETE" }` | `{ deleted: true }` puis `supabase.auth.signOut()` et `store.clear()` |

## 5. Authentification : Apple et Google

Dans **Authentication → Providers** :

- **Email** : activer, confirmation d'e-mail activée. Configurer un SMTP (ex. Resend) dans
  **Authentication → SMTP Settings** pour ne pas dépendre du SMTP de test limité.
- **Apple** (obligatoire sur iOS si un autre login social est proposé) :
  1. Apple Developer → Identifiers : App ID `app.geardown.logbook` avec *Sign in with Apple* ;
  2. créer un **Services ID** (ex. `aero.cielo.web`) pour le web, domaine + URL de retour
     `https://<ref>.supabase.co/auth/v1/callback` ;
  3. créer une clé *Sign in with Apple* (.p8) ; générer le secret client (JWT signé, valable 6 mois
     maximum — **à renouveler**, prévoir un rappel) ;
  4. dans Supabase : Client IDs = `app.geardown.logbook,aero.cielo.web`, Secret = le JWT.
     Sur iOS, l'app utilise le login natif (`signInWithIdToken`), aucun secret n'est embarqué.
- **Google** :
  1. Google Cloud Console → Écran de consentement OAuth (externe, domaines autorisés) ;
  2. Identifiants OAuth : un client **Web** (URI de redirection
     `https://<ref>.supabase.co/auth/v1/callback`), un client **iOS** et un client **Android**
     (empreinte SHA-1 du keystore de signature, y compris celle de Play App Signing) ;
  3. dans Supabase : Client ID/Secret du client Web, et ajouter les IDs iOS/Android dans
     *Authorized Client IDs* pour `signInWithIdToken` (option *Skip nonce check* si le SDK natif
     ne transmet pas de nonce).
- **URL Configuration** : *Site URL* = `APP_URL`, *Redirect URLs* = `APP_URL/**` et le schéma de
  l'app mobile (`cielo://auth-callback`).

## 6. Stripe (abonnements web)

1. **Produits** : *Geardown Basic* et *Geardown Premium*, chacun avec deux prix récurrents en EUR
   (mensuel, annuel). Reporter les 4 `price_…` dans `STRIPE_PRICE_{BASIC,PREMIUM}_{MONTHLY,YEARLY}`.
2. **Customer portal** (Settings → Billing → Customer portal) : autoriser annulation et
   changement de plan entre ces 4 prix.
3. **Webhook** (Developers → Webhooks → Add endpoint) :
   - URL : `https://<ref>.supabase.co/functions/v1/stripe-webhook`
   - événements : `checkout.session.completed`, `customer.subscription.updated`,
     `customer.subscription.deleted`
   - copier le *Signing secret* dans `STRIPE_WEBHOOK_SECRET`.
4. Fonctionnement : `create-checkout-session` crée la session avec
   `client_reference_id = pilot id` (et `metadata.pilot_id` sur l'abonnement) ; le webhook vérifie
   la signature (HMAC-SHA256, tolérance 5 min), relit l'abonnement, associe le `price` à un niveau,
   met à jour `subscriptions` puis recalcule `pilots.subscription_*` (en touchant `updated_at`
   pour que les appareils récupèrent le changement à la prochaine synchro).
5. Test local : `stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook` puis
   `stripe trigger checkout.session.completed`.

## 7. RevenueCat (achats intégrés iOS / Android)

1. Créer le projet, connecter App Store Connect (clé In-App Purchase) et Google Play
   (compte de service) ; créer les produits d'abonnement dans les deux stores.
2. **Entitlements** : `basic` et `premium` (identifiants exacts, utilisés par le webhook).
   Rattacher les produits Basic à `basic`, les produits Premium à `premium`
   (Premium peut aussi débloquer `basic` : le webhook retient le niveau le plus élevé).
3. Dans l'app mobile : `Purchases.logIn(<pilot id>)` après connexion, pour que
   `app_user_id` = `pilots.id` (les ids anonymes `$RCAnonymousID` sont ignorés).
4. **Webhook** (Project settings → Integrations → Webhooks) :
   - URL : `https://<ref>.supabase.co/functions/v1/revenuecat-webhook`
   - *Authorization header* : la valeur de `REVENUECAT_WEBHOOK_AUTH` (comparée telle quelle,
     avec ou sans préfixe `Bearer `).
   - `store` `APP_STORE` → source `apple`, `PLAY_STORE` → `google`. `CANCELLATION` conserve
     l'accès jusqu'à `expiration_at_ms`, `EXPIRATION` le retire.

Un pilote abonné sur plusieurs canaux garde le meilleur niveau actif ; `pilots.subscription_source`
indique le canal retenu (pour savoir où gérer l'abonnement).

## 8. Planification des alertes (pg_cron)

`license-alerts` sélectionne les documents dont `valid_until - aujourd'hui` est dans `alert_days`
(par défaut 90/30/7) ou vaut 0 — même logique que `packages/core/src/licenses.ts`, copiée dans
`supabase/functions/_shared/licenses.ts` (les fonctions ne peuvent pas importer les packages du
workspace : **garder les deux synchronisées**). Envoi d'un e-mail (Resend, langue du pilote) et d'un
push Expo à chaque jeton de `push_tokens` ; les jetons `DeviceNotRegistered` sont supprimés.
`license_alert_log` empêche un double envoi si la tâche tourne deux fois le même jour.

Activer les extensions **pg_cron** et **pg_net** (Database → Extensions), puis dans l'éditeur SQL :

```sql
-- secrets stockés dans Vault, pas en clair dans la définition du job
select vault.create_secret('https://<ref>.supabase.co', 'project_url');
select vault.create_secret('<CRON_SECRET>', 'cron_secret');

select cron.schedule(
  'cielo-license-alerts',
  '0 6 * * *',                      -- tous les jours à 06:00 UTC (07:00/08:00 à Paris)
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/license-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
```

On peut aussi utiliser l'écran **Integrations → Cron** du dashboard (même mécanisme).
Rejouer un jour manqué : `POST /functions/v1/license-alerts?date=2026-11-10` avec le même en-tête.
Suivi : `select * from cron.job_run_details order by start_time desc limit 10;`.

## 9. Synchronisation : pourquoi un LWW maison plutôt que PowerSync

`@cielo/sync` (`packages/sync`) implémente une synchronisation hors-ligne *last-write-wins* :

```ts
import { createSupabaseSync } from "@cielo/sync";
const sync = createSupabaseSync({ supabase, store, pilotId: session.user.id });
sync.start(60_000);                 // + sync.syncNow() au retour en ligne / au premier plan
const res = await sync.syncNow();   // { ok, pushed, pulled, errors } — ne lève jamais d'exception
```

Pour chaque table de `SYNC_TABLES` : **push** des lignes locales modifiées depuis la méta
`lastPush:<table>` (upsert, le trigger serveur garde la version la plus récente), puis **pull** des
lignes serveur dont `updated_at ≥ lastPull:<table>` (pagination par curseur `(updated_at, id)`),
écrites en local seulement si elles sont plus récentes que la copie locale. Les suppressions sont
logiques (`deleted_at`) et se propagent comme des modifications. Les types d'aéronefs publics ne
sont jamais poussés. Hors ligne, les erreurs sont listées dans `result.errors` et les curseurs
n'avancent que sur ce qui a réussi.

Pourquoi ce choix :

- **aucun service payant supplémentaire** : seulement Supabase (Postgres + PostgREST + RLS), déjà
  nécessaire pour l'auth, le stockage et les fonctions ; pas de serveur de synchro à héberger ;
- le modèle de données s'y prête : un carnet de vol est quasi mono-utilisateur, les conflits sont
  rares (même pilote sur deux appareils) et le « dernier écrit gagne » au niveau ligne suffit ;
- simple à auditer et à tester (tests vitest avec store mémoire et faux client Supabase).

Limites connues : la résolution est par ligne (pas par champ) et repose sur les horloges des
appareils (`updated_at` est fixé par le client) ; une horloge très en retard peut voir une
modification ignorée ou, côté pull, une ligne écrite avec un `updated_at` antérieur au curseur
d'un autre appareil n'être récupérée qu'à sa prochaine modification. Les apps doivent donc
horodater avec l'heure système (UTC) et éviter de réécrire `updated_at` sans modification réelle.

**PowerSync plus tard** : les apps ne parlent qu'au contrat `LocalStore` de `@cielo/core`. Si le
volume ou les besoins (synchro temps réel, résolution de conflits plus fine, horloge serveur)
le justifient, PowerSync (ou ElectricSQL) pourra être branché derrière ce même contrat — schéma
Postgres et RLS inchangés — en remplaçant uniquement `@cielo/sync`.

## 10. Checklist de mise en production

- [ ] Projet en `eu-central-1`, sauvegardes PITR activées (offre Pro).
- [ ] `supabase db push` + `seed.sql` appliqués.
- [ ] Secrets définis (§3), fonctions déployées (§4).
- [ ] Apple / Google configurés, secret Apple renouvelé avant expiration (§5).
- [ ] Webhooks Stripe et RevenueCat testés en mode test/sandbox (§6, §7).
- [ ] Job `cielo-license-alerts` planifié et une exécution vérifiée (§8).
- [ ] Domaine d'envoi vérifié chez Resend (SPF/DKIM) pour `ALERTS_FROM_EMAIL`.
- [ ] Mentions RGPD : export (`gdpr-export`) et suppression (`gdpr-delete`) accessibles dans les réglages.
