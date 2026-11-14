import { SITE } from "@/config/site";

/** Legal templates — to be completed and reviewed by legal counsel before publication. */
type Doc = { title: string; sections: { h: string; p: string[] }[] };
type Key = "notice" | "privacy" | "terms" | "cookies";

const c = SITE.company;
export const LEGAL_UPDATED = "2026-11-10";

export const LEGAL: Record<"fr" | "en", Record<Key, Doc>> = {
  fr: {
    notice: {
      title: "Mentions légales",
      sections: [
        { h: "Éditeur", p: [`${c.legalName}, ${c.address}. ${c.registration}.`, `Directeur de la publication : ${c.publisher}.`, `Contact : ${SITE.contactEmail}.`] },
        { h: "Hébergement", p: [`${c.host}. Les données de l'application sont hébergées dans l'Union européenne.`] },
        { h: "Propriété intellectuelle", p: ["Le nom Geardown, le logo, les textes, interfaces et le code sont la propriété de l'éditeur. Toute reproduction sans autorisation est interdite."] },
        { h: "Données aéronautiques", p: ["La base d'aérodromes provient d'OurAirports (domaine public). Les désignateurs de types d'aéronefs suivent le Doc 8643 de l'OACI."] },
      ],
    },
    privacy: {
      title: "Politique de confidentialité (RGPD)",
      sections: [
        { h: "Responsable du traitement", p: [`${c.legalName}, ${c.address}. Contact : ${SITE.contactEmail}.`] },
        { h: "Données traitées", p: ["Données de compte : adresse e-mail, nom, mode de connexion (e-mail, Apple, Google).", "Données de carnet de vol : vols, appareils, licences, aptitude médicale (date de validité), roster, escales, signatures, documents joints que vous ajoutez.", "Données techniques : journaux de connexion et de synchronisation, nécessaires à la sécurité du service."] },
        { h: "Finalités et bases légales", p: ["Fournir le carnet de vol et sa synchronisation (exécution du contrat).", "Envoyer les alertes d'échéance que vous avez activées (exécution du contrat).", "Facturer les abonnements (obligation légale et exécution du contrat).", "Sécuriser le service (intérêt légitime)."] },
        { h: "Données de santé", p: ["Geardown n'enregistre de votre certificat médical que sa classe et ses dates. N'ajoutez pas de document médical détaillé : si vous le faites, il est stocké chiffré et n'est accessible qu'à vous."] },
        { h: "Destinataires et sous-traitants", p: ["Hébergement et base de données (Union européenne), paiement (Stripe, Apple, Google), envoi d'e-mails transactionnels. Aucune donnée n'est vendue ni utilisée à des fins publicitaires."] },
        { h: "Durée de conservation", p: ["Vos données sont conservées tant que votre compte est actif. Elles sont supprimées dans les 30 jours suivant la suppression du compte, sauf obligations légales (facturation : 10 ans)."] },
        { h: "Vos droits", p: ["Accès, rectification, effacement, limitation, opposition et portabilité. Depuis Paramètres › Mes données, vous pouvez télécharger l'intégralité de vos données (JSON) et supprimer votre compte. Vous pouvez aussi nous écrire et saisir la CNIL (cnil.fr)."] },
        { h: "Sécurité", p: ["Chiffrement en transit (TLS), cloisonnement des données par compte (Row Level Security), stockage privé des documents, sauvegardes automatiques."] },
      ],
    },
    terms: {
      title: "Conditions générales d'utilisation",
      sections: [
        { h: "Objet", p: ["Les présentes CGU encadrent l'utilisation du site et des applications Geardown, carnet de vol électronique pour pilotes."] },
        { h: "Compte", p: ["Vous êtes responsable de la confidentialité de vos moyens de connexion et de l'exactitude des informations saisies."] },
        { h: "Responsabilité du pilote", p: ["Geardown est un outil d'aide. Les calculs (temps de nuit, expérience récente, FTL, échéances) sont fournis à titre indicatif. Le pilote demeure seul responsable de la tenue de son carnet de vol et du respect de la réglementation (Part-FCL, ORO.FTL, manuel d'exploitation)."] },
        { h: "Abonnements", p: ["Les offres payantes sont souscrites sur le web (Stripe) ou via l'App Store / Google Play. Elles se renouvellent automatiquement et sont résiliables à tout moment ; la résiliation prend effet à la fin de la période en cours. Le droit de rétractation de 14 jours s'applique aux souscriptions web selon le Code de la consommation."] },
        { h: "Vos données", p: ["Vous restez propriétaire de vos données. Elles restent exportables après résiliation."] },
        { h: "Droit applicable", p: ["Droit français. À défaut d'accord amiable, les tribunaux compétents sont ceux du ressort du siège de l'éditeur, sous réserve des règles protectrices du consommateur."] },
      ],
    },
    cookies: {
      title: "Cookies",
      sections: [
        { h: "Cookies utilisés", p: ["Geardown n'utilise aucun cookie publicitaire ni de mesure d'audience tiers.", "Stockage strictement nécessaire : session de connexion, préférence de langue et de thème, base locale du carnet (IndexedDB) pour le fonctionnement hors ligne.", "Ces traceurs étant indispensables au service, ils ne nécessitent pas de consentement (article 82 de la loi Informatique et Libertés)."] },
      ],
    },
  },
  en: {
    notice: {
      title: "Legal notice",
      sections: [
        { h: "Publisher", p: [`${c.legalName}, ${c.address}. ${c.registration}.`, `Publication director: ${c.publisher}.`, `Contact: ${SITE.contactEmail}.`] },
        { h: "Hosting", p: [`${c.host}. Application data is hosted in the European Union.`] },
        { h: "Intellectual property", p: ["The Geardown name, logo, texts, interfaces and code belong to the publisher. Any reproduction without permission is prohibited."] },
        { h: "Aeronautical data", p: ["The aerodrome database comes from OurAirports (public domain). Aircraft type designators follow ICAO Doc 8643."] },
      ],
    },
    privacy: {
      title: "Privacy policy (GDPR)",
      sections: [
        { h: "Controller", p: [`${c.legalName}, ${c.address}. Contact: ${SITE.contactEmail}.`] },
        { h: "Data processed", p: ["Account data: e-mail address, name, sign-in method (e-mail, Apple, Google).", "Logbook data: flights, aircraft, licences, medical certificate (validity dates), roster, layovers, signatures, attachments you add.", "Technical data: sign-in and sync logs required for service security."] },
        { h: "Purposes and legal bases", p: ["Provide the logbook and its sync (contract).", "Send the expiry alerts you enabled (contract).", "Bill subscriptions (legal obligation and contract).", "Secure the service (legitimate interest)."] },
        { h: "Health data", p: ["Geardown only stores your medical certificate class and dates. Do not upload detailed medical documents: if you do, they are stored encrypted and accessible to you only."] },
        { h: "Recipients and processors", p: ["Hosting and database (European Union), payment (Stripe, Apple, Google), transactional e-mail. No data is sold or used for advertising."] },
        { h: "Retention", p: ["Data is kept while your account is active and deleted within 30 days of account deletion, except legal obligations (invoices: 10 years)."] },
        { h: "Your rights", p: ["Access, rectification, erasure, restriction, objection and portability. From Settings › My data you can download all your data (JSON) and delete your account. You can also contact us and lodge a complaint with your supervisory authority."] },
        { h: "Security", p: ["Encryption in transit (TLS), per-account data isolation (Row Level Security), private document storage, automatic backups."] },
      ],
    },
    terms: {
      title: "Terms of use",
      sections: [
        { h: "Purpose", p: ["These terms govern the use of the Geardown website and apps, an electronic logbook for pilots."] },
        { h: "Account", p: ["You are responsible for keeping your sign-in credentials confidential and for the accuracy of the data you enter."] },
        { h: "Pilot responsibility", p: ["Geardown is an aid. Calculations (night time, recent experience, FTL, expiries) are indicative. The pilot remains solely responsible for keeping their logbook and complying with regulations (Part-FCL, ORO.FTL, operations manual)."] },
        { h: "Subscriptions", p: ["Paid plans are purchased on the web (Stripe) or through the App Store / Google Play. They renew automatically and can be cancelled anytime; cancellation takes effect at the end of the current period."] },
        { h: "Your data", p: ["You own your data. It remains exportable after cancellation."] },
        { h: "Governing law", p: ["French law, subject to mandatory consumer protection rules of your country of residence."] },
      ],
    },
    cookies: {
      title: "Cookies",
      sections: [
        { h: "Cookies in use", p: ["Geardown uses no advertising or third-party analytics cookies.", "Strictly necessary storage only: sign-in session, language and theme preference, the local logbook database (IndexedDB) for offline use.", "As they are essential to the service, they do not require consent."] },
      ],
    },
  },
};
