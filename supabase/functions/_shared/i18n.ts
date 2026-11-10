// Tiny FR/EN message catalogue for server-sent notifications.
export type Locale = "fr" | "en";

export function licenseAlertText(locale: Locale, code: string, daysLeft: number, validUntil: string): { title: string; body: string } {
  if (locale === "en") {
    return daysLeft === 0
      ? { title: `${code} expires today`, body: `Your ${code} expires today (${validUntil}).` }
      : { title: `${code} expires in ${daysLeft} days`, body: `Your ${code} is valid until ${validUntil} (${daysLeft} days left).` };
  }
  return daysLeft === 0
    ? { title: `${code} expire aujourd'hui`, body: `Votre ${code} expire aujourd'hui (${validUntil}).` }
    : { title: `${code} expire dans ${daysLeft} jours`, body: `Votre ${code} est valide jusqu'au ${validUntil} (encore ${daysLeft} jours).` };
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
