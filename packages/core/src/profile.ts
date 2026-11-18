const cap = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1).toLocaleLowerCase();

/**
 * The pilot's first name for a greeting: the display name, else the first word of the full name, else the name
 * of the sign-in account, else the e-mail's local part when it reads as "first.last" ("cyrille.boctor" → Cyrille).
 */
export function pilotFirstName(p: { displayName?: string | null; fullName?: string | null; email?: string | null } | undefined, accountName?: string | null): string | undefined {
  const word = (s?: string | null) => s?.trim().split(/\s+/)[0] || undefined;
  const fromName = word(p?.displayName) ?? word(p?.fullName) ?? word(accountName);
  if (fromName) return fromName;
  const local = p?.email?.split("@")[0] ?? "";
  const m = /^([a-zà-ÿ]{2,})[._-][a-zà-ÿ]{2,}/i.exec(local);
  return m ? cap(m[1]!) : undefined;
}
