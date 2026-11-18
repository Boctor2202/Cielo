import Anthropic from "@anthropic-ai/sdk";
import { accessFor } from "@cielo/core";
import { adminDb, isAdminId, userFrom } from "@/lib/server/admin";
import { rateLimited } from "@/lib/places";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/cover-letter — a cover letter written for one job offer from the pilot's own profile.
 * Body: { locale: "en"|"fr"|"es"|"ru"|"zh"|"ar", job: { company, title, location?, aircraft?, requirements?, url?, text? },
 *         pilot: { name, rank?, employer?, base?, nationality?, licences[], hours{}, types[], experience[], languages[] },
 *         notes?: string }
 * Max subscribers only (each letter is a paid model call). The pilot data comes from their device; the server
 * keeps nothing.
 */

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const json = (v: unknown, n: number) => JSON.stringify(v ?? null).slice(0, n);

const SYSTEM = `You write cover letters for airline and business-aviation pilots applying to a specific job.

Ground rules:
- Use only facts present in the pilot profile and the job data you are given. Never invent hours, types, ratings, employers, dates, licences or achievements. If something the offer asks for is missing from the profile, do not claim it; you may express willingness to complete it (e.g. a type rating) only if that is plausible and honest.
- Quote the pilot's figures exactly as given (total hours, hours on type, PIC, multi-pilot, jet, etc.), rounded down to whole hours.
- Write in the requested language, in the register a chief pilot or airline recruitment team expects: precise, confident, factual, no clichés, no flattery, no exclamation marks.

Recruiters screen letters with applicant-tracking systems (ATS) and AI ranking tools before a person reads them. Write so the letter scores well with those tools and still reads naturally to a human:
- Reuse the offer's exact terms for the job title, aircraft type(s) (ICAO designator and full name, e.g. "Cessna Citation Latitude (C68A)"), licence (e.g. "EASA ATPL(A)", "FAA ATP"), ratings (type rating, IR, MCC/JOC), medical class, minimum hours and language level wherever the profile genuinely meets them.
- Put the job title and the company name in the first two sentences, and the strongest matching qualifications (licence, total hours, hours on type or class, current position) in the first paragraph.
- Plain text only: no tables, columns, bullet symbols, emojis, markdown, headers or footers. Short paragraphs separated by one blank line.
- Spell out each figure with its unit ("4 200 hours total", "1 850 hours on C68A as First Officer").
- 250 to 380 words in the body.

Structure:
1. Salutation (use "Madame, Monsieur," in French or "Dear Hiring Team," in English unless a contact name is given).
2. Opening: the position applied for at the company and why the pilot is a strong match, in one or two sentences.
3. Qualifications that answer the offer's requirements, with figures.
4. Relevant operational experience (operators, aircraft, type of operation: airline, business aviation, cargo, instruction), tied to what the company does.
5. Motivation specific to this company and base, without inventing facts about the company beyond what the offer says.
6. Availability and closing with a polite call to an interview, then the sign-off and the pilot's name.

Output only the letter text, ready to paste, starting with the salutation. No subject line, no address block, no commentary.`;

export async function POST(req: Request) {
  const user = await userFrom(req).catch(() => null);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const db = adminDb();
  if (!db) return Response.json({ error: "not_configured" }, { status: 503 });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "not_configured" }, { status: 503 });

  // Max plan (or admin): checked on the server from the account, not from what the app says
  const { data: p } = await db.from("pilots").select("created_at, subscription_tier, subscription_expires_at").eq("id", user.id).maybeSingle();
  const access = accessFor(
    p ? { createdAt: p.created_at, subscriptionTier: p.subscription_tier, subscriptionExpiresAt: p.subscription_expires_at } : undefined,
    { signedIn: true },
  );
  if (!(access.plan === "premium" && !access.demo) && !isAdminId(user.id)) return Response.json({ error: "plan" }, { status: 403 });
  if (rateLimited(`letter:${user.id}`, 20)) return Response.json({ error: "rate_limited" }, { status: 429 });

  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  // the six ICAO languages
  const LANGS: Record<string, string> = { en: "English", fr: "French", es: "Spanish", ru: "Russian", zh: "Simplified Chinese", ar: "Arabic" };
  const locale = typeof b?.locale === "string" && LANGS[b.locale] ? b.locale : "fr";
  const job = (b?.job ?? {}) as Record<string, unknown>;
  const company = clip(job.company, 120);
  const title = clip(job.title, 200);
  const adText = clip(job.text, 12000);
  if (!adText && !(company && title)) return Response.json({ error: "bad_request" }, { status: 400 });

  const userMessage = [
    `Language of the letter: ${LANGS[locale]}.`,
    "",
    "<job_offer>",
    `Company: ${company || "(see ad text)"}`,
    `Position: ${title || "(see ad text)"}`,
    job.location ? `Location / base: ${clip(job.location, 120)}` : "",
    Array.isArray(job.aircraft) && job.aircraft.length ? `Aircraft (ICAO): ${job.aircraft.slice(0, 8).map((x) => clip(x, 10)).join(", ")}` : "",
    job.requirements ? `Requirements (structured): ${json(job.requirements, 3000)}` : "",
    adText ? `Full ad text, as published:\n${adText}` : "",
    "</job_offer>",
    "",
    "<pilot_profile>",
    json(b?.pilot, 12000),
    "</pilot_profile>",
    clip(b?.notes, 1500) ? `\n<pilot_notes>\n${clip(b?.notes, 1500)}\n</pilot_notes>` : "",
    "",
    "Write the cover letter.",
  ]
    .filter((l) => l !== "")
    .join("\n");

  const client = new Anthropic();
  try {
    const msg = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: SYSTEM,
      messages: [{ role: "user", content: userMessage }],
    });
    if (msg.stop_reason === "refusal") return Response.json({ error: "refused" }, { status: 422 });
    const letter = msg.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("")
      .trim();
    if (!letter) return Response.json({ error: "empty" }, { status: 502 });
    return Response.json({ letter }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return Response.json({ error: "busy" }, { status: 429 });
    if (e instanceof Anthropic.APIError) return Response.json({ error: "upstream", status: e.status }, { status: 502 });
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}
