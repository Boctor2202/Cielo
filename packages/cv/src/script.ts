import type { PDFFont } from "pdf-lib";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ArabicShaper } = require("arabic-persian-reshaper") as { ArabicShaper: { convertArabic: (s: string) => string } };

/**
 * Text in scripts the Latin font (Inter) cannot draw: Chinese (Han) and Arabic. Such runs are drawn with a
 * second font; Arabic runs are shaped (joined letter forms) and put in visual order, since the PDF library
 * draws glyphs one after the other, left to right.
 */
const SCRIPT = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿⺀-〿㐀-鿿豈-﫿＀-￯]/;
const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

export const hasScript = (s: string) => SCRIPT.test(s);

export interface Run {
  text: string;
  script: boolean;
}

/** Splits a line into Latin and script runs (spaces and punctuation stay with the run they sit in). */
export function runs(s: string): Run[] {
  const out: Run[] = [];
  for (const ch of s) {
    // brackets stand alone, so a right-to-left line can mirror them around the text they enclose
    if (ch === "(" || ch === ")") {
      out.push({ text: ch, script: false });
      continue;
    }
    const last = out[out.length - 1];
    const sc = SCRIPT.test(ch) || (/[\s.,:;\-]/.test(ch) && !!last?.script);
    if (last && last.script === sc && last.text !== "(" && last.text !== ")") last.text += ch;
    else out.push({ text: ch, script: sc });
  }
  // an Arabic line reads right to left: shape each run, then reverse the order of runs and of Arabic letters
  if (out.some((r) => ARABIC.test(r.text))) {
    return out
      .map((r) => (r.script ? { ...r, text: [...ArabicShaper.convertArabic(r.text)].reverse().join("") } : r))
      .reverse()
      // brackets are mirrored in a right-to-left line
      .map((r) => ({ ...r, text: r.text.replace(/[()]/g, (b) => (b === "(" ? ")" : "(")) }));
  }
  return out;
}

/** Width and drawing of a mixed line with a Latin font and its script fallback. */
export function mixedWidth(s: string, latin: PDFFont, script: PDFFont | undefined, size: number): number {
  if (!script || !hasScript(s)) return latin.widthOfTextAtSize(s, size);
  return runs(s).reduce((w, r) => w + (r.script ? script : latin).widthOfTextAtSize(r.text, size), 0);
}
