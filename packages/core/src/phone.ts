import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";

/**
 * A phone number always written with its international dialling code, "+33 6 12 34 56 78": a national number
 * ("06 12 34 56 78") is read in the given country (the pilot's nationality, the airport's country…); a number
 * already starting with + or 00 keeps its own. Anything that cannot be read is returned as typed.
 */
export function formatPhoneIntl(raw: string | undefined | null, country?: string | null): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  const cc = country && /^[A-Za-z]{2}$/.test(country) ? (country.toUpperCase() as CountryCode) : undefined;
  const p = parsePhoneNumberFromString(s.replace(/^00/, "+"), cc);
  return p && p.isPossible() ? p.formatInternational() : s;
}
