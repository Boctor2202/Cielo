/** Tells the app new flights were added (typed or imported), so it can show what they brought to the logbook. */
export const GAINS_EVENT = "geardown:gains";

export function announceGains(ids: string[]) {
  if (typeof window === "undefined" || !ids.length) return;
  // after the save has reached the local database
  setTimeout(() => window.dispatchEvent(new CustomEvent(GAINS_EVENT, { detail: ids })), 150);
}
