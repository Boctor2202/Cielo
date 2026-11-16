/**
 * French micro-entreprise thresholds tracked in the admin (amounts in EUR). They change by law:
 * CHECK THEM EVERY YEAR with an accountant (service-type activity; values in force for 2026).
 */
export const THRESHOLDS = {
  /** turnover ceiling of the micro-entreprise regime, services */
  microCeiling: 77_700,
  /** VAT franchise ("franchise en base"), services: base threshold and increased threshold (VAT due beyond it) */
  vatFranchise: 37_500,
  vatFranchiseMax: 41_250,
  /** distance sales to consumers in other EU countries: beyond it, VAT of the customer's country (OSS) */
  euOss: 10_000,
  /** warn from this share of a threshold */
  warnAt: 0.8,
};

export const EU = new Set(["AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "EL", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK"]);

export interface Revenue {
  occurred_at: string;
  source: "stripe" | "apple" | "google";
  amount_eur_cents: number;
  proceeds_eur_cents: number | null;
  country: string | null;
}

/**
 * Year-to-date figures. Turnover = what the business receives: web payments (Stripe, gross) + store proceeds
 * (after Apple/Google commission; the stores sell to the customer and pay you). VAT franchise base = web sales
 * (store payouts are services to Apple/Google outside France, to confirm with the accountant).
 * OSS base = web sales to consumers in EU countries other than France.
 */
export function thresholdStatus(rows: Revenue[], year = new Date().getUTCFullYear()) {
  const ytd = rows.filter((r) => r.occurred_at.slice(0, 4) === String(year));
  const eur = (c: number) => Math.round(c) / 100;
  const web = ytd.filter((r) => r.source === "stripe");
  const store = ytd.filter((r) => r.source !== "stripe");
  const webTotal = eur(web.reduce((s, r) => s + r.amount_eur_cents, 0));
  const storeProceeds = eur(store.reduce((s, r) => s + (r.proceeds_eur_cents ?? 0), 0));
  const euOther = eur(web.filter((r) => r.country && r.country !== "FR" && EU.has(r.country)).reduce((s, r) => s + r.amount_eur_cents, 0));
  const unknownCountry = eur(web.filter((r) => !r.country).reduce((s, r) => s + r.amount_eur_cents, 0));
  const turnover = webTotal + storeProceeds;
  // projection to 31 December at the current pace
  const start = Date.UTC(year, 0, 1);
  const elapsed = Math.max(1, (Date.now() - start) / 86400_000);
  const days = (Date.UTC(year + 1, 0, 1) - start) / 86400_000;
  const project = (v: number) => Math.round((v / elapsed) * days);
  const item = (key: string, value: number, limit: number, limitMax?: number) => ({
    key,
    value,
    limit,
    limitMax: limitMax ?? null,
    projected: project(value),
    ratio: value / limit,
    level: value >= (limitMax ?? limit) ? "over" : value >= limit * THRESHOLDS.warnAt || project(value) >= limit ? "warning" : "ok",
  });
  return {
    year,
    turnover,
    webTotal,
    storeProceeds,
    unknownCountry,
    items: [
      item("micro", turnover, THRESHOLDS.microCeiling),
      item("vat", webTotal, THRESHOLDS.vatFranchise, THRESHOLDS.vatFranchiseMax),
      item("oss", euOther, THRESHOLDS.euOss),
    ],
  };
}
