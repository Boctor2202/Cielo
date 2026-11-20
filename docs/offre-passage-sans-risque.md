# Offre « Passage sans risque » : mise en service

- **Branche** : `offre-passage-sans-risque`, créée à partir de `qualite-donnees`. Elle n'est pas poussée.
- **Production** : rien n'est publié. Aucun prix réel, abonnement ou webhook n'a été modifié.

## Étapes de votre côté, dans l'ordre

### 1. Base de données
Ces migrations sont réversibles, et je ne les applique que sur votre ordre.

| Migration | Contenu | Annulation |
|---|---|---|
| 0025 ✅ appliquée le 20/11 | journal des rappels d'essai | `drop table trial_reminder_log` |
| 0026 ✅ appliquée le 20/11 | `pilots.student_until` | `alter table pilots drop column student_until` |
| 0024 (déjà préparée) | compteurs de mesure | — |

### 2. Fonctions Supabase (déploiement à me demander)
- `create-checkout-session` : la carte n'est demandée qu'à l'abonnement, et les jours d'essai restants sont conservés (`trial_end`). La formule Élève y est ajoutée.
- `trial-reminders` (nouvelle) : rappels par e-mail à J-7 et J-1 via Resend. Elle se programme dans pg_cron, comme `license-alerts` (`docs/backend.md`, §8), avec le même `CRON_SECRET`.

### 3. Stripe
Les abonnés existants gardent leur prix.
1. Créez les nouveaux prix :
   - Basic 39,99 €/an ;
   - Basic 3,99 €/mois ;
   - Élève 19,99 €/an.
   - Max reste inchangé.
2. Variables de la fonction :
   - renommez les anciens prix Basic en `STRIPE_PRICE_BASIC_YEARLY_LEGACY` et `STRIPE_PRICE_BASIC_MONTHLY_LEGACY`, pour qu'ils restent reconnus ;
   - renseignez les nouveaux dans `STRIPE_PRICE_BASIC_YEARLY`, `STRIPE_PRICE_BASIC_MONTHLY` et `STRIPE_PRICE_STUDENT_YEARLY`.
3. Remboursement sous 30 jours : dans Stripe › Paiements › le paiement › « Rembourser ».

### 4. App Store Connect et RevenueCat
1. **Basic annuel** : nouveau prix de 39,99 €, en choisissant « conserver le prix actuel pour les abonnés existants ».
2. **Basic mensuel** : nouveau prix de 3,99 €, avec la même option.
3. **Élève** : nouveau produit `geardown_student_yearly` à 19,99 €, rattaché dans RevenueCat à l'entitlement `basic`. L'achat dans l'app n'est pas encore codé.
4. **Essai d'une semaine** : retirez-le (offre de lancement) des 4 abonnements. L'essai de 30 jours sans carte passe par le compte.
5. **Remboursement App Store** : c'est Apple qui décide. Le texte le dit.
6. **Bêta** : créez un groupe de testeurs externes TestFlight avec un lien public (une relecture bêta par Apple est nécessaire), puis renseignez `SITE.betaUrl` dans `apps/web/src/config/site.ts`.

### 5. Variables Vercel et EAS
| Variable | Valeur | Quand |
|---|---|---|
| `NEXT_PUBLIC_NO_CARD_TRIAL_DAYS` | vide (30 par défaut) ou `0` pour couper | — |
| `NEXT_PUBLIC_STUDENT_PLAN=1` | active la formule Élève sur le web | après l'étape 1 (migration 0026) et la création du prix Élève dans Stripe |
| `EXPO_PUBLIC_NO_CARD_TRIAL_DAYS` | vide (30 par défaut) | — |

### 6. Contenus
- `SITE.dataRegion = "eu"` : à mettre seulement après confirmation de la région d'hébergement dans Supabase › Settings › General.
- Témoignages : `apps/web/src/content/testimonials.ts`, uniquement avec l'accord écrit des pilotes.

## Ce qui n'est pas fait
- Achat de la formule Élève dans l'app iPhone : il faut d'abord le produit App Store.
- Passage automatique de la formule Élève à Basic à la date de licence (fonction programmée Stripe à écrire). Aujourd'hui, la formule Élève n'est simplement plus proposée après cette date.
- Saisie des totaux du carnet papier, pour un fichier sans colonnes de totaux. L'écran « Vérifiez vos totaux » affiche alors « Absent du fichier ».
- Android : aucune version n'existe.
