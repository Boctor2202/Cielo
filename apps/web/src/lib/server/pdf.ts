import type { PdfTextItem } from "@cielo/core";
import { getDocumentProxy } from "unpdf";

/** Positioned text of every page (empty for a scanned PDF). */
export async function pdfText(bytes: Uint8Array, maxPages = 20): Promise<PdfTextItem[][]> {
  const pdf = await getDocumentProxy(bytes);
  const pages: PdfTextItem[][] = [];
  for (let p = 1; p <= Math.min(pdf.numPages, maxPages); p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    // positions as the page is shown: a landscape page stored rotated (an airline's monthly statement) is turned
    // upright, so its lines read left to right (unrotated pages keep their coordinates)
    const vp = page.getViewport({ scale: 1 });
    const [a, b, c, d, e, f] = vp.transform as number[];
    pages.push(
      (tc.items as { str?: string; transform?: number[] }[])
        .filter((i) => i.str?.trim() && i.transform)
        .map((i) => {
          const tx = i.transform![4]!;
          const ty = i.transform![5]!;
          return { x: a! * tx + c! * ty + e!, y: vp.height - (b! * tx + d! * ty + f!), s: i.str! };
        }),
    );
  }
  return pages;
}
