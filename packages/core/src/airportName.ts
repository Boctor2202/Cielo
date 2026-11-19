/**
 * The name pilots say for an airport: "Paris – Charles de Gaulle", "Madrid – Barajas", "London – Heathrow",
 * "Nice – Côte d'Azur", "Melun – Villaroche", from its official name and its town.
 */

const NOISE = /\b(international|intl\.?|regional|municipal)?\s*(airport|airfield|aerodrome|aeroport|aéroport|aeropuerto|aeroporto|flughafen|flugplatz|lufthavn|air base|airstrip)\b/gi;
const LEADING = /^(a[ée]rodrome|a[ée]roport)\s+(de|d'|du|des)\s*/i;
const GENERIC = /^(city|main|international|regional|airport)$/i;
/** first words that belong to the place name ("Saint-Yan", "Le Castellet") */
const ARTICLE = /^(saint|sainte|st|ste|le|la|les|l'|el|los|las|san|santa|sao|são|bad|new|port|fort|mont)$/i;

/** The town as people name it: "Paris (Roissy-en-France, Val-d'Oise)" → "Paris", "Toulouse/Blagnac" → "Toulouse". */
export const cityOf = (city?: string | null) => (city ?? "").split(/[(,/]/)[0]!.trim();

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** "Melun-Villaroche" → "Melun – Villaroche" (not "Saint-Yan", one place). */
function splitPlaces(name: string): string {
  const m = /^([A-ZÀ-Ý][\p{L}']+)[-–—]\s*([A-ZÀ-Ý].*)$/u.exec(name);
  return m && !ARTICLE.test(m[1]!) ? `${m[1]} – ${m[2]}` : name;
}

/**
 * @param isCity how many airports a town names (Paris, London, Lyon…): a town of two or more leads the name
 *               ("Lyon – Bron"); one of three or more is added in front of a name without it ("Paris – Charles de Gaulle").
 */
export function airportShortName(a: { name: string; city?: string | null }, isCity: (word: string) => number | boolean = () => 0): string {
  const city = cityOf(a.city);
  const name = a.name.replace(LEADING, "").replace(NOISE, " ").replace(/["“”]/g, "").replace(/\s{2,}/g, " ").trim();
  if (!name) return city || a.name;
  const n = fold(name);
  const c = fold(city);
  // the town inside the name
  const at = c ? n.indexOf(c) : -1;
  if (at >= 0) {
    // joined to another place ("Valence-Chabeuil"): the whole name
    if (at > 0 && /[-–—]$/.test(name.slice(0, at))) return splitPlaces(name);
    // after a person's name ("Adolfo Suárez Madrid–Barajas") or at the start ("Paris-Le Bourget", "London Heathrow")
    const from = name.slice(at);
    const rest = from.slice(city.length).replace(/^[\s\-–—]+/, "");
    if (!rest) return city;
    if (!/^[A-ZÀ-Ý]/.test(rest) || GENERIC.test(rest)) return from;
    return `${city} – ${rest}`;
  }
  // the name starts with a known town ("Milan Malpensa", "Lyon Saint-Exupéry")
  const first = /^([A-ZÀ-Ý][\p{L}.']+)\s+(.+)$/u.exec(name);
  if (first && Number(isCity(first[1]!)) >= 2) return GENERIC.test(first[2]!) ? name : `${first[1]} – ${first[2]}`;
  // places joined ("Melun-Villaroche", "Pontoise-Cormeilles")
  const split = splitPlaces(name);
  if (split !== name) return split;
  // a name without its town ("Charles de Gaulle", "John F. Kennedy"), when the town has several airports and the
  // name does not already start with it ("Frankfurt Main" for Frankfurt am Main)
  const firstWord = fold(city).split(/[\s-]+/)[0] ?? "";
  if (/\s/.test(name) && city && Number(isCity(city)) >= 3 && !n.startsWith(firstWord)) return `${city} – ${name}`;
  return name;
}
