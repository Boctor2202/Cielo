import { adminDb } from "./admin";

/**
 * What the server spends on outside APIs, counted per day and operation in api_usage (Admin › APIs). Costs are
 * estimates from the public price lists (USD) below; the free allowances are applied on the dashboard, per month.
 * Never throws and never delays the caller: a failed count is only logged.
 */
export type Service = "anthropic" | "google" | "flightaware" | "adzuna" | "resend" | "expo" | "adsblol" | "openaip" | "gfs";

/** Claude Sonnet, USD per million tokens. */
export const AI_PRICE = { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 };

/** Google Places (New), USD per 1 000 calls, and the calls free each month for that price level. */
export const GOOGLE_SKU = {
  "textSearch.pro": { per1000: 32, free: 5000 },
  "textSearch.enterprise": { per1000: 35, free: 1000 },
  "details.essentials": { per1000: 5, free: 10000 },
  "details.pro": { per1000: 17, free: 5000 },
  "details.enterprise": { per1000: 20, free: 1000 },
  photo: { per1000: 7, free: 1000 },
} as const;
export type GoogleSku = keyof typeof GOOGLE_SKU;

/** The price level of a Places call, from the fields it asks for (the most expensive field sets the price). */
export function googleSku(kind: "textSearch" | "details", fieldMask: string): GoogleSku {
  if (/rating|userRatingCount|regularOpeningHours|currentOpeningHours|websiteUri|PhoneNumber|priceLevel|reviews/.test(fieldMask)) return `${kind}.enterprise`;
  if (kind === "details" && !/displayName|photos|types|businessStatus/.test(fieldMask)) return "details.essentials";
  return `${kind}.pro`;
}

interface Count {
  calls?: number;
  errors?: number;
  input?: number;
  output?: number;
  costUsd?: number;
}

export function meter(service: Service, op: string, c: Count = {}): void {
  const db = adminDb();
  if (!db) return;
  void db
    .rpc("api_usage_add", { p_service: service, p_op: op, p_calls: c.calls ?? 1, p_errors: c.errors ?? 0, p_input: Math.round(c.input ?? 0), p_output: Math.round(c.output ?? 0), p_cost: c.costUsd ?? 0 })
    .then(({ error }) => error && console.warn("[usage]", service, op, error.message), (e: unknown) => console.warn("[usage]", service, op, e));
}

/** A Claude answer's tokens and their cost. */
export function meterAi(op: string, usage: { input_tokens?: number | null; output_tokens?: number | null; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null } | undefined | null): void {
  const i = usage?.input_tokens ?? 0;
  const o = usage?.output_tokens ?? 0;
  const cr = usage?.cache_read_input_tokens ?? 0;
  const cw = usage?.cache_creation_input_tokens ?? 0;
  const cost = (i * AI_PRICE.input + o * AI_PRICE.output + cr * AI_PRICE.cacheRead + cw * AI_PRICE.cacheWrite) / 1e6;
  meter("anthropic", op, { input: i + cr + cw, output: o, costUsd: cost });
}

/** fetch, counted: the call and whether it failed (a 4xx/5xx or a network error). */
export async function meteredFetch(service: Service, op: string, url: string, init?: RequestInit, costUsd = 0): Promise<Response> {
  try {
    const r = await fetch(url, init);
    meter(service, op, { errors: r.ok || r.status === 404 ? 0 : 1, costUsd });
    return r;
  } catch (e) {
    meter(service, op, { errors: 1 });
    throw e;
  }
}
