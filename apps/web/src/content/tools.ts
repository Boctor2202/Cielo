/**
 * Free public tools (no account): the copy of each page, in both languages. The calculations are the app's own
 * (packages/core), so a tool and the logbook always give the same answer.
 */
type Faq = { q: string; a: string }[];
interface ToolCopy {
  metaTitle: string;
  description: string;
  title: string;
  intro: string;
  faq: Faq;
}

export const TOOLS_INDEX = {
  fr: { metaTitle: "Outils gratuits pour pilotes", description: "Calculateur d'heures de nuit et calculateur de FDP maximal EASA, gratuits et sans compte.", title: "Outils gratuits pour pilotes", intro: "Les calculs de Geardown, ouverts à tous, sans compte." },
  en: { metaTitle: "Free tools for pilots", description: "Night time calculator and EASA maximum FDP calculator, free and without an account.", title: "Free tools for pilots", intro: "Geardown's own calculations, open to everyone, no account needed." },
};

export const NIGHT: Record<"fr" | "en", ToolCopy> = {
  fr: {
    metaTitle: "Calculateur d'heures de nuit pour le carnet de vol",
    description: "Calculez le temps de nuit d'un vol à inscrire au carnet (crépuscule civil, soleil 6° sous l'horizon) à partir des aéroports et des heures bloc. Gratuit, sans compte.",
    title: "Calculateur d'heures de nuit",
    intro: "Indiquez les aéroports et les heures en UTC : le calculateur suit l'avion le long de la route, minute par minute, et compte le temps passé de nuit.",
    faq: [
      { q: "Quand commence la nuit pour le carnet de vol ?", a: "Pour l'EASA, la nuit va de la fin du crépuscule civil du soir au début du crépuscule civil du matin, c'est-à-dire quand le centre du soleil est à plus de 6° sous l'horizon. Le coucher du soleil est donc trop tôt." },
      { q: "Comment le temps de nuit est-il calculé en vol ?", a: "L'avion est à l'aéroport de départ jusqu'au décollage, puis il suit l'orthodromie à vitesse constante, puis il est à l'aéroport d'arrivée après l'atterrissage. La hauteur du soleil est calculée à chaque minute à sa position." },
      { q: "Et pour la FAA ?", a: "Pour l'inscription au carnet, la FAA définit aussi la nuit à partir du crépuscule civil (14 CFR 1.1). Attention : l'expérience récente de nuit (61.57(b)) compte les décollages et atterrissages entre une heure après le coucher et une heure avant le lever du soleil." },
    ],
  },
  en: {
    metaTitle: "Night time calculator for your pilot logbook",
    description: "Work out the night time of a flight for your logbook (civil twilight, sun 6° below the horizon) from the airports and block times. Free, no account.",
    title: "Night time calculator",
    intro: "Enter the airports and the times in UTC: the calculator follows the aircraft along the route, minute by minute, and counts the time flown at night.",
    faq: [
      { q: "When does night start for the logbook?", a: "Under EASA, night runs from the end of evening civil twilight to the beginning of morning civil twilight, when the centre of the sun is more than 6° below the horizon. Sunset is too early." },
      { q: "How is night time worked out in flight?", a: "The aircraft is at the departure airport until takeoff, then follows the great circle at a constant speed, then is at the arrival airport after landing. The sun's elevation is computed every minute at its position." },
      { q: "What about the FAA?", a: "For logging, the FAA also defines night from civil twilight (14 CFR 1.1). Note that night recency (61.57(b)) counts takeoffs and landings between one hour after sunset and one hour before sunrise." },
    ],
  },
};

export const FDP: Record<"fr" | "en", ToolCopy> = {
  fr: {
    metaTitle: "Calculateur de FDP maximal EASA (ORO.FTL.205)",
    description: "Temps de service de vol (FDP) maximal selon l'heure de présentation et le nombre d'étapes : tableau EASA ORO.FTL.205 et EU-OPS Subpart Q. Gratuit, sans compte.",
    title: "Calculateur de FDP maximal",
    intro: "Heure de présentation et nombre d'étapes : le calculateur donne le temps de service de vol de base maximal, et l'heure de fin de FDP au plus tard.",
    faq: [
      { q: "Quelle est la FDP maximale EASA ?", a: "Pour un membre d'équipage acclimaté, le tableau 2 de ORO.FTL.205 donne 13 h pour 1 ou 2 étapes avec une présentation entre 06:00 et 13:29, moins 30 minutes par étape à partir de la troisième, avec un minimum de 9 h. Les présentations en fin de journée et la nuit donnent moins." },
      { q: "Quelle heure utiliser ?", a: "L'heure de référence : l'heure locale de l'endroit où l'équipage est acclimaté, au moment de la présentation." },
      { q: "Les extensions sont-elles comprises ?", a: "Non. L'exploitant peut prolonger la FDP d'une heure au plus, deux fois au plus sur 7 jours consécutifs (ORO.FTL.205(d)), et le service fractionné ou le repos en vol peuvent aussi l'allonger. Le schéma FTL approuvé de votre exploitant prévaut toujours." },
    ],
  },
  en: {
    metaTitle: "EASA maximum FDP calculator (ORO.FTL.205)",
    description: "Maximum flight duty period from the reporting time and the number of sectors: EASA ORO.FTL.205 table and EU-OPS Subpart Q. Free, no account.",
    title: "Maximum FDP calculator",
    intro: "Reporting time and number of sectors: the calculator gives the maximum basic daily flight duty period, and the latest end of the FDP.",
    faq: [
      { q: "What is the EASA maximum FDP?", a: "For an acclimatised crew member, table 2 of ORO.FTL.205 gives 13 hours for 1 or 2 sectors when reporting between 06:00 and 13:29, less 30 minutes per sector from the third, down to 9 hours. Late and night reports give less." },
      { q: "Which time should I use?", a: "The reference time: the local time where the crew is acclimatised, at the reporting time." },
      { q: "Are extensions included?", a: "No. The operator may extend the FDP by up to one hour, at most twice in 7 consecutive days (ORO.FTL.205(d)), and split duty or in-flight rest can extend it too. Your operator's approved FTL scheme always prevails." },
    ],
  },
};

const EASA_FCL = "https://www.easa.europa.eu/en/document-library/easy-access-rules/online-publications/easy-access-rules-aircrew?erules-id=ERULES-1963177438-10445";

export const RECENCY: Record<"fr" | "en", ToolCopy> = {
  fr: {
    metaTitle: "Calculateur d'expérience récente FCL.060 (3 atterrissages en 90 jours)",
    description: "Jusqu'à quand pouvez-vous transporter des passagers ? Saisissez vos derniers décollages et atterrissages : date de fin de l'expérience récente EASA FCL.060(b), de jour et de nuit. Gratuit, sans compte.",
    title: "Calculateur d'expérience récente",
    intro: "Saisissez vos derniers vols avec leurs décollages et atterrissages : le calculateur indique jusqu'à quand votre expérience récente EASA reste valide, de jour et de nuit.",
    faq: [
      { q: "Que demande FCL.060(b) ?", a: "Pour exploiter un aéronef en transport aérien commercial ou transporter des passagers, comme commandant de bord ou copilote : au moins 3 décollages, approches et atterrissages comme pilote aux commandes (« pilot flying ») dans les 90 jours précédents, sur un aéronef du même type ou de la même classe, ou sur un FFS représentant ce type ou cette classe (FCL.060(b)(1), texte en vigueur dans les Easy Access Rules de l'EASA)." },
      { q: "Et de nuit ?", a: "Comme commandant de bord de nuit : au moins 1 décollage, 1 approche et 1 atterrissage de nuit comme pilote aux commandes dans les 90 jours précédents, sur le même type ou la même classe ou un FFS, sauf si vous êtes titulaire d'une IR (FCL.060(b)(2))." },
      { q: "Et pour la FAA ?", a: "14 CFR 61.57(a) : pour être commandant de bord d'un aéronef transportant des personnes, au moins 3 décollages et 3 atterrissages dans les 90 jours précédents, comme seul manipulateur des commandes, sur un aéronef de la même catégorie, classe et type (si une qualification est requise) ; avec arrêt complet sur un train classique. De nuit (61.57(b)) : 3 décollages et 3 atterrissages avec arrêt complet entre une heure après le coucher et une heure avant le lever du soleil." },
      { q: "Comment la date de fin est-elle calculée ?", a: "On remonte vos vols du plus récent au plus ancien jusqu'au 3e décollage et au 3e atterrissage (1 de nuit pour la règle de nuit) : l'expérience reste valide tant que ce vol est dans les 90 jours précédents. Votre exploitant peut appliquer des exigences supplémentaires : son manuel d'exploitation prévaut." },
    ],
  },
  en: {
    metaTitle: "FCL.060 recency calculator (3 landings in 90 days)",
    description: "Until when may you carry passengers? Enter your last takeoffs and landings: end date of your EASA FCL.060(b) recent experience, by day and at night. Free, no account.",
    title: "Recency calculator",
    intro: "Enter your last flights with their takeoffs and landings: the calculator shows until when your EASA recent experience stays valid, by day and at night.",
    faq: [
      { q: "What does FCL.060(b) require?", a: "To operate an aircraft in commercial air transport or to carry passengers, as PIC or co-pilot: at least 3 takeoffs, approaches and landings as pilot flying in the preceding 90 days, in an aircraft of the same type or class or an FFS representing that type or class (FCL.060(b)(1), current text in EASA's Easy Access Rules)." },
      { q: "And at night?", a: "As PIC at night: at least 1 takeoff, approach and landing at night as pilot flying in the preceding 90 days, in the same type or class or an FFS, unless you hold an IR (FCL.060(b)(2))." },
      { q: "What about the FAA?", a: "14 CFR 61.57(a): to act as PIC of an aircraft carrying persons, at least 3 takeoffs and 3 landings in the preceding 90 days as sole manipulator of the flight controls, in an aircraft of the same category, class and type (if a class or type rating is required); to a full stop in a tailwheel airplane. At night (61.57(b)): 3 takeoffs and 3 landings to a full stop between 1 hour after sunset and 1 hour before sunrise." },
      { q: "How is the end date worked out?", a: "Your flights are walked back from the latest until the 3rd takeoff and the 3rd landing (1 at night for the night rule): the experience stays valid while that flight is within the preceding 90 days. Your operator may apply further requirements: its operations manual prevails." },
    ],
  },
};
export const RECENCY_SOURCES = [
  { label: "EASA Easy Access Rules for Aircrew, FCL.060", url: EASA_FCL },
  { label: "14 CFR 61.57 (eCFR)", url: "https://www.ecfr.gov/current/title-14/chapter-I/subchapter-D/part-61/subpart-A/section-61.57" },
];
