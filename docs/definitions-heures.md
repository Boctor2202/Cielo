# Définitions des heures dans Geardown

Une seule source : `packages/core/src/experience.ts` (`experience()`), utilisée par le cockpit web, l'Overview de l'app, les objectifs, le CV et le matching emploi. Tous les calculs se font **en minutes** ; l'arrondi n'intervient qu'à l'affichage.

| Grandeur | Définition | Champ(s) |
|---|---|---|
| Temps total | Temps bloc des vols réels + reports papier. Simulateur exclu. | `totalMin` + `opening.totalMin` |
| PIC | Commandant de bord **uniquement**. PICUS exclu. | `picMin` (+ report papier `picMin`) |
| PICUS | PIC sous supervision, affiché à part. Jamais compté comme PIC pour une exigence d'offre. | `picusMin` |
| SIC / copilote | Temps copilote | `copilotMin` |
| Double commande | Temps en instruction reçue | `dualMin` |
| Instructeur / examinateur | Séparés | `instructorMin`, `examinerMin` |
| Simulateur (FSTD) | Sessions FSTD, hors total et hors PIC | `fstdMin` (lignes `isFstd`) |
| Multi-pilote, monopilote SE / ME | Colonnes d'opération du carnet | `multiPilotMin`, `singlePilotSeMin`, `singlePilotMeMin` |
| Multimoteur | Monopilote ME + multi-pilote | |
| Turbine / jet / turbopropulseur | Selon le moteur du type d'avion. Type inconnu : compté à part (`unknown.engineMin`), jamais deviné. | |
| PIC sur jet | PIC sur un vol dont le type est un jet | `picJetMin` |
| PIC sur turbopropulseur multimoteur | PIC sur turboprop, limité aux minutes en colonne multimoteur (un PC-12 monomoteur ne compte pas) | `picMeTurbopropMin` |
| PIC jet ou turboprop multimoteur | Somme des deux précédents | `picJetOrMeTurbopropMin` |

## Reports papier (soldes d'ouverture)
- Ils n'ont **pas de champ PICUS** : un PIC papier peut contenir du PICUS sans qu'on le sache → `unknown.openingPicMin`.
- Sans type d'avion, ils ne sont attribués ni au jet, ni à la turbine, ni au « sur type » → `unknown.openingNoTypeMin`. Le matching emploi traite ces cas comme « à vérifier », pas comme atteints.

## Exports au format des autorités
- **Format EASA / UK (AMC1 FCL.050)** : la colonne PIC inclut le PICUS, conformément au format (le PIC contresigne). Conservé.
- **Formats FAA (14 CFR 61.51) et Transport Canada** : la colonne PIC inclut aussi le PICUS, comme avant. **Question ouverte** : ces formats n'ont pas de colonne PICUS ; à confirmer avec vous (laisser en PIC, passer en SIC ou mettre en remarque).
- Page de synthèse PDF : libellé « PIC (incl. PICUS) » et ligne « of which PICUS ».

## Écarts corrigés (erreurs de présentation ou de calcul)
| Endroit | Avant | Après |
|---|---|---|
| Cockpit web (puce PIC) | PIC + PICUS | PIC strict, puce PICUS séparée si > 0 |
| Overview app (puce PIC) | PIC + PICUS | PIC strict + ligne « PICUS … (non inclus dans le PIC) » |
| Objectif « PIC » | PIC + PICUS | PIC strict |
| CV, heures par type | PIC + PICUS | PIC strict + PICUS à part |
| CV, contrôle ATS « heures PIC » | PIC + PICUS | PIC strict |
| Profil emploi (`buildProfile`) | PIC + PICUS | PIC strict, + `picusMin`, `picJetOrMeTurbopropMin`, `unknown` |
