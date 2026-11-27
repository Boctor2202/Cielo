import { SITE } from "@/config/site";

/** Legal templates — to be completed and reviewed by legal counsel before publication. */
type Doc = { title: string; sections: { h: string; p: string[] }[] };
type Key = "notice" | "privacy" | "terms" | "cookies";

const c = SITE.company;
const P = SITE.pricing;
const eur = (n: number | undefined, locale: "fr" | "en") => (n === undefined ? "" : locale === "fr" ? `${n.toFixed(2).replace(".", ",")} €` : `€${n.toFixed(2)}`);
export const LEGAL_UPDATED = "2026-11-27";

export const LEGAL: Record<"fr" | "en", Record<Key, Doc>> = {
  fr: {
    notice: {
      title: "Mentions légales",
      sections: [
        { h: "Éditeur", p: [`${c.legalName}, ${c.address}. ${c.registration}.`, `Directeur de la publication : ${c.publisher}.`, `Contact : ${SITE.contactEmail}.`] },
        { h: "Hébergement", p: [`Site et fonctions serveur : ${c.host}.`, `Base de données du carnet et documents joints : ${c.dataHost}.`] },
        { h: "Propriété intellectuelle", p: ["Le nom Geardown, le logo, les textes, interfaces et le code sont la propriété de l'éditeur. Toute reproduction sans autorisation est interdite."] },
        { h: "Données aéronautiques", p: ["La base d'aérodromes provient d'OurAirports (domaine public). Les désignateurs de types d'aéronefs suivent le Doc 8643 de l'OACI. La liste des compagnies aériennes provient d'OpenFlights (openflights.org), sous licence Open Database License (ODbL)."] },
      ],
    },
    privacy: {
      title: "Politique de confidentialité (RGPD)",
      sections: [
        { h: "Responsable du traitement", p: [`${c.legalName}, ${c.address}. Contact : ${SITE.contactEmail}.`] },
        { h: "Données traitées", p: ["Données de compte : adresse e-mail, nom, mode de connexion (e-mail, Apple, Google).", "Données de carnet de vol : vols, appareils, licences et qualifications, aptitude médicale (classe, dates, codes de limitation), roster, escales, signatures, documents joints que vous ajoutez.", "Recommandations d'adresses d'escale : les autres membres n'en voient que le nombre par adresse (à partir de 2), jamais qui les a faites.", "Données techniques : journaux de connexion et de synchronisation, nécessaires à la sécurité du service."] },
        { h: "Finalités et bases légales", p: ["Fournir le carnet de vol et sa synchronisation (exécution du contrat).", "Envoyer les alertes d'échéance que vous avez activées (exécution du contrat).", "Facturer les abonnements (obligation légale et exécution du contrat).", "Sécuriser le service (intérêt légitime).", "Compter les visiteurs du site par jour, sans cookie (intérêt légitime ; voir la page Cookies).", "Lire, à votre demande, une licence ou un certificat médical pour remplir vos documents (votre consentement ; pour les données de santé, votre consentement explicite, article 9.2.a du RGPD)."] },
        {
          h: "Données de santé",
          p: [
            "De votre certificat médical, Geardown n'enregistre que sa classe, ses dates, l'AeMC ou le médecin examinateur et, si vous les indiquez, ses codes de limitation (VDL, VML…). N'ajoutez pas de document médical détaillé : si vous le faites, il est stocké de façon privée et n'est accessible qu'à vous.",
            "Lecture d'un document (offre Max) : si vous choisissez « Lire un document », la photo ou le PDF de votre licence ou de votre certificat médical est envoyé à Anthropic, qui le lit pour Geardown. Cet envoi n'a lieu qu'avec votre consentement explicite, donné en cochant une case avant l'envoi. Geardown ne conserve ni la photo ni le PDF, ni aucune autre donnée qu'il contient (adresse, date de naissance, autres informations de santé) : seulement les fiches que vous vérifiez puis enregistrez.",
            "Anthropic n'utilise pas ces contenus pour entraîner ses modèles et les supprime dans les 30 jours, sauf s'il doit les conserver plus longtemps pour faire respecter sa politique d'utilisation ou pour se conformer à la loi.",
            "Vous pouvez retirer votre consentement à tout moment en décochant la case : aucun document n'est plus envoyé. Le retrait ne remet pas en cause les lectures déjà faites. Les fiches enregistrées se modifient et se suppriment depuis la page Documents.",
          ],
        },
        {
          h: "Destinataires et sous-traitants",
          p: [
            "Base de données et documents : Supabase, serveurs à Londres (Royaume-Uni).",
            "Site et fonctions serveur : Vercel (États-Unis).",
            "Paiement : Stripe (abonnements web) ; Apple et RevenueCat (abonnements dans l'app iPhone).",
            "E-mails (connexion, alertes d'échéance, rappels de fin d'essai) : Resend (États-Unis).",
            "Lecture automatique des documents que vous importez (photos de carnet, relevés PDF, licence, certificat médical) et rédaction de lettres de motivation, à votre demande : Anthropic (États-Unis), comme sous-traitant. Ces contenus ne servent pas à entraîner ses modèles et sont supprimés par Anthropic dans les 30 jours (sauf contrôle du respect de sa politique d'utilisation ou obligation légale).",
            "Remplissage d'un vol depuis l'ADS-B : seuls l'immatriculation et la date sont envoyés à FlightAware.",
            "Aucune donnée n'est vendue ni utilisée à des fins publicitaires.",
          ],
        },
        { h: "Transferts hors de l'Union européenne", p: ["Le Royaume-Uni bénéficie d'une décision d'adéquation de la Commission européenne. Les transferts vers les États-Unis sont encadrés par les garanties prévues par le RGPD (Data Privacy Framework ou clauses contractuelles types de la Commission européenne). Pour Anthropic, ce sont les clauses contractuelles types, intégrées à son avenant relatif au traitement des données."] },
        { h: "Durée de conservation", p: ["Vos données sont conservées tant que votre compte est actif. Elles sont supprimées dans les 30 jours suivant la suppression du compte, sauf obligations légales (facturation : 10 ans).", "Pour qu'un même utilisateur ne bénéficie qu'une fois de l'essai gratuit, nous conservons une empreinte chiffrée et irréversible de l'adresse e-mail (et non l'adresse elle-même) avec la date de début de l'essai, y compris après la suppression du compte, pendant 3 ans au plus. Base légale : notre intérêt légitime à prévenir les abus de l'offre d'essai."] },
        { h: "Vos droits", p: ["Accès, rectification, effacement, limitation, opposition et portabilité. Depuis Paramètres › Mes données, vous pouvez télécharger l'intégralité de vos données (JSON) et supprimer votre compte. Vous pouvez aussi nous écrire et saisir la CNIL (cnil.fr)."] },
        { h: "Sécurité", p: ["Chiffrement en transit (TLS), cloisonnement des données par compte (Row Level Security), stockage privé des documents, sauvegardes automatiques."] },
      ],
    },
    terms: {
      title: "Conditions générales d'utilisation et de vente",
      sections: [
        { h: "Objet", p: ["Les présentes CGU encadrent l'utilisation du site et des applications Geardown, carnet de vol électronique pour pilotes."] },
        { h: "Compte", p: ["Vous êtes responsable de la confidentialité de vos moyens de connexion et de l'exactitude des informations saisies."] },
        { h: "Responsabilité du pilote", p: ["Geardown est un outil d'aide. Les calculs (temps de nuit, expérience récente, FTL, échéances) sont fournis à titre indicatif. Le pilote demeure seul responsable de la tenue de son carnet de vol et du respect de la réglementation (Part-FCL, ORO.FTL, manuel d'exploitation)."] },
        { h: "Offres et prix", p: [`Basic : ${eur(P.basic.monthly, "fr")} par mois ou ${eur(P.basic.yearly, "fr")} par an. Max : ${eur(P.premium.monthly, "fr")} par mois ou ${eur(P.premium.yearly, "fr")} par an. Prix TTC, en euros, pour les nouveaux abonnés. Le contenu de chaque offre est décrit sur la page Tarifs.`, "Un changement de prix ne s'applique jamais à une période déjà payée. Il vous est annoncé au moins 30 jours avant votre prochain renouvellement, et vous pouvez résilier avant. Les premiers abonnés bénéficiant du prix fondateur gardent leur prix tant qu'ils restent abonnés sans interruption."] },
        { h: "Essai gratuit", p: [`Chaque nouveau compte bénéficie de ${P.trialDays} jours d'essai, sans carte bancaire. Rien n'est prélevé à la fin de l'essai : pour continuer à saisir des vols, vous choisissez une offre. Sans abonnement, vos données restent consultables et exportables.`] },
        { h: "Souscription et paiement sur le site", p: ["Le paiement est traité par Stripe. L'abonnement commence à la confirmation du paiement et se renouvelle automatiquement à la fin de chaque période (mois ou année), au prix en vigueur pour vous. Une facture est disponible pour chaque paiement."] },
        { h: "Résiliation", p: ["Vous pouvez résilier à tout moment depuis Paramètres, bouton « Gérer ou résilier mon abonnement ». La résiliation prend effet à la fin de la période déjà payée ; aucun renouvellement n'est ensuite prélevé."] },
        { h: "Rétractation et garantie de remboursement", p: ["En souscrivant, vous demandez que le service commence immédiatement.", "Vous disposez d'un droit de rétractation de 14 jours à compter de la souscription (articles L221-18 et suivants du Code de la consommation). Geardown va au-delà : pendant 30 jours après votre premier paiement sur le site, il vous suffit d'écrire à " + SITE.contactEmail + " pour être remboursé intégralement, sans justification. Le remboursement est fait sur le moyen de paiement utilisé, sous 14 jours."] },
        { h: "Abonnements pris dans l'app", p: ["Un abonnement souscrit sur l'App Store ou Google Play est facturé, renouvelé et remboursé par Apple ou Google, selon leurs conditions. Il se gère et se résilie dans les réglages de votre compte Apple ou Google."] },
        { h: "Réclamations et médiation", p: [`Pour toute réclamation, écrivez à ${SITE.contactEmail}. Si aucune solution n'est trouvée, vous pouvez recourir gratuitement au médiateur de la consommation : ${c.mediator}.`] },
        { h: "Vos données", p: ["Vous restez propriétaire de vos données. Elles restent exportables après résiliation."] },
        { h: "Droit applicable", p: ["Droit français. À défaut d'accord amiable, les tribunaux compétents sont ceux du ressort du siège de l'éditeur, sous réserve des règles protectrices du consommateur."] },
      ],
    },
    cookies: {
      title: "Cookies",
      sections: [
        { h: "Cookies utilisés", p: ["Geardown n'utilise aucun cookie publicitaire ni de mesure d'audience tiers.", "Stockage strictement nécessaire : session de connexion, préférence de langue et de thème, base locale du carnet (IndexedDB) pour le fonctionnement hors ligne.", "Ces traceurs étant indispensables au service, ils ne nécessitent pas de consentement (article 82 de la loi Informatique et Libertés)."] },
        { h: "Mesure d'audience", p: ["Pour connaître le nombre de visiteurs du site par jour, Geardown ne dépose aucun cookie : un identifiant est calculé côté serveur à partir de la date, de l'adresse réseau et du navigateur, haché de façon irréversible avec une clé secrète. Il change chaque jour, ne permet pas de vous suivre d'un jour à l'autre et n'est jamais partagé. Seuls sont conservés, 13 mois au plus, cet identifiant, la page d'arrivée, le site d'où vous venez et le pays. Les navigateurs qui demandent à ne pas être suivis (Global Privacy Control, Do Not Track) ne sont pas comptés."] },
      ],
    },
  },
  en: {
    notice: {
      title: "Legal notice",
      sections: [
        { h: "Publisher", p: [`${c.legalNameEn}, ${c.address}. ${c.registration}.`, `Publication director: ${c.publisher}.`, `Contact: ${SITE.contactEmail}.`] },
        { h: "Hosting", p: [`Website and server functions: ${c.host}.`, `Logbook database and attachments: ${c.dataHostEn}.`] },
        { h: "Intellectual property", p: ["The Geardown name, logo, texts, interfaces and code belong to the publisher. Any reproduction without permission is prohibited."] },
        { h: "Aeronautical data", p: ["The aerodrome database comes from OurAirports (public domain). Aircraft type designators follow ICAO Doc 8643. The airline list comes from OpenFlights (openflights.org), under the Open Database License (ODbL)."] },
      ],
    },
    privacy: {
      title: "Privacy policy (GDPR)",
      sections: [
        { h: "Controller", p: [`${c.legalNameEn}, ${c.address}. Contact: ${SITE.contactEmail}.`] },
        { h: "Data processed", p: ["Account data: e-mail address, name, sign-in method (e-mail, Apple, Google).", "Logbook data: flights, aircraft, licences and ratings, medical certificate (class, dates, limitation codes), roster, layovers, signatures, attachments you add.", "Layover place recommendations: other members only see how many there are for a place (from 2 on), never who made them.", "Technical data: sign-in and sync logs required for service security."] },
        { h: "Purposes and legal bases", p: ["Provide the logbook and its sync (contract).", "Send the expiry alerts you enabled (contract).", "Bill subscriptions (legal obligation and contract).", "Secure the service (legitimate interest).", "Count the website's visitors per day, without cookies (legitimate interest; see the Cookies page).", "Read, at your request, a licence or a medical certificate to fill in your documents (your consent; for health data, your explicit consent, GDPR article 9(2)(a))."] },
        {
          h: "Health data",
          p: [
            "From your medical certificate, Geardown only stores its class, its dates, the AeMC or aero-medical examiner and, if you enter them, its limitation codes (VDL, VML…). Do not upload detailed medical documents: if you do, they are stored privately and accessible to you only.",
            "Reading a document (Max plan): if you choose \"Read a document\", the photo or PDF of your licence or medical certificate is sent to Anthropic, which reads it for Geardown. This only happens with your explicit consent, given by ticking a box before sending. Geardown keeps neither the photo nor the PDF, nor any other data it contains (address, date of birth, other health information): only the entries you check and then save.",
            "Anthropic does not use this content to train its models and deletes it within 30 days, unless it must keep it longer to enforce its usage policy or to comply with the law.",
            "You can withdraw your consent at any time by unticking the box: no document is sent any more. Withdrawal does not affect readings already made. Saved entries can be edited and deleted from the Documents page.",
          ],
        },
        {
          h: "Recipients and processors",
          p: [
            "Database and attachments: Supabase, servers in London (United Kingdom).",
            "Website and server functions: Vercel (United States).",
            "Payment: Stripe (web subscriptions); Apple and RevenueCat (in-app subscriptions on iPhone).",
            "E-mail (sign-in, expiry alerts, trial reminders): Resend (United States).",
            "Automatic reading of documents you import (logbook photos, PDF statements, licence, medical certificate) and cover letters written at your request: Anthropic (United States), as a processor. This content is not used to train its models and is deleted by Anthropic within 30 days (except to enforce its usage policy or to comply with the law).",
            "Filling a flight from ADS-B: only the registration and date are sent to FlightAware.",
            "No data is sold or used for advertising.",
          ],
        },
        { h: "Transfers outside the European Union", p: ["The United Kingdom benefits from a European Commission adequacy decision. Transfers to the United States rely on the safeguards provided by the GDPR (Data Privacy Framework or the European Commission's standard contractual clauses). For Anthropic, these are the standard contractual clauses included in its data processing addendum."] },
        { h: "Retention", p: ["Data is kept while your account is active and deleted within 30 days of account deletion, except legal obligations (invoices: 10 years).", "So that the free trial is given only once per person, we keep an irreversible encrypted fingerprint of the e-mail address (not the address itself) with the date the trial started, including after the account is deleted, for at most 3 years. Legal basis: our legitimate interest in preventing abuse of the trial offer."] },
        { h: "Your rights", p: ["Access, rectification, erasure, restriction, objection and portability. From Settings › My data you can download all your data (JSON) and delete your account. You can also contact us and lodge a complaint with your supervisory authority."] },
        { h: "Security", p: ["Encryption in transit (TLS), per-account data isolation (Row Level Security), private document storage, automatic backups."] },
      ],
    },
    terms: {
      title: "Terms of use and sale",
      sections: [
        { h: "Purpose", p: ["These terms govern the use of the Geardown website and apps, an electronic logbook for pilots."] },
        { h: "Account", p: ["You are responsible for keeping your sign-in credentials confidential and for the accuracy of the data you enter."] },
        { h: "Pilot responsibility", p: ["Geardown is an aid. Calculations (night time, recent experience, FTL, expiries) are indicative. The pilot remains solely responsible for keeping their logbook and complying with regulations (Part-FCL, ORO.FTL, operations manual)."] },
        { h: "Plans and prices", p: [`Basic: ${eur(P.basic.monthly, "en")} per month or ${eur(P.basic.yearly, "en")} per year. Max: ${eur(P.premium.monthly, "en")} per month or ${eur(P.premium.yearly, "en")} per year. Prices include VAT, in euros, for new subscribers. What each plan includes is described on the Pricing page.`, "A price change never applies to a period already paid. It is announced at least 30 days before your next renewal, and you can cancel before then. The first subscribers with the founder price keep it as long as they stay subscribed without interruption."] },
        { h: "Free trial", p: [`Every new account gets a ${P.trialDays}-day trial, with no card. Nothing is charged when it ends: to keep logging flights, you choose a plan. Without a subscription, your data stays viewable and exportable.`] },
        { h: "Subscribing and paying on the website", p: ["Payment is processed by Stripe. The subscription starts when the payment is confirmed and renews automatically at the end of each period (month or year), at the price that applies to you. An invoice is available for every payment."] },
        { h: "Cancellation", p: ["You can cancel anytime from Settings, with the « Manage or cancel my subscription » button. Cancellation takes effect at the end of the period already paid; no further renewal is charged."] },
        { h: "Withdrawal and money-back guarantee", p: ["By subscribing, you ask for the service to start immediately.", "You have a 14-day right of withdrawal from the subscription date (French Consumer Code, articles L221-18 ff.). Geardown goes further: for 30 days after your first payment on the website, just write to " + SITE.contactEmail + " for a full refund, no questions asked. The refund is made to the payment method used, within 14 days."] },
        { h: "In-app subscriptions", p: ["A subscription taken on the App Store or Google Play is billed, renewed and refunded by Apple or Google under their terms. It is managed and cancelled in your Apple or Google account settings."] },
        { h: "Complaints and mediation", p: [`For any complaint, write to ${SITE.contactEmail}. If no solution is found, you can refer the matter free of charge to the consumer mediator: ${c.mediator}.`] },
        { h: "Your data", p: ["You own your data. It remains exportable after cancellation."] },
        { h: "Governing law", p: ["French law, subject to mandatory consumer protection rules of your country of residence."] },
      ],
    },
    cookies: {
      title: "Cookies",
      sections: [
        { h: "Cookies in use", p: ["Geardown uses no advertising or third-party analytics cookies.", "Strictly necessary storage only: sign-in session, language and theme preference, the local logbook database (IndexedDB) for offline use.", "As they are essential to the service, they do not require consent."] },
        { h: "Audience measurement", p: ["To know how many people visit the website each day, Geardown sets no cookie: an identifier is computed on the server from the date, the network address and the browser, hashed irreversibly with a secret key. It changes every day, cannot follow you from one day to the next and is never shared. Only this identifier, the landing page, the site you came from and the country are kept, for 13 months at most. Browsers asking not to be tracked (Global Privacy Control, Do Not Track) are not counted."] },
      ],
    },
  },
};
