import type { PdfTextItem } from "@cielo/core";
import { getDocumentProxy } from "unpdf";

/** Positioned text of every page (empty for a scanned PDF). */
export async function pdfText(bytes: Uint8Array, maxPages = 20): Promise<PdfTextItem[][]> {
  const pdf = await getDocumentProxy(bytes);
  const pages: PdfTextItem[][] = [];
  for (let p = 1; p <= Math.min(pdf.numPages, maxPages); p++) {
    const tc = await (await pdf.getPage(p)).getTextContent();
    pages.push(
      (tc.items as { str?: string; transform?: number[] }[])
        .filter((i) => i.str?.trim() && i.transform)
        .map((i) => ({ x: i.transform![4]!, y: i.transform![5]!, s: i.str! })),
    );
  }
  return pages;
}
