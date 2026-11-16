import type { Pilot } from "./types";

/**
 * Who may do what. No free plan: a 7-day trial (Stripe / App Store trial with a card, or 7 days of
 * local use before signing up), then Basic or Max. Without a live subscription the logbook stays
 * readable and exportable (GDPR portability) but nothing new can be written.
 */
export const TRIAL_DAYS = 7;
export const PRICES_EUR = { basic: 6.99, premium: 9.99 } as const;

/** Features reserved to Max (internal key "premium"). Everything else is in Basic. */
export const MAX_FEATURES = ["roster", "ftl", "audit", "signature", "scan", "radar", "tracks", "layovers", "jobs", "cv"] as const;
export type MaxFeature = (typeof MAX_FEATURES)[number];

export interface Access {
  /** plan currently granted: basic, premium (Max) or null (read-only) */
  plan: "basic" | "premium" | null;
  /** local demo before signing up (full Max features) */
  demo: boolean;
  /** end of the local demo (ISO) */
  demoEndsAt?: string;
  daysLeft?: number;
  canWrite: boolean;
  has(feature: MaxFeature): boolean;
}

export function accessFor(pilot: Pick<Pilot, "createdAt" | "subscriptionTier" | "subscriptionExpiresAt"> | undefined, opts: { signedIn: boolean; now?: Date }): Access {
  const now = opts.now ?? new Date();
  const make = (plan: Access["plan"], extra: Partial<Access> = {}): Access => ({
    plan,
    demo: false,
    canWrite: plan !== null,
    has: (f) => plan === "premium" && (MAX_FEATURES as readonly string[]).includes(f),
    ...extra,
  });
  if (!pilot) return make("premium", { demo: true });
  const tier = pilot.subscriptionTier;
  const live = !pilot.subscriptionExpiresAt || Date.parse(pilot.subscriptionExpiresAt) > now.getTime();
  if ((tier === "basic" || tier === "premium") && live) return make(tier);
  // Local use before an account: a 7-day demo with everything. A signed-in pilot starts the trial at checkout.
  if (!opts.signedIn) {
    const end = Date.parse(pilot.createdAt) + TRIAL_DAYS * 86400_000;
    if (now.getTime() < end) {
      return make("premium", { demo: true, demoEndsAt: new Date(end).toISOString(), daysLeft: Math.max(1, Math.ceil((end - now.getTime()) / 86400_000)) });
    }
  }
  return make(null);
}
