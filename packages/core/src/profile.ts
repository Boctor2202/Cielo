/** The pilot's first name for a greeting, from the profile only: the display name, else the full name's first word. */
export function pilotFirstName(p: { displayName?: string | null; fullName?: string | null } | undefined): string | undefined {
  const word = (s?: string | null) => s?.trim().split(/\s+/)[0] || undefined;
  return word(p?.displayName) ?? word(p?.fullName);
}
