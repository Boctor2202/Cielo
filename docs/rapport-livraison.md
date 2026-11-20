# Passe qualité : rapport de livraison

- **Branche** : `qualite-donnees` (12 commits au-dessus de `main`). Rien n'est publié en production.
- **Prévisualisation Vercel** : déploiement de la branche (`cielo-git-qualite-donnees-…vercel.app`), visible dans le tableau de bord Vercel.
- **Documents liés** :
  - [`definitions-heures.md`](definitions-heures.md)
  - [`regles-matching.md`](regles-matching.md)
  - [`ftl-hypotheses.md`](ftl-hypotheses.md)
  - [`compatibilite-imports.md`](compatibilite-imports.md)
  - [`mesure-respectueuse.md`](mesure-respectueuse.md)

## 1. Ce qui est fait, avec sa nature

| Lot | Correction | Nature |
|---|---|---|
| Heures | PIC compté sans PICUS dans le cockpit web, l'Overview de l'app, les objectifs, le CV (par type, contrôle ATS) et le profil emploi. Le PICUS est affiché à part. | Erreur de calcul et de présentation |
| Heures | Module unique `experience.ts` : PIC sur jet, PIC sur turboprop multimoteur, turbine, inconnus séparés | Définition |
| Exports | Les colonnes PIC au format EASA/UK incluent le PICUS, comme le prévoit le format. La synthèse PDF l'indique : « PIC (incl. PICUS) » et « of which PICUS ». | Différence légitime, documentée |
| Emplois | Évaluation critère par critère (atteint / non atteint / à vérifier). L'inconnu n'est jamais compté comme atteint. Exigences implicites inventées supprimées. | Erreur de calcul |
| Emplois | Lecture du PIC qualifié (« 300 h PIC jet ou turboprop multimoteur »), souhaité ou obligatoire, extrait de l'annonce, licences alternatives | Extraction |
| Emplois | « Multi-engine » n'est plus lu comme multi-pilote ; « 450 h par an » n'est plus lu comme un minimum | Erreur de calcul |
| Emplois | Droits de travail : non déclarés = à vérifier ; par pays hors UE, Royaume-Uni, États-Unis et Canada | Hypothèse réglementaire |
| Offres | Date de publication jamais inventée (Greenhouse) ; date de vérification affichée ; vivier distingué d'un poste ; copies regroupées ; ambiguïtés signalées ; en cas de panne totale, la liste reste en cache | Collecte |
| FTL | Plus de split duty déduit d'un écart. Statuts confirmé / estimé / non déterminable. Réglementation et base affichées, base manquante signalée. | Erreur de calcul et transparence |
| Audit | Temps instructeur logué en plus du PIC : ce n'est plus une erreur | Erreur de calcul |
| Audit | Continuité vérifiée seulement dans une même rotation (le cas CDG → Toussus est résolu). Colonnes SE/ME vides : à vérifier. Explication par contrôle. Alerte « expliquée » avec justification, réactivée si le vol change. | Contextualisation |
| Imports | Une colonne PICUS était ignorée et ses heures perdues ; « PICUS time », SE et ME pouvaient devenir des heures bloc | Erreur de calcul |
| Démo | Une démo chargée puis un compte créé : les vols fictifs étaient fusionnés dans le vrai compte. C'est corrigé. | Bug de données |
| Démo | Même personnage partout (Thomas Mercier) ; photos d'avions coupées pour les immatriculations fictives ; bandeaux « données fictives » ; journées FTL réalistes | Données de démo |
| Offre | Signature dans Basic (client et serveur) ; essai sans carte de N jours, désactivé par défaut ; facturation décrite par période | Promesse et droits |
| Textes | « officiel » et « conforme » remplacés par « au format … » ; plus de « trace réelle de chaque vol », de « chiffré » ambigu, de garantie ATS, d'Android annoncé ni de stores présentés comme disponibles ; couverture des offres décrite ; plus de liens « # » ni de témoignages vides | Promesse |
| Pages | Nouvelle page « Vos données vous appartiennent » (`/fr/vos-donnees`, `/en/your-data`), ajoutée au sitemap et au pied de page | Confiance |
| UI | Statistiques : heures avant badges ; offres : « non communiqué » | Présentation |
| Mesure | Compteurs journaliers sans identifiant (préparés, désactivés) | Mesure |

## 2. Tests

| Paquet | Résultat |
|---|---|
| core | 106 tests ✅ |
| jobs | 24 tests ✅, dont le cas PC-24 |
| cv | 9 tests ✅ |
| sync | 13 tests ✅ |
| export | 2 tests ✅ |
| Typecheck des 7 projets | ✅ |
| Build de prévisualisation Vercel | ✅ READY |

Vérification visuelle en local, en démo, avec Playwright : tableau de bord, emplois, FTL, audit, statistiques, page données, tarifs. Aucune erreur JavaScript n'est remontée.

## 3. Limites restantes

**Données et synchronisation**
- Les explications d'audit, le réglage split duty et les droits de travail sont enregistrés **par appareil**, sans synchronisation.
- Les offres déjà collectées n'auront les nouveaux champs qu'après la prochaine collecte (6 h).
- Les reports papier n'ont pas de champ PICUS : leur PIC est traité comme « à vérifier » pour les exigences.

**Formats**
- Formats d'import marqués 🟡 : ils ne sont pas vérifiés sur des fichiers réels.
- Exports FAA et Transport Canada : PICUS imprimé dans la colonne PIC. C'est une question ouverte.

**Application mobile**
- Les écrans de l'app (emplois, FTL, audit, Overview) sont modifiés dans le code. Ils ne sont **pas publiés** : il faut une OTA, et le build 14 reste compatible.
- L'app n'a pas encore d'écran pour les droits de travail, ni pour expliquer une alerte d'audit.

**Pas encore fait**
- Navigation réorganisée (Accueil / Carnet / Activité / Carrière / Compte / Outils) : une maquette vous sera montrée avant, comme convenu.
- Fond uni optionnel et accessibilité (contrastes, focus, réduction des animations, lecteurs d'écran) : non audités dans cette passe.
- CV : seuls les PIC/PICUS sont alignés. La relecture « pas de Captain inventé », les suggestions à confirmer et le choix des pièces du dossier n'ont pas été faits.
- Signature : textes corrigés, mais l'invalidation de la signature après modification n'a pas été revérifiée dans cette passe.
- Imports : l'annulation d'un lot importé et le rapprochement des totaux avant/après n'ont pas été ajoutés.
- Positionnement « Votre carnet à jour… », pages de migration et offre écoles/opérateurs : non traités.
- Vérifications techniques de sécurité (isolation des comptes, sauvegardes, sessions) : non auditées. Aucune affirmation n'a été ajoutée à leur sujet.

## 4. Informations qui me manquent (une seule demande)

1. **Mentions légales** :
   - raison sociale ;
   - adresse du siège ;
   - RCS/SIREN ;
   - directeur de la publication ;
   - hébergeur (nom et adresse).
2. **Région d'hébergement** de la base de données. Le site affirme « Union européenne » : est-ce exact ?
3. **Prestataire d'e-mails** utilisé pour les codes et les alertes, à citer dans la politique de confidentialité.
4. **Exports FAA et Transport Canada** : PICUS en colonne PIC (comme aujourd'hui), en SIC, ou en remarque ?
5. **Essai sans carte** : l'activer, et pour combien de jours (14 ?). Faut-il garder l'essai Apple de 7 jours en parallèle ?
6. **Réseaux sociaux et stores** : les URL réelles quand elles existeront.
7. **Témoignages** réels autorisés, s'il y en a.
8. **Fichiers d'export anonymisés** de LogTen, CrewLounge, mccPILOTLOG, Flylog, Logbook Pro ou Safelog, pour tester ces formats.

## 5. Migrations et mise en service

| Étape | Action | Déclencheur |
|---|---|---|
| 1 | Relire la prévisualisation Vercel de la branche | Vous |
| 2 | Fusionner `qualite-donnees` dans `main` (déploiement web) | « fusionne la branche » |
| 3 | OTA de l'app sur le canal production | « envoie la mise à jour sur le canal production » |
| 4 | Migration `0024_funnel_daily.sql` (mesure). Réversible : `drop table funnel_daily; drop function funnel_bump;` | « applique la migration 0024 » |
| 5 | `NEXT_PUBLIC_METRICS=1` dans Vercel, après la mise à jour de la politique de confidentialité | Vous |
| 6 | Essai sans carte : `NEXT_PUBLIC_NO_CARD_TRIAL_DAYS=14` (Vercel) et `EXPO_PUBLIC_NO_CARD_TRIAL_DAYS=14` (EAS) | Votre décision (point 5) |
| 7 | Noms de CDB fictifs sur le compte démo : `scripts/demo/patch-captains.sql` | Votre accord |

Aucune migration de cette passe ne modifie de données existantes.
