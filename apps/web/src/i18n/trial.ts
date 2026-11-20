import { noCardTrialDays } from "@cielo/core";

/** The trial on offer: the store / Stripe trial with a card, or a trial without a card when configured. */
export const NO_CARD_TRIAL_DAYS = noCardTrialDays(process.env.NEXT_PUBLIC_NO_CARD_TRIAL_DAYS);
export const TRIAL_DAYS = NO_CARD_TRIAL_DAYS || 7;

/** Puts the trial length in the texts (%TRIAL%) and the no-card wording when that trial is on. */
export function trialMessages<T>(messages: T): T {
  const text = JSON.stringify(messages).replaceAll("%TRIAL%", String(TRIAL_DAYS));
  const m = JSON.parse(text) as { pricing?: { trialNote?: string; trialNoteNoCard?: string } };
  if (NO_CARD_TRIAL_DAYS && m.pricing?.trialNoteNoCard) m.pricing.trialNote = m.pricing.trialNoteNoCard;
  return m as T;
}
