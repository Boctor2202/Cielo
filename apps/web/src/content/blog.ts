export interface Post {
  slug: string;
  date: string;
  readingMin: number;
  fr: { title: string; excerpt: string; body: string[] };
  en: { title: string; excerpt: string; body: string[] };
}

/** Blog posts. Paragraphs starting with "## " are rendered as headings. */
export const POSTS: Post[] = [
  {
    slug: "temps-de-nuit-easa",
    date: "2026-10-28",
    readingMin: 4,
    fr: {
      title: "Comment se calcule le temps de nuit selon l'EASA",
      excerpt: "Crépuscule civil, position de l'avion, taxi : ce qu'il faut savoir pour logger un temps de nuit exact.",
      body: [
        "Pour l'EASA, la nuit est la période comprise entre la fin du crépuscule civil du soir et le début du crépuscule civil du matin. Le crépuscule civil se termine lorsque le centre du soleil passe 6° sous l'horizon.",
        "## Pourquoi ce n'est pas si simple",
        "L'heure de fin du crépuscule dépend du lieu et de la date. Sur un vol vers l'est en fin de journée, la nuit arrive plus vite que sur l'aérodrome de départ ; vers l'ouest, elle recule. Il faut donc connaître la position de l'avion à chaque instant.",
        "## La méthode de Strato",
        "Strato prend les heures d'off-block, de décollage, d'atterrissage et d'on-block. Avant le décollage, l'avion est sur l'aérodrome de départ ; après l'atterrissage, sur celui d'arrivée. Entre les deux, il suit l'orthodromie à vitesse constante. Pour chaque minute, Strato calcule la hauteur du soleil à la position estimée et compte la minute comme nuit si elle est inférieure à −6°.",
        "Le résultat est logué dans la colonne « Night » du carnet EASA. Les décollages et atterrissages sont également classés jour ou nuit selon la hauteur du soleil à l'instant et au lieu exacts.",
        "## Et si mon vol n'a pas suivi l'orthodromie ?",
        "L'écart est en général de quelques minutes au plus. Vous pouvez toujours saisir le temps de nuit manuellement : la valeur saisie remplace le calcul automatique.",
      ],
    },
    en: {
      title: "How EASA night time is calculated",
      excerpt: "Civil twilight, aircraft position, taxi time: what you need to know to log accurate night time.",
      body: [
        "Under EASA rules, night is the period between the end of evening civil twilight and the beginning of morning civil twilight. Civil twilight ends when the centre of the sun's disc is 6° below the horizon.",
        "## Why it isn't that simple",
        "The end of twilight depends on place and date. Flying east late in the day, night comes sooner than at the departure aerodrome; flying west, it recedes. You need the aircraft position at every moment.",
        "## Strato's method",
        "Strato takes the off-block, takeoff, landing and on-block times. Before takeoff the aircraft is at the departure aerodrome; after landing, at the arrival aerodrome. In between it follows the great circle at constant speed. For every minute, Strato computes the sun elevation at the estimated position and counts the minute as night when it is below −6°.",
        "The result goes in the “Night” column of the EASA logbook. Takeoffs and landings are classified day or night from the sun elevation at the exact time and place.",
        "## What if my flight didn't follow the great circle?",
        "The difference is usually a few minutes at most. You can always enter night time manually: your value replaces the automatic calculation.",
      ],
    },
  },
  {
    slug: "experience-recente-fcl-060",
    date: "2026-10-14",
    readingMin: 3,
    fr: {
      title: "Expérience récente : la règle des 3 atterrissages en 90 jours",
      excerpt: "Ce que dit FCL.060 pour transporter des passagers, de jour comme de nuit, et comment Strato la suit pour vous.",
      body: [
        "Pour être commandant de bord ou copilote d'un aéronef transportant des passagers, FCL.060 exige d'avoir effectué au moins 3 décollages, approches et atterrissages dans les 90 jours précédents, comme pilote aux commandes, sur un aéronef du même type ou de la même classe, ou sur un FSTD représentatif.",
        "## De nuit",
        "Pour transporter des passagers de nuit, au moins un de ces trois décollages et atterrissages doit avoir été effectué de nuit, sauf si vous êtes titulaire d'une qualification de vol aux instruments.",
        "## Ce que fait Strato",
        "Le tableau de bord compte vos décollages et atterrissages des 90 derniers jours, à partir de votre carnet. Il indique la date jusqu'à laquelle votre expérience reste valide si vous ne volez plus, et vous alerte dès qu'elle est perdue.",
        "Les exploitants commerciaux appliquent souvent des exigences propres (ORO.FC). Vérifiez toujours le manuel d'exploitation de votre compagnie.",
      ],
    },
    en: {
      title: "Recent experience: the 3 landings in 90 days rule",
      excerpt: "What FCL.060 requires to carry passengers, by day and at night, and how Strato tracks it for you.",
      body: [
        "To act as PIC or co-pilot of an aircraft carrying passengers, FCL.060 requires at least 3 takeoffs, approaches and landings in the preceding 90 days as pilot flying, in an aircraft of the same type or class, or in a representative FSTD.",
        "## At night",
        "To carry passengers at night, at least one of those three takeoffs and landings must have been at night, unless you hold an instrument rating.",
        "## What Strato does",
        "The dashboard counts your takeoffs and landings over the last 90 days from your logbook. It shows the date until which your experience stays valid if you stop flying, and warns you as soon as it lapses.",
        "Commercial operators often apply their own requirements (ORO.FC). Always check your company operations manual.",
      ],
    },
  },
];
