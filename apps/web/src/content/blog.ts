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
    slug: "easa-logbook-fcl-050",
    date: "2026-11-20",
    readingMin: 5,
    fr: {
      title: "Carnet de vol EASA : ce que demande FCL.050, colonne par colonne",
      excerpt: "Ce que la réglementation européenne attend d'un carnet de vol, ce que contient chaque colonne et si un carnet électronique est accepté.",
      body: [
        "Tout pilote titulaire d'une licence Part-FCL doit tenir un relevé fiable de ses vols. C'est l'exigence FCL.050 du règlement (UE) n° 1178/2011. Le texte lui-même est court : il laisse à l'autorité compétente le soin de fixer le format et la manière de tenir ce relevé. Le détail se trouve dans les moyens acceptables de conformité, l'AMC1 FCL.050, qui décrit les informations à enregistrer et propose un modèle de carnet.",
        "## Les informations à enregistrer pour chaque vol",
        "Le modèle de l'AMC1 FCL.050 s'organise en colonnes. Pour chaque vol, on retrouve : la date ; le lieu et l'heure de départ et d'arrivée ; le type et l'immatriculation de l'aéronef ; le temps en monopilote (monomoteur ou multimoteur) ou en multi-pilote ; le temps total de vol ; le nom du commandant de bord ; le nombre d'atterrissages de jour et de nuit ; le temps dans des conditions particulières (nuit, IFR) ; le temps par fonction (commandant de bord, copilote, double commande, instructeur) ; et une colonne de remarques.",
        "Les séances en simulateur (FSTD) sont notées à part, avec leur date, le type de simulateur et la durée de la séance. Elles ne s'ajoutent pas au temps de vol total.",
        "## Les points qui posent le plus de questions",
        "Le temps de nuit : il commence à la fin du crépuscule civil du soir et se termine au début du crépuscule civil du matin. Il varie donc avec le lieu et la date, y compris pendant le vol. Nous l'expliquons en détail dans l'article sur le temps de nuit EASA.",
        "Le PIC sous supervision (PICUS) : dans le format EASA, il est porté dans la colonne commandant de bord, le commandant de bord signant pour attester. Beaucoup de pilotes le suivent aussi à part, car les compagnies distinguent souvent PIC et PICUS dans leurs exigences.",
        "Le monopilote ou multi-pilote : il dépend de l'aéronef et de son mode d'exploitation, pas seulement du nombre de pilotes à bord.",
        "## Un carnet électronique est-il accepté ?",
        "FCL.050 n'impose pas le papier : il demande un relevé fiable, dans le format fixé par l'autorité compétente. En pratique, de nombreux pilotes tiennent un carnet électronique et l'impriment ou l'exportent en PDF lorsqu'on le leur demande, par exemple lors d'un contrôle ou d'un recrutement. Les règles et les usages peuvent varier selon l'autorité et l'exploitant : en cas de doute, renseignez-vous auprès de votre autorité ou de votre compagnie.",
        "Conservez aussi votre carnet papier existant : il porte des signatures, tampons et mentions qu'un fichier ne remplace pas.",
        "## Ce que fait Geardown",
        "Geardown remplit les colonnes du format AMC1 FCL.050 à partir de chaque vol saisi : temps de nuit calculé, monopilote ou multi-pilote déduit de l'aéronef, totaux par page et reports. L'export PDF reprend les colonnes du format EASA, avec les totaux de page, le total des pages précédentes et le total général. Geardown est un outil d'aide : le pilote reste responsable de l'exactitude de son carnet.",
      ],
    },
    en: {
      title: "The EASA pilot logbook: what FCL.050 asks for, column by column",
      excerpt: "What European rules expect from a pilot logbook, what goes in each column, and whether an electronic logbook is accepted.",
      body: [
        "Every pilot holding a Part-FCL licence must keep a reliable record of their flights. That is requirement FCL.050 of Regulation (EU) No 1178/2011. The rule itself is short: it leaves the format and manner of that record to the competent authority. The detail is in the acceptable means of compliance, AMC1 FCL.050, which lists the information to record and offers a model logbook.",
        "## What to record for each flight",
        "The AMC1 FCL.050 model is laid out in columns. For each flight you record: the date; the place and time of departure and arrival; the aircraft type and registration; single-pilot time (single-engine or multi-engine) or multi-pilot time; total time of flight; the name of the pilot-in-command; the number of day and night landings; operational condition time (night, IFR); pilot function time (pilot-in-command, co-pilot, dual, instructor); and a remarks column.",
        "Simulator (FSTD) sessions are recorded separately, with their date, the type of device and the session time. They are not added to total flight time.",
        "## The points that raise the most questions",
        "Night time: it starts at the end of evening civil twilight and ends at the beginning of morning civil twilight. So it changes with place and date, including during the flight. We cover it in detail in our article on EASA night time.",
        "Pilot-in-command under supervision (PICUS): in the EASA format it goes in the pilot-in-command column, countersigned by the commander. Many pilots also track it separately, because airlines often tell PIC and PICUS apart in their requirements.",
        "Single-pilot or multi-pilot: it depends on the aircraft and how it is operated, not only on how many pilots are on board.",
        "## Is an electronic logbook accepted?",
        "FCL.050 does not require paper: it asks for a reliable record, in the format set by the competent authority. In practice many pilots keep an electronic logbook and print it or export it to PDF when asked, for a check or a job application. Rules and practice can vary between authorities and operators: if in doubt, ask your authority or your airline.",
        "Keep your existing paper logbook too: it carries signatures, stamps and endorsements that a file does not replace.",
        "## What Geardown does",
        "Geardown fills the AMC1 FCL.050 columns from each flight you log: night time worked out, single-pilot or multi-pilot derived from the aircraft, page totals and carry-forward. The PDF export follows the EASA format columns, with page totals, the total from previous pages and the grand total. Geardown is an aid: the pilot remains responsible for the accuracy of their logbook.",
      ],
    },
  },
  {
    slug: "paper-to-electronic-logbook",
    date: "2026-11-20",
    readingMin: 4,
    fr: {
      title: "Passer du carnet papier au carnet électronique sans perdre ses totaux",
      excerpt: "Reports de totaux, import d'un fichier ou des pages photographiées : trois façons de basculer, et comment vérifier que rien ne manque.",
      body: [
        "Beaucoup de pilotes repoussent le passage au carnet électronique pour une raison simple : la peur de perdre des heures en route. Des années de vols, plusieurs compagnies, parfois plusieurs carnets. Voici comment basculer proprement.",
        "## Option 1 : reporter vos totaux",
        "C'est la méthode la plus rapide. Vous reprenez les totaux de la dernière page de votre carnet papier (temps total, PIC, copilote, nuit, IFR, atterrissages…) et vous les saisissez comme report. Vos nouveaux vols s'ajoutent ensuite à ces totaux, et l'export les présente comme « total des pages précédentes ». Vous perdez le détail vol par vol, mais vos totaux sont justes dès le premier jour.",
        "## Option 2 : importer un fichier",
        "Si vous tenez déjà un tableau Excel, ou si vous utilisez une autre application de carnet de vol, exportez vos vols en CSV ou en Excel et importez le fichier. Les colonnes sont reconnues automatiquement ; vous pouvez corriger leur correspondance avant d'importer. Certaines compagnies fournissent aussi des relevés de vols en PDF, qui peuvent être lus de la même façon.",
        "## Option 3 : photographier vos pages",
        "Pour un carnet uniquement papier, vous pouvez photographier les pages : les vols sont lus et vous sont présentés pour vérification avant tout enregistrement. Cette lecture automatique ne remplace pas votre relecture, surtout sur une écriture manuscrite.",
        "## L'étape qui compte : vérifier les totaux",
        "Quelle que soit la méthode, comparez les totaux avant d'enregistrer : ce que dit votre carnet ou votre fichier d'un côté, ce que le carnet électronique va enregistrer de l'autre. Un écart de quelques minutes vient souvent d'un arrondi décimal ; un écart plus grand révèle une colonne mal reconnue ou une erreur dans la source. Mieux vaut le voir avant qu'après.",
        "## Et le carnet papier ?",
        "Gardez-le. Il contient des signatures, des tampons et des mentions d'examinateur qui ont leur propre valeur. Le carnet électronique prend le relais pour les vols suivants et vous donne des totaux toujours à jour.",
        "## Avec Geardown",
        "Geardown propose les trois options : report de totaux papier, import CSV ou Excel avec reconnaissance des colonnes, lecture des relevés PDF de compagnie (offre Max pour la plupart des formats) et des pages photographiées (en bêta, offre Max). L'écran « Vérifiez vos totaux » compare votre source et ce que Geardown enregistrera, et rien n'est sauvegardé sans votre accord. Un import peut aussi être annulé en un geste.",
      ],
    },
    en: {
      title: "Moving from a paper to an electronic logbook without losing your totals",
      excerpt: "Carried-forward totals, importing a file or photographing your pages: three ways to switch, and how to check nothing is missing.",
      body: [
        "Many pilots put off moving to an electronic logbook for a simple reason: the fear of losing hours along the way. Years of flying, several airlines, sometimes several logbooks. Here is how to switch cleanly.",
        "## Option 1: carry your totals forward",
        "The quickest way. Take the totals from the last page of your paper logbook (total time, PIC, co-pilot, night, IFR, landings…) and enter them as a carry-forward. New flights are then added to these totals, and the export shows them as the total from previous pages. You lose the flight-by-flight detail, but your totals are right from day one.",
        "## Option 2: import a file",
        "If you already keep an Excel sheet, or use another logbook app, export your flights to CSV or Excel and import the file. Columns are detected automatically, and you can fix the mapping before importing. Some airlines also provide flight statements as PDFs, which can be read the same way.",
        "## Option 3: photograph your pages",
        "For a paper-only logbook, you can photograph the pages: the flights are read and shown to you for checking before anything is saved. Automatic reading does not replace your own review, especially on handwriting.",
        "## The step that matters: check the totals",
        "Whatever the method, compare the totals before saving: what your logbook or file says on one side, what the electronic logbook will record on the other. A difference of a few minutes usually comes from decimal rounding; a bigger one points to a misread column or an error in the source. Better to see it before than after.",
        "## What about the paper logbook?",
        "Keep it. It holds signatures, stamps and examiner endorsements that have their own value. The electronic logbook takes over for the next flights and gives you totals that are always up to date.",
        "## With Geardown",
        "Geardown offers all three: carry-forward of paper totals, CSV or Excel import with column detection, reading of airline PDF statements (Max plan for most formats) and of photographed pages (beta, Max plan). The “Check your totals” screen compares your source with what Geardown will record, and nothing is saved without your say-so. An import can also be undone in one tap.",
      ],
    },
  },
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
        "## La méthode de Geardown",
        "Geardown prend les heures d'off-block, de décollage, d'atterrissage et d'on-block. Avant le décollage, l'avion est sur l'aérodrome de départ ; après l'atterrissage, sur celui d'arrivée. Entre les deux, il suit l'orthodromie à vitesse constante. Pour chaque minute, Geardown calcule la hauteur du soleil à la position estimée et compte la minute comme nuit si elle est inférieure à −6°.",
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
        "## Geardown's method",
        "Geardown takes the off-block, takeoff, landing and on-block times. Before takeoff the aircraft is at the departure aerodrome; after landing, at the arrival aerodrome. In between it follows the great circle at constant speed. For every minute, Geardown computes the sun elevation at the estimated position and counts the minute as night when it is below −6°.",
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
      excerpt: "Ce que dit FCL.060 pour transporter des passagers, de jour comme de nuit, et comment Geardown la suit pour vous.",
      body: [
        "Pour être commandant de bord ou copilote d'un aéronef transportant des passagers, FCL.060 exige d'avoir effectué au moins 3 décollages, approches et atterrissages dans les 90 jours précédents, comme pilote aux commandes, sur un aéronef du même type ou de la même classe, ou sur un FSTD représentatif.",
        "## De nuit",
        "Pour transporter des passagers de nuit, au moins un de ces trois décollages et atterrissages doit avoir été effectué de nuit, sauf si vous êtes titulaire d'une qualification de vol aux instruments.",
        "## Ce que fait Geardown",
        "Le tableau de bord compte vos décollages et atterrissages des 90 derniers jours, à partir de votre carnet. Il indique la date jusqu'à laquelle votre expérience reste valide si vous ne volez plus, et vous alerte dès qu'elle est perdue.",
        "Les exploitants commerciaux appliquent souvent des exigences propres (ORO.FC). Vérifiez toujours le manuel d'exploitation de votre compagnie.",
      ],
    },
    en: {
      title: "Recent experience: the 3 landings in 90 days rule",
      excerpt: "What FCL.060 requires to carry passengers, by day and at night, and how Geardown tracks it for you.",
      body: [
        "To act as PIC or co-pilot of an aircraft carrying passengers, FCL.060 requires at least 3 takeoffs, approaches and landings in the preceding 90 days as pilot flying, in an aircraft of the same type or class, or in a representative FSTD.",
        "## At night",
        "To carry passengers at night, at least one of those three takeoffs and landings must have been at night, unless you hold an instrument rating.",
        "## What Geardown does",
        "The dashboard counts your takeoffs and landings over the last 90 days from your logbook. It shows the date until which your experience stays valid if you stop flying, and warns you as soon as it lapses.",
        "Commercial operators often apply their own requirements (ORO.FC). Always check your company operations manual.",
      ],
    },
  },
];
