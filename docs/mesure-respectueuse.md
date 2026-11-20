# Mesure respectueuse

Code :
- liste des événements : `packages/core/src/metrics.ts` ;
- envoi côté client : `apps/web/src/lib/metrics.ts` ;
- point d'entrée : `apps/web/src/app/api/metrics/route.ts` ;
- table : `supabase/migrations/0024_funnel_daily.sql`, **non appliquée**.

## Principe
- Seuls sont envoyés **un nom d'événement et la plateforme**.
- Le serveur ajoute 1 au compteur du jour. Rien d'autre n'est enregistré : ni compte, ni e-mail, ni IP, ni contenu de vol, de document ou de donnée médicale.
- La mesure est désactivée par défaut et s'active avec `NEXT_PUBLIC_METRICS=1`.
- Rien n'est envoyé si le navigateur demande à ne pas être suivi (GPC ou Do Not Track).
- La table n'est lisible que par le serveur : RLS activé, sans policy.

## Événements
| Événement | Branché | Étape du parcours |
|---|---|---|
| `demo_open` | ✅ web | Visite → démo |
| `import_success` / `import_fail` | ✅ web | Début → réussite d'import, échecs d'import |
| `export` | ✅ web (CSV, PDF) | Premier export (agrégé) |
| `signup`, `first_flight`, `checkout_open`, `support_request`, `import_start` | ⏳ prévus, non branchés | Démo → inscription, premier vol, essai → abonnement |

**Rétention et renouvellement** : ces mesures sont calculées à partir des abonnements existants (dates d'expiration, webhooks Stripe et RevenueCat), sans nouvelle collecte.

## Limites
- Des compteurs journaliers ne permettent pas de suivre une même personne d'une étape à l'autre. Les taux de conversion sont donc approximatifs, par rapport des volumes du jour ou de la semaine. C'est le prix de l'absence d'identifiant.
- Le « délai jusqu'au premier carnet exploitable » demande un suivi par compte. Il n'est pas mesuré.
- Aucun chiffre de conversion ou de satisfaction n'est affiché tant qu'il n'existe pas de mesure réelle.

## Mise en service
1. Vous dites « applique la migration 0024 ».
2. Ajouter `NEXT_PUBLIC_METRICS=1` dans Vercel.
3. Mettre à jour la politique de confidentialité, puis relire les compteurs : `select * from funnel_daily order by day desc`.
