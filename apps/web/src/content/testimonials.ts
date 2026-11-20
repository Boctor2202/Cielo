/**
 * Real testimonials only, each with the pilot's written consent kept on file (date and form of the consent).
 * The section stays hidden while this list is empty. Never invent or edit a quote beyond typos approved by the pilot.
 *
 * Example entry:
 *   { quote: { fr: "…", en: "…" }, name: "Prénom N.", role: { fr: "OPL A320", en: "A320 First Officer" },
 *     consent: { date: "2026-12-01", how: "e-mail" } }
 */
export interface Testimonial {
  quote: { fr: string; en?: string };
  /** as the pilot agreed to be named (first name and initial, or full name) */
  name: string;
  role?: { fr: string; en?: string };
  /** proof of the written consent, kept internally (not shown) */
  consent: { date: string; how: string };
}

export const TESTIMONIALS: Testimonial[] = [];
