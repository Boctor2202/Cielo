# FTL : hypothèses et statuts

Code : `packages/core/src/ftl.ts`. Page web `/app/ftl`, écran app « FTL ».

## Split duty (CS FTL.1.220)
- Il n'est **jamais déduit d'un simple écart** entre deux vols.
- Une pause qui pourrait en être un apparaît comme « split possible », sans être appliquée.
- L'extension ne compte que si les deux conditions sont réunies :
  1. le réglage « Mon exploitant applique le split duty » est activé ;
  2. la pause est confirmée, soit par le pilote, soit par le roster (événement intitulé SPLIT, BREAK, PAUSE, COUPURE, HTL ou hôtel pendant la pause).
- Si la FDP dépasse le maximum mais qu'un split possible la couvrirait, Geardown affiche un **avertissement à vérifier**, pas une infraction.

## Statut de chaque service
| Statut | Condition |
|---|---|
| Confirmé | Présentation et fin de service lues dans le roster, base connue |
| Estimé | Présentation ou fin de service calculée à partir des réglages, ce qui est toujours le cas pour le carnet |
| Non déterminable | Base d'affectation absente, ou aucune réglementation choisie |

- Un dépassement sur un service « non déterminable » est un avertissement, pas une erreur.
- La réglementation appliquée (ORO.FTL, Subpart Q ou aucune) et la base sont affichées en tête de page. L'absence de base est signalée.

## Non couverts (inchangé)
- Équipage renforcé.
- État d'acclimatation inconnu.
- Règles de réserve.
- Schémas propres à un exploitant.

## Limites
- Le réglage split duty et les confirmations sont enregistrés **sur chaque appareil**, pas synchronisés. Les synchroniser demanderait une colonne `pilots.ftl` (jsonb, migration à préparer) ; ce n'est pas fait, pour ne pas pousser vers un champ qui n'existe pas encore en base.
- Dans l'app, le calcul ne porte que sur le carnet : le roster à venir n'est pas encore pris en compte, contrairement au web.
