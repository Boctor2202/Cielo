import Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL, anthropic } from "@/lib/server/anthropic";
import { IMPORT_FIELDS, type LogbookLeg } from "@cielo/core";
import { meterAi } from "./usage";

/**
 * Claude reading flights from anything a pilot has: an airline statement (PDF), a paper logbook (photos of the
 * pages), an e-mail or a summary (text). The pilot reviews every flight before it is imported.
 */

// No nullable types: the API compiles at most 16 union-typed parameters. Absent values are "" and -1 instead.
const n = { type: "integer", description: "-1 when absent" };
const s = { type: "string", description: "\"\" when absent" };
const hhmm = { type: "string", pattern: "^(([01]\\d|2[0-3]):[0-5]\\d)?$" };

const LEGS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["source", "timeBasis", "legs"],
  properties: {
    source: { type: "string", description: "What the document is, in a few words (e.g. 'Air France EP5 statement', 'EASA paper logbook', 'Ryanair post-flight e-mail')" },
    timeBasis: { type: "string", enum: ["UTC", "local", "unknown"] },
    legs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "dep", "arr", "out", "off", "on", "in", "totalMin", "nightMin", "ifrMin", "picMin", "copilotMin", "dualMin", "instructorMin", "multiPilotMin", "xcMin", "landingsDay", "landingsNight", "registration", "aircraftType", "flightNumber", "function", "picName", "remarks", "fstdType", "fstdMin"],
        properties: {
          date: { type: "string", description: "YYYY-MM-DD, day of departure" },
          dep: { type: "string", description: "Departure airport code as written (ICAO or IATA)" },
          arr: { type: "string", description: "Arrival airport code as written (ICAO or IATA)" },
          out: { ...hhmm, description: "Off-block (departure time in a paper logbook); \"\" when absent" },
          off: { ...hhmm, description: "Take-off, when given apart from off-block; \"\" when absent" },
          on: { ...hhmm, description: "Landing, when given apart from on-block; \"\" when absent" },
          in: { ...hhmm, description: "On-block (arrival time in a paper logbook); \"\" when absent" },
          totalMin: { ...n, description: "Total flight / block time in minutes; -1 when absent" },
          nightMin: n,
          ifrMin: n,
          picMin: n,
          copilotMin: n,
          dualMin: n,
          instructorMin: n,
          multiPilotMin: n,
          xcMin: { ...n, description: "Cross-country (navigation) time in minutes when the document has that column; -1 when absent" },
          landingsDay: n,
          landingsNight: n,
          registration: s,
          aircraftType: { ...s, description: "ICAO type designator when you can tell it (A320, C172, DA42…), else as written; \"\" when absent" },
          flightNumber: s,
          function: { type: "string", enum: ["PIC", "PICUS", "SIC", "DUAL", "FI", "FE", ""], description: "From the function-time columns or the role printed; \"\" when unknown" },
          picName: { ...s, description: "Name of the pilot in command as written ('SELF' when the pilot is PIC); \"\" when absent" },
          remarks: s,
          fstdType: { ...s, description: "Simulator session only: the device type (FNPT II, FFS, FTD…); \"\" for a flight" },
          fstdMin: { ...n, description: "Simulator session only: total time of the session in minutes; -1 for a flight" },
        },
      },
    },
  },
} as const;

const LEGS_SYSTEM = `You extract the flights a pilot logged or flew from what they give you: an airline flight-hour statement, a crew-software export, a post-flight e-mail or summary, or photos of the pages of a paper pilot logbook (often handwritten, EASA FCL.050 / FAA layout across two facing pages).

Rules:
- One leg per flown sector, in the document's order. Skip totals, "brought forward"/"total this page"/"total time" lines, cumulative lines and empty rows. Skip simulator-only lines.
- Times: HH:MM. Convert decimal hours ("14.63" = 14:38, "1.5" = 90 min). Durations in minutes ("1:30" = 90, "1h30" = 90).
- The left and right pages of a spread may come as separate photos, one after the other, or rotated by 90°: read each photo in its natural orientation; rows at the same position on the left and right pages are the same flight or session.
- Paper logbooks: read every column carefully, row by row; a page spread has the date/route/aircraft on the left and the times, landings, function times and remarks on the right — keep each row aligned. A spread may come as two crops of the same photo (left half, then right half, overlapping a little): the rows at the same height in both crops are the same flight, so give one leg per row with the values of both halves. Read the departure and arrival times (off-block / on-block) and the total time of every row; when only one of them is legible, keep the others empty rather than guessing. When the year is not written on a row, take it from the page or the previous rows. Ditto marks (" or 〃) repeat the value above.
- Paper logbook cells: the total time of flight is often split in two cells, hours then minutes ("1 | 25" = 85 min, "00 | 57" = 57 min); clock times are written "14h29", "7h45" or "0745" (= 14:29, 07:45). A row with only a date on the left page is usually a simulator session whose details are on the right page ("Synthetic training devices session": date, type, total time of session): give it as a leg with dep and arr "", fstdType and fstdMin (and the dual / instructor time if written). A row with nothing at all is skipped. Skip the "total this page", "total from previous pages" and "total time" lines and any carry-over note.
- The name in the "Name PIC" column is the pilot in command; when it is someone else (an instructor), the pilot was likely flying dual: use the function-time columns when visible, else leave function "".
- Every flight row needs its departure and arrival airports, its aircraft registration and its aircraft type: read them on every row (they are often in the "Departure place", "Arrival place", "Registration" and "Make, model, variant" columns), and when a cell holds a ditto mark or is left empty under the same aircraft, repeat the value above. European paper logbooks use 4-letter ICAO codes (LFPN, LFOX, EGLL): read each letter carefully, as handwriting confuses N/H, O/D/0, I/1, S/5, P/F.
- Airports as written (ICAO or IATA). Registrations as written, with the national prefix when obvious ("FGKXA" → "F-GKXA", Air France "HZUN" → "F-HZUN").
- Never invent: when a value is absent or unreadable, write "" for text and times, -1 for numbers.`;

export interface LegsResult {
  source: string;
  timeBasis: string;
  legs: LogbookLeg[];
}

type Block = Anthropic.Beta.Messages.BetaContentBlockParam;

export async function extractLegs(content: Block[], today: string, effort: "medium" | "high" = "medium"): Promise<LegsResult> {
  const client = anthropic();
  const stream = client.beta.messages.stream({
    model: AI_MODEL,
    max_tokens: 32000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort, format: { type: "json_schema", schema: LEGS_SCHEMA as unknown as Record<string, unknown> } },
    system: LEGS_SYSTEM,
    messages: [{ role: "user", content: [...content, { type: "text", text: `Today is ${today}. Extract the flights.` }] }],
  });
  const msg = await stream.finalMessage();
  meterAi("import", msg.usage);
  if (msg.stop_reason === "refusal") throw new ImportAiError("refused");
  if (msg.stop_reason === "max_tokens") throw new ImportAiError("too_long");
  const out = JSON.parse(msg.content.map((c) => (c.type === "text" ? c.text : "")).join("")) as LegsResult;
  // "" / -1 → undefined, as the import expects
  out.legs = out.legs.map((l) => Object.fromEntries(Object.entries(l).filter(([, v]) => v !== null && v !== "" && v !== -1)) as unknown as LogbookLeg);
  return out;
}

const MAP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["source", "columns"],
  properties: {
    source: { type: "string", description: "The software or airline the file seems to come from, or 'unknown'" },
    columns: {
      type: "array",
      description: "For each field found in the table, the index (0-based) of the column holding it",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "column"],
        properties: { field: { type: "string", enum: IMPORT_FIELDS }, column: { type: "integer" } },
      },
    },
  },
} as const;

/** Which column of a table holds which field (the table itself is then read in the app, row by row). */
export async function mapTable(header: string[], rows: string[][]): Promise<{ source: string; mapping: Record<string, number> }> {
  const client = anthropic();
  const csv = [header, ...rows.slice(0, 25)].map((r) => r.map((c) => (c ?? "").replace(/[\t\n]/g, " ")).join("\t")).join("\n");
  const msg = await client.beta.messages.create({
    model: AI_MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: MAP_SCHEMA as unknown as Record<string, unknown> } },
    system:
      "You map the columns of a pilot logbook or crew-software export to logbook fields. Fields: date, flightNumber, dep, arr, out (off-block), off (take-off), on (landing), in (on-block), registration, type (aircraft type), function, picName, total, night, ifr, takeoffsDay, takeoffsNight, landingsDay, landingsNight, pic, copilot, dual, instructor, multiPilot, remarks, fstdType, fstdTime. Only map a column you are confident about; leave out the others.",
    messages: [{ role: "user", content: `Tab-separated, first line is the header:\n${csv}` }],
  });
  meterAi("importTable", msg.usage);
  if (msg.stop_reason === "refusal") throw new ImportAiError("refused");
  const out = JSON.parse(msg.content.map((c) => (c.type === "text" ? c.text : "")).join("")) as { source: string; columns: { field: string; column: number }[] };
  const mapping: Record<string, number> = {};
  for (const c of out.columns) if (c.column >= 0 && c.column < header.length && !(c.field in mapping)) mapping[c.field] = c.column;
  return { source: out.source, mapping };
}

export class ImportAiError extends Error {
  constructor(public code: "refused" | "too_long") {
    super(code);
  }
}
