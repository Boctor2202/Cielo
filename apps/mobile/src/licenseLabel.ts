import type { LicenseStatus } from "@cielo/core";
import type { TFunction } from "./i18n";

export function statusLabel(t: TFunction, s: LicenseStatus): string {
  if (s.state === "expiring") return t("docs.status.expiring", { n: s.daysLeft ?? 0 });
  if (s.state === "expired") return t("docs.status.expired", { n: Math.abs(s.daysLeft ?? 0) });
  return t(`docs.status.${s.state}`);
}
