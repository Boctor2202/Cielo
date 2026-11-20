import type { Pilot } from "./types";

/**
 * Who may do what. No free plan: a 30-day trial without a card, counted from the account's creation (or from the
 * first local use before signing up), with everything in Max; then Basic, Student or Max. Without a live
 * subscription the logbook stays readable and exportable (GDPR portability), nothing is ever deleted, but nothing
 * new can be written.
 */
export const TRIAL_DAYS = 30;
export const PRICES_EUR = { basic: 4.99, premium: 8.99 } as const;
/** The yearly prices: two months free (10 months paid). */
export const YEARLY_PRICES_EUR = { basic: 49.99, premium: 89.99 } as const;

/** Features reserved to Max (internal key "premium"). Everything else is in Basic. */
export const MAX_FEATURES = ["roster", "ftl", "audit", "scan", "radar", "tracks", "layovers", "jobs", "cv"] as const;
/** Named features of every plan (checked by name like the Max ones): any live plan has them. */
export const BASIC_FEATURES = ["signature"] as const;
/** a feature checked by name (kept as "MaxFeature" for the existing call sites) */
export type MaxFeature = (typeof MAX_FEATURES)[number] | (typeof BASIC_FEATURES)[number];

/**
 * Trial without a card: a signed-in pilot with no subscription gets Max for this many days from account creation.
 * TRIAL_DAYS unless configured (Web: NEXT_PUBLIC_NO_CARD_TRIAL_DAYS, app: EXPO_PUBLIC_NO_CARD_TRIAL_DAYS);
 * "0" turns it off.
 */
export function noCardTrialDays(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return TRIAL_DAYS;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 90 ? Math.floor(n) : TRIAL_DAYS;
}

/** End of a pilot's trial (ISO), from the account's creation. */
export const trialEndsAt = (createdAt: string, days = TRIAL_DAYS) => new Date(Date.parse(createdAt) + days * 86400_000).toISOString();

export interface Access {
  /** plan currently granted: basic, premium (Max) or null (read-only) */
  plan: "basic" | "premium" | null;
  /** local demo before signing up (full Max features) */
  demo: boolean;
  /** trial without a card (signed in, no subscription yet) */
  trial?: boolean;
  /** end of the local demo (ISO) */
  demoEndsAt?: string;
  daysLeft?: number;
  canWrite: boolean;
  has(feature: MaxFeature): boolean;
}

export function accessFor(
  pilot: Pick<Pilot, "createdAt" | "subscriptionTier" | "subscriptionExpiresAt"> | undefined,
  opts: { signedIn: boolean; now?: Date; noCardTrialDays?: number; accountCreatedAt?: string },
): Access {
  const now = opts.now ?? new Date();
  const make = (plan: Access["plan"], extra: Partial<Access> = {}): Access => ({
    plan,
    demo: false,
    canWrite: plan !== null,
    has: (f) => ((BASIC_FEATURES as readonly string[]).includes(f) ? plan !== null : plan === "premium" && (MAX_FEATURES as readonly string[]).includes(f)),
    ...extra,
  });
  if (!pilot) return make("premium", { demo: true });
  const tier = pilot.subscriptionTier;
  const live = !pilot.subscriptionExpiresAt || Date.parse(pilot.subscriptionExpiresAt) > now.getTime();
  if ((tier === "basic" || tier === "premium") && live) return make(tier);
  // Trial without a card, when configured: from the account's creation (never touches a paid subscription)
  const days = opts.noCardTrialDays ?? 0;
  if (opts.signedIn && days > 0) {
    const end = Date.parse(opts.accountCreatedAt ?? pilot.createdAt) + days * 86400_000;
    if (now.getTime() < end) return make("premium", { trial: true, demoEndsAt: new Date(end).toISOString(), daysLeft: Math.max(1, Math.ceil((end - now.getTime()) / 86400_000)) });
  }
  // Local use before an account: a 7-day demo with everything. A signed-in pilot starts the trial at checkout.
  if (!opts.signedIn) {
    const end = Date.parse(pilot.createdAt) + TRIAL_DAYS * 86400_000;
    if (now.getTime() < end) {
      return make("premium", { demo: true, demoEndsAt: new Date(end).toISOString(), daysLeft: Math.max(1, Math.ceil((end - now.getTime()) / 86400_000)) });
    }
  }
  return make(null);
}

/** The public demonstration account (fictional pilot, fictional data), shown with a banner. */
export const DEMO_ACCOUNT_EMAIL = "demo@geardown.app";
export const isDemoAccount = (email?: string | null) => (email ?? "").trim().toLowerCase() === DEMO_ACCOUNT_EMAIL;
