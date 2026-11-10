// Minimal fetch-based Stripe client (no SDK): signature verification + REST calls.
import { requireEnv } from "./http.ts";
import type { Tier } from "./subscriptions.ts";

const STRIPE_API = "https://api.stripe.com/v1";

export type Plan = "basic" | "premium";
export type Interval = "monthly" | "yearly";

/** Price id configured for a plan + interval (env STRIPE_PRICE_<PLAN>_<INTERVAL>). */
export function priceIdFor(plan: Plan, interval: Interval): string {
  return requireEnv(`STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`);
}

/** Maps a Stripe price id back to a Cielo tier (null when unknown). */
export function tierForPrice(priceId: string | null | undefined): Tier | null {
  if (!priceId) return null;
  for (const plan of ["basic", "premium"] as const) {
    for (const interval of ["monthly", "yearly"] as const) {
      if (Deno.env.get(`STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`) === priceId) return plan;
    }
  }
  return null;
}

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verifies the Stripe-Signature header (t=timestamp,v1=hmac[,v1=...]) over `${t}.${rawBody}`
 * with HMAC-SHA256 and the endpoint secret. Rejects timestamps older than `toleranceSec`.
 */
export async function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  toleranceSec = 300,
  nowSec = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!header) return false;
  let timestamp: string | undefined;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=", 2);
    if (k === "t") timestamp = v;
    else if (k === "v1" && v) signatures.push(v);
  }
  if (!timestamp || signatures.length === 0) return false;
  if (Math.abs(nowSec - Number(timestamp)) > toleranceSec) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`)));
  return signatures.some((s) => timingSafeEqualHex(s, expected));
}

/** Flattens a nested object into Stripe's form encoding (a[b][0][c]=...). */
function formEncode(obj: Record<string, unknown>, prefix = "", out = new URLSearchParams()): URLSearchParams {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") formEncode(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}

export async function stripeRequest<T>(method: "GET" | "POST", path: string, params?: Record<string, unknown>): Promise<T> {
  const secret = requireEnv("STRIPE_SECRET_KEY");
  const body = params && method === "POST" ? formEncode(params) : undefined;
  const query = params && method === "GET" ? `?${formEncode(params)}` : "";
  const res = await fetch(`${STRIPE_API}${path}${query}`, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe ${method} ${path}: ${data?.error?.message ?? res.status}`);
  return data as T;
}

/** The subset of a Stripe Subscription object that Cielo uses. */
export interface StripeSubscription {
  id: string;
  status: string;
  customer: string;
  cancel_at_period_end?: boolean;
  current_period_end?: number; // API versions before 2025-03-31
  metadata?: Record<string, string>;
  items: { data: { price: { id: string; product?: string }; current_period_end?: number }[] };
}

export function subscriptionPeriodEnd(sub: StripeSubscription): string | null {
  const unix = sub.current_period_end ?? sub.items.data[0]?.current_period_end;
  return unix ? new Date(unix * 1000).toISOString() : null;
}
