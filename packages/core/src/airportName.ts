/**
 * The name pilots say for an airport: "Paris – Charles de Gaulle", "Madrid – Barajas", "London – Heathrow",
 * "Nice – Côte d'Azur", "Milan – Malpensa", from its official name and its city.
 */

const NOISE = /\b(international|intl\.?|regional|municipal)?\s*(airport|airfield|aerodrome|aeroport|aéroport|aeropuerto|aeroporto|flughafen|flugplatz|lufthavn|air base|airstrip)\b/gi;
const GENERIC = /^(city|main|international|regional|airport)$/i;

/** The city as people name it: "Paris (Roissy-en-France, Val-d'Oise)" → "Paris", "Toulouse/Blagnac" → "Toulouse". */
export const cityOf = (city?: string | null) => (city ?? "").split(/[(,/]/)[0]!.trim();

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * @param isCity tells whether a word is a city name (e.g. "Milan" for Malpensa, whose city in the data is Ferno);
 *               without it, only the airport's own city is known.
 */
export function airportShortName(a: { name: string; city?: string | null }, isCity: (word: string) => boolean = () => false): string {
  const city = cityOf(a.city);
  let name = a.name.replace(NOISE, " ").replace(/["“”]/g, "").replace(/\s{2,}/g, " ").trim();
  if (!name) return city || a.name;
  const n = fold(name);
  const c = fold(city);
  // the city inside the name ("Adolfo Suárez Madrid–Barajas", "Paris-Le Bourget", "London Heathrow")
  const at = c ? n.indexOf(c) : -1;
  if (at >= 0) {
    const from = name.slice(at);
    const rest = from.slice(city.length).replace(/^[\s\-–—]+/, "");
    if (!rest) return city;
    // "Toussus-le-Noble" is one name; "Frankfurt Main", "Cambridge City" read better whole
    if (!/^[A-ZÀ-Ý]/.test(rest)) return from;
    if (GENERIC.test(rest)) return from;
    return `${city} – ${rest}`;
  }
  // the name starts with another city ("Milan Malpensa", "Lyon Saint-Exupéry", "Athens Eleftherios Venizelos")
  const first = /^([A-ZÀ-Ý][\p{L}.']+)[\s\-–—]+(.+)$/u.exec(name);
  if (first && isCity(first[1]!) && !GENERIC.test(first[2]!)) return `${first[1]} – ${first[2]}`;
  if (first && isCity(first[1]!)) return name;
  // a name without its city ("Charles de Gaulle", "John F. Kennedy")
  return city && fold(city) !== n ? `${city} – ${name}` : name;
}
