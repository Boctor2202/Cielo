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
