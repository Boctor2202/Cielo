import Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@/lib/server/anthropic";
import { IMPORT_FIELDS, type LogbookLeg } from "@cielo/core";

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
        required: ["date", "dep", "arr", "out", "off", "on", "in", "totalMin", "nightMin", "ifrMin", "picMin", "copilotMin", "dualMin", "instructorMin", "multiPilotMin", "landingsDay", "landingsNight", "registration", "aircraftType", "flightNumber", "function", "picName", "remarks"],
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
          landingsDay: n,
          landingsNight: n,
          registration: s,
          aircraftType: { ...s, description: "ICAO type designator when you can tell it (A320, C172, DA42…), else as written; \"\" when absent" },
          flightNumber: s,
          function: { type: "string", enum: ["PIC", "PICUS", "SIC", "DUAL", "FI", "FE", ""], description: "From the function-time columns or the role printed; \"\" when unknown" },
          picName: { ...s, description: "Name of the pilot in command as written ('SELF' when the pilot is PIC); \"\" when absent" },
          remarks: s,
        },
      },
    },
  },
} as const;

const LEGS_SYSTEM = `You extract the flights a pilot logged or flew from what they give you: an airline flight-hour statement, a crew-software export, a post-flight e-mail or summary, or photos of the pages of a paper pilot logbook (often handwritten, EASA FCL.050 / FAA layout across two facing pages).

Rules:
- One leg per flown sector, in the document's order. Skip totals, "brought forward"/"total this page"/"total time" lines, cumulative lines and empty rows. Skip simulator-only lines.
- Times: HH:MM. Convert decimal hours ("14.63" = 14:38, "1.5" = 90 min). Durations in minutes ("1:30" = 90, "1h30" = 90).
- Paper logbooks: read every column carefully, row by row; a page spread has the date/route/aircraft on the left and the times, landings, function times and remarks on the right — keep each row aligned. When the year is not written on a row, take it from the page or the previous rows. Ditto marks (" or 〃) repeat the value above.
- Airports as written (ICAO or IATA). Registrations as written, with the national prefix when obvious ("FGKXA" → "F-GKXA", Air France "HZUN" → "F-HZUN").
- Never invent: when a value is absent or unreadable, write "" for text and times, -1 for numbers.`;

export interface LegsResult {
  source: string;
  timeBasis: string;
  legs: LogbookLeg[];
}

type Block = Anthropic.Beta.Messages.BetaContentBlockParam;

export async function extractLegs(content: Block[], today: string): Promise<LegsResult> {
  const client = anthropic();
  const stream = client.beta.messages.stream({
    model: "claude-opus-5-5",
    max_tokens: 32000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: LEGS_SCHEMA as unknown as Record<string, unknown> } },
    system: LEGS_SYSTEM,
    messages: [{ role: "user", content: [...content, { type: "text", text: `Today is ${today}. Extract the flights.` }] }],
  });
  const msg = await stream.finalMessage();
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
    model: "claude-opus-5-5",
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: MAP_SCHEMA as unknown as Record<string, unknown> } },
    system:
      "You map the columns of a pilot logbook or crew-software export to logbook fields. Fields: date, flightNumber, dep, arr, out (off-block), off (take-off), on (landing), in (on-block), registration, type (aircraft type), function, picName, total, night, ifr, takeoffsDay, takeoffsNight, landingsDay, landingsNight, pic, copilot, dual, instructor, multiPilot, remarks, fstdType, fstdTime. Only map a column you are confident about; leave out the others.",
    messages: [{ role: "user", content: `Tab-separated, first line is the header:\n${csv}` }],
  });
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
