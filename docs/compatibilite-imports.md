# Compatibilité des imports

Code : `packages/core/src/import.ts` (détection des colonnes), `importFormats.ts` (formats d'applications), `universalImport.ts` (mémoire des formats), `airFranceEp5.ts`, `leon.ts`, `ical.ts`. Import IA côté serveur : `apps/web/src/app/api/import-any`.

Légende :
- ✅ testé automatiquement (test présent dans `packages/core/test`) ;
- 🟡 reconnu par le code, sans fichier réel de test ;
- ⚠️ partiel.

## Carnets (vols)
| Source | Format | Statut | Détails |
|---|---|---|---|
| ForeFlight | CSV (tables Aircraft + Flights) | ✅ | Type d'avion repris de la table Aircraft |
| LogTen Pro | TSV, colonnes `flight_…` | ✅ | Préfixes retirés |
| MyFlightbook | CSV, colonne Route | ✅ | Route découpée en départ / arrivée |
| mccPILOTLOG, CrewLounge, Flylog, Logbook Pro, APDL, Safelog | CSV / Excel | 🟡 | Reconnus par le nom des colonnes |
| Carnet papier EASA / FAA ressaisi en tableur | CSV / Excel, en-têtes sur 2 lignes | ✅ | Fusion des en-têtes « Departure » + « Place » |
| Air France EP5 | PDF mensuel | ✅ | Heures « jour \| décimal » |
| Tout autre tableur | CSV / Excel | ⚠️ | Détection par en-têtes et contenu, correction manuelle des colonnes (web), mémoire du format pour les imports suivants ; import IA en secours |

## Colonnes lues
- **Date et vol** : date, n° de vol, départ, arrivée.
- **Heures** : off-block, décollage, atterrissage, on-block.
- **Avion** : immatriculation, type.
- **Équipage** : fonction, nom du CDB.
- **Temps** : total, nuit, IFR.
- **Décollages et atterrissages** : jour et nuit.
- **Temps par fonction** : PIC, **PICUS**, copilote, double commande, instructeur, multipilote, **monopilote SE et ME**.
- **Autres** : remarques, type et temps FSTD.

## Corrections de ce lot
- **Une colonne PICUS était ignorée**, et ces heures étaient perdues. Elle est maintenant lue, et la fonction du vol devient PICUS ; elle n'est jamais lue comme du PIC.
- **« PICUS time », « SE » et « ME » étaient pris pour des heures bloc.** Une colonne de durées pouvait ainsi devenir l'off-block ou l'on-block. Ces colonnes sont maintenant reconnues.
- Les temps SE et ME sont recalculés à partir du nombre de moteurs du type d'avion. Les colonnes du fichier servent seulement à ne pas les confondre avec d'autres colonnes.

## Limites
- Le temps par fonction (PIC, copilote…) sert à déterminer la fonction du vol. Le vol entier est ensuite attribué à cette fonction : un vol partagé entre PIC et copilote ne peut pas être importé tel quel.
- Les temps examinateur, solo, IFR simulé et attentes (holdings) ne sont pas lus depuis un fichier.
- Les reports papier (soldes d'ouverture) n'ont pas de champ PICUS : voir `definitions-heures.md`.
- Les formats marqués 🟡 n'ont pas été vérifiés sur un vrai fichier exporté. Des fichiers d'exemple anonymisés permettraient d'ajouter des tests.

## Rosters
| Source | Format | Statut |
|---|---|---|
| Calendrier iCal (AIMS, Sabre, Lufthansa Systems, export Google / Apple) | .ics / URL | ✅ |
| Leon | PDF imprimé | ✅ (sans IA) |
| Autres PDF de roster | PDF | ⚠️ lecture IA côté serveur, abonnés Max |
