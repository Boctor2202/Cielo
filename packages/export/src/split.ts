import { PDFDocument } from "pdf-lib";

/** The pages of a PDF, in parts of `pagesPerPart` pages each (in order), as new PDFs. */
export async function splitPdf(bytes: Uint8Array, pagesPerPart: number): Promise<Uint8Array[]> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const n = src.getPageCount();
  const parts: Uint8Array[] = [];
  for (let start = 0; start < n; start += pagesPerPart) {
    const doc = await PDFDocument.create();
    const idx = Array.from({ length: Math.min(pagesPerPart, n - start) }, (_, i) => start + i);
    for (const p of await doc.copyPages(src, idx)) doc.addPage(p);
    parts.push(await doc.save());
  }
  return parts;
}
