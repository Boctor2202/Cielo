# Règles du matching emploi

Code : `packages/jobs/src/extract.ts` (lecture de l'offre), `evaluate.ts` (critères), `match.ts` (profil et % secondaire). Le calcul tourne sur l'appareil du pilote ; le carnet n'est jamais envoyé.

## 1. Ce qui est lu dans l'offre
- **Licence** : la plus basse des licences acceptées quand l'offre en liste plusieurs (« Frozen ATPL or CPL/IR » → minimum CPL, alternatives conservées).
- **Heures** : total, PIC, sur type, multi-pilote, jet, turbine. Chaque chiffre garde un **extrait de l'offre** (≤ 140 caractères) pour vérification.
- **PIC qualifié** : « PIC on jet », « PIC jet or multi-engine turboprop », « PIC turbine », « PIC multi-engine ».
- **Souhaité / obligatoire** : « preferred, an advantage, souhaité, un atout, von Vorteil… » → critère non bloquant.
- **Multimoteur ≠ multi-pilote** : un chiffre « multi-engine » n'est plus lu comme des heures multi-pilote (erreur de calcul corrigée) ; il n'est pas lu du tout plutôt que mal lu.

## 2. Évaluation de chaque critère
| Verdict | Quand |
|---|---|
| Atteint | Le carnet le montre, sans compter sur une donnée non classée |
| Non atteint | Le carnet reste clairement en dessous |
| À vérifier | Geardown ne peut pas trancher. **Jamais compté comme atteint.** |

Cas « à vérifier » :
- licence, anglais ou autorité non renseignés ;
- PIC atteint seulement grâce à des reports papier (qui peuvent contenir du PICUS) ;
- heures jet, turbine ou sur type qui pourraient être atteintes avec des heures non classées (type inconnu, report sans type) ;
- qualification sur un type de la même famille ;
- droits de travail non déclarés ;
- droits de travail dans une région où ils dépendent du pays (Moyen-Orient, Asie-Pacifique, Afrique, Amérique latine).

Le PICUS n'est **jamais** compté comme PIC. Pour « 300 h PIC sur jet ou turboprop multimoteur » (cas PC-24) : seul le PIC sur jet, ou sur turboprop en colonne multimoteur, compte. Le PIC sur PC-12 monomoteur et le PICUS sur A320 ne comptent pas.

## 3. Droits de travail
- Une déclaration par région ne vaut que là où un seul droit couvre la région : UE/EEE + Suisse, Royaume-Uni, États-Unis, Canada.
- Visa parrainé indiqué dans l'offre → critère atteint (motif affiché).
- L'autorité de licence déduite du pays est affichée comme « déduite du pays », pas comme une exigence de l'offre.

## 4. Ce qui a été retiré
Les exigences implicites inventées (« un poste de CDB demande 1 500 h PIC », « un avion multi-pilote demande 500 h MP ») ne sont plus ajoutées. Seul ce que l'offre indique est évalué.

## 5. Affichage (web et app)
« Critères indiqués dans l'offre : N atteints · N non atteints · N à vérifier ». Le détail suit : écart chiffré (« il manque 120 h »), motif et extrait. Le % reste affiché, mais en second.

## Limites
- Les offres déjà collectées n'ont pas les nouveaux champs (qualificatif, souhaité, extraits) tant qu'elles n'ont pas été recollectées.
- Les droits de travail se déclarent sur le web, par appareil (stockage local, non synchronisé). L'app n'a pas encore cet écran : elle affiche « à vérifier ».
- L'extraction est faite par expressions régulières (anglais, français, allemand) : une offre rédigée autrement peut être mal lue. L'extrait affiché permet de le voir.
