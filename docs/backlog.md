# Reste à faire

Liste des chantiers en attente, du plus récent au plus ancien. Cocher ou retirer une ligne quand elle est faite.

## En attente d'une décision

- **Scan du carnet papier par IA.** Remplacer la reconnaissance Tesseract (mauvaise sur l'écriture manuscrite, lecture ligne à ligne) par un modèle de vision qui lit une page EASA ou FAA complète : date, lieux, heures, type, immatriculation, temps par fonction, nuit, IFR, atterrissages. Relecture dans un tableau avec la photo à côté, puis import. Sur le site et sur l'app (photo prise directement, plusieurs pages). Nécessite une clé API dans Vercel et a un coût par page ; réservé à l'offre Max.
- **Vidéo du pilote sur la page profil.** La première génération montre un visage net au lieu d'une silhouette à contre-jour : à refaire avant intégration. Option plus tard : une version personnalisée avec le vrai visage, réservée aux abonnés Max.
- **Film de la homepage : plan du toucher des roues** (3ᵉ plan, 8 s en 1080p), si l'on veut prolonger le film.

## App mobile

- Retours sur la mise à jour visuelle (captures d'écran attendues).
- Bêta externe TestFlight : soumettre le build à la revue bêta d'Apple.
- Abonnements dans l'App Store (RevenueCat).

## Site et compte

- Politique de confidentialité et mentions légales (après obtention du SIRET).
- Paiement Stripe en mode test.
- Décider du sort des 8 vols qui se chevauchent dans le carnet.
- Choisir le régime FTL Subpart Q dans les réglages du compte (à faire par le pilote).
- Branche `screens-i18n` obsolète à supprimer.
