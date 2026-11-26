import type Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL, anthropic } from "@/lib/server/anthropic";
import { DOCUMENT_KINDS } from "@cielo/core";
import { meterAi } from "./usage";
import { ImportAiError } from "./importAi";

/**
 * Claude reading a pilot licence (with its ratings and endorsements) or a medical certificate from a photo or a
 * PDF. Nothing is kept: the answer is a list of entries the pilot checks before they are saved.
 */

const s = { type: "string", description: "\"\" when absent or unreadable" };
const day = { type: "string", pattern: "^(\\d{4}-\\d{2}-\\d{2})?$", description: "YYYY-MM-DD; \"\" when absent or unreadable" };

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["document", "entries"],
  properties: {
    document: { type: "string", enum: ["licence", "medical", "other", "none"], description: "What the pages are: a pilot licence, a medical certificate, another aviation document, or not an aviation document" },
    entries: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "code", "authority", "number", "issuedOn", "validUntil", "lastCheckOn", "limitations"],
        properties: {
          kind: { type: "string", enum: [...DOCUMENT_KINDS] },
          code: { type: "string", description: "Title as the pilot would name it: ATPL(A), CPL(A), PPL(A), Class 1, Class 2, LAPL medical, SEP(land), MEP(land), TR A320 (type ratings: TR + ICAO type or the rating as printed), IR(A), FI(A), Night rating, LPE English 6, FRTOL…" },
          authority: { ...s, description: "Issuing authority (licence, ratings, language) or the AeMC / aero-medical examiner (medical) as printed; \"\" when absent" },
          number: { ...s, description: "Licence or certificate number, as printed; \"\" when absent" },
          issuedOn: { ...day, description: "Licence: date of initial issue. Rating: date of issue. Medical: date of the examination. Language: date of the assessment. \"\" when absent" },
          validUntil: { ...day, description: "Expiry date printed for this entry; \"\" when none (a licence does not expire) or unreadable" },
          lastCheckOn: { ...day, description: "Ratings: date of the last proficiency check / skill test when printed; else \"\"" },
          limitations: { type: "array", items: { type: "string" }, description: "Medical only: limitation codes as printed (VDL, VML, VNL, CCL, OML, OCL, SIC, TML, RXO…); [] otherwise" },
        },
      },
    },
  },
} as const;

const SYSTEM = `You read pilot documents for an electronic logbook: a pilot licence (EASA Part-FCL card or booklet, FAA certificate, other ICAO licence) with its ratings, endorsements and language proficiency, or a medical certificate (EASA Part-MED class 1 / class 2 / LAPL, FAA medical).

Rules:
- One entry per item: the licence itself (kind "licence"), each class rating (SEP, MEP, TMG: kind "class_rating"), each type rating (kind "type_rating", title "TR <type>"), each additional rating (IR, night, instructor, examiner, aerobatic…: kind "skill_rating"), each language proficiency (kind "language", "LPE <Language> <level>"), the radiotelephony privilege (kind "radio"), the medical certificate (kind "medical", one entry per class that has its own validity date).
- EASA licence: section XII lists ratings with their validity ("valid until") and, on the certificate of revalidation pages, the date of the check; the most recent line for a rating is the one in force. Language proficiency is often in section XIII or on its own page.
- Dates: read the day/month/year order of the issuing country (European documents are DD/MM/YYYY) and give YYYY-MM-DD. When a date is not legible, give "" rather than guessing.
- Medical: keep only the class, the examination date, the validity date(s), the limitation codes and the AeMC / examiner. Never transcribe any other health information, the date of birth or the address.
- Never transcribe the holder's address, date of birth, nationality or signature. The holder's name is not needed.
- Never invent an entry, a number or a date. If the pages are not a pilot licence or medical certificate, answer document "none" with no entries.`;

export interface DocumentScanResult {
  document: "licence" | "medical" | "other" | "none";
  entries: Record<string, unknown>[];
}

export async function readPilotDocument(content: Anthropic.Beta.Messages.BetaContentBlockParam[], today: string): Promise<DocumentScanResult> {
  const msg = await anthropic().beta.messages.create({
    model: AI_MODEL,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> } },
    system: SYSTEM,
    messages: [{ role: "user", content: [...content, { type: "text", text: `Today is ${today}. Read the document.` }] }],
  });
  meterAi("documentScan", msg.usage);
  if (msg.stop_reason === "refusal") throw new ImportAiError("refused");
  if (msg.stop_reason === "max_tokens") throw new ImportAiError("too_long");
  return JSON.parse(msg.content.map((c) => (c.type === "text" ? c.text : "")).join("")) as DocumentScanResult;
}
