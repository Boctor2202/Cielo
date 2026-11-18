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
