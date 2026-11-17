import type { Job } from "@cielo/jobs";

/** The offer the cover-letter screen is opened for (set by the Jobs list just before navigating). */
let current: Job | null = null;
export const setLetterJob = (j: Job | null) => {
  current = j;
};
export const getLetterJob = () => current;
