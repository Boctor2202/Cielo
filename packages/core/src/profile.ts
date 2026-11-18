/** The pilot's first name for a greeting, from the profile only: the display name, else the full name's first word. */
export function pilotFirstName(p: { displayName?: string | null; fullName?: string | null } | undefined): string | undefined {
  const word = (s?: string | null) => s?.trim().split(/\s+/)[0] || undefined;
  return word(p?.displayName) ?? word(p?.fullName);
}

/** Part of the day for a greeting, in the device's local time: morning 05:00–11:59, afternoon 12:00–17:59, else evening. */
export function dayPart(d: Date = new Date()): "morning" | "afternoon" | "evening" {
  const h = d.getHours();
  return h >= 5 && h < 12 ? "morning" : h >= 12 && h < 18 ? "afternoon" : "evening";
}

/**
 * Stripes on the pilot's epaulette, from the rank as typed: 4 for a captain, 3 for a first officer, 2 for a
 * second officer or a student. Undefined when the rank does not say.
 */
export function rankStripes(rank?: string | null): 2 | 3 | 4 | undefined {
  const r = (rank ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!r.trim()) return undefined;
  if (/\b(captain|commander|commandant|cdb|cmdr|capt|pic)\b/.test(r) && !/first officer/.test(r)) return 4;
  if (/first officer|\bf\/?o\b|\bsfo\b|\bopl\b|officier pilote|copilot|co-pilot|copilote/.test(r)) return 3;
  if (/second officer|\bs\/?o\b|student|eleve|cadet|trainee/.test(r)) return 2;
  return undefined;
}
