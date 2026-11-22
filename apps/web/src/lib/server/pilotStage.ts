import { noCardTrialDays } from "@cielo/core";

/**
 * Where a pilot stands, for the admin: on a trial, paying, trial over without paying, cancelled, or given a plan by
 * hand (complimentary). The admin accounts themselves are left out of every list and count.
 */
export type Stage = "trial" | "paying" | "ended" | "canceled" | "comped";

export interface PilotRow {
  id: string;
  created_at: string;
  trial_started_at?: string | null;
  subscription_tier: string;
  subscription_source?: string | null;
  subscription_expires_at?: string | null;
}
export interface SubRow {
  pilot_id: string;
  source: string;
  tier: string;
  status: string;
  created_at: string;
  current_period_end?: string | null;
}

const PAYING = ["active", "past_due", "canceling", "billing_issue"];

export function stageOf(p: PilotRow, sub: SubRow | undefined, now = Date.now()): { stage: Stage; since: string; trialEndsAt?: string; renewsAt?: string | null } {
  const live = (exp?: string | null) => !exp || Date.parse(exp) > now;
  if (sub && PAYING.includes(sub.status) && live(sub.current_period_end)) return { stage: "paying", since: sub.created_at, renewsAt: sub.current_period_end };
  if (sub && sub.status === "trialing" && live(sub.current_period_end)) return { stage: "trial", since: sub.created_at, trialEndsAt: sub.current_period_end ?? undefined };
  // a plan set by hand has no store behind it (the stores' webhooks set subscription_source)
  if ((p.subscription_tier === "basic" || p.subscription_tier === "premium") && !p.subscription_source && live(p.subscription_expires_at)) return { stage: "comped", since: p.created_at, renewsAt: p.subscription_expires_at };
  if (sub && ["canceled", "expired", "refunded"].includes(sub.status)) return { stage: "canceled", since: sub.created_at, renewsAt: sub.current_period_end };
  const start = p.trial_started_at ?? p.created_at;
  const days = noCardTrialDays(process.env.NEXT_PUBLIC_NO_CARD_TRIAL_DAYS);
  const end = Date.parse(start) + days * 86400_000;
  if (days > 0 && end > now) return { stage: "trial", since: start, trialEndsAt: new Date(end).toISOString() };
  return { stage: "ended", since: start, trialEndsAt: days > 0 ? new Date(end).toISOString() : undefined };
}

/** The latest subscription of each pilot (rows sorted newest first). */
export function latestSubs(subs: SubRow[] | null | undefined): Map<string, SubRow> {
  const m = new Map<string, SubRow>();
  for (const s of [...(subs ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))) if (!m.has(s.pilot_id)) m.set(s.pilot_id, s);
  return m;
}
