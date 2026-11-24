import { POSTS } from "@/content/blog";
import { absolute } from "@/lib/seo";
import { SITE } from "@/config/site";

export const dynamic = "force-static";

/**
 * /llms.txt — a plain summary of Geardown for AI assistants and search tools (llmstxt.org): what it is, what it
 * does, its prices, and the pages worth reading. Kept factual: no claim the app does not make elsewhere.
 */
export function GET() {
  const p = SITE.pricing;
  const lines = [
    "# Geardown",
    "",
    "> Geardown is an electronic pilot logbook for airline, business and general aviation pilots, on the web, with an iPhone app in preparation. It keeps the logbook right column by column (EASA, FAA and CASA formats), works out night time, tracks licences, medical and recency, flight time limitations (EASA ORO.FTL and EU-OPS Subpart Q) and builds a pilot CV.",
    "",
    "Geardown is an aid: the pilot remains responsible for the accuracy of their logbook. It is not affiliated with any aviation authority.",
    "",
    "## Features",
    "- Import an existing logbook: Excel and CSV exports, LogTen, Safelog, CrewLounge, roster PDFs, or photos of paper logbook pages; the totals are checked before import.",
    "- Logbook columns filled for each flight: night time from civil twilight along the route, IFR, single-pilot or multi-pilot, PIC, PICUS, SIC, page totals and carry-forward.",
    "- Exports in EASA, FAA and CASA layouts, as PDF, CSV or Excel, at any time, including after the subscription ends.",
    "- Flight time limitations: flight and duty time over 7 days, 14 days, 28 days, the calendar year and 12 months, from the logbook and roster.",
    "- Licences, medical and ratings with expiry reminders; recent experience checked with each flight.",
    "- Signatures: a saved signature to sign flights, or a request to a captain or instructor to sign.",
    "- Flightmap: routes, airports, nautical miles and countries visited, shareable as an image.",
    "- Fill a flight from its registration: airports and actual times found from ADS-B data or FlightAware.",
    "- Pilot CV and job offers sorted by the pilot's experience, type and licences.",
    "",
    "## Pricing",
    `- Free trial: ${p.trialDays} days, no card.`,
    `- Basic: €${p.basic.monthly ?? "—"} a month or €${p.basic.yearly} a year.`,
    `- Max (rosters, FTL, layovers, radar, tracks, audit, CV and jobs): €${p.premium.monthly ?? "—"} a month or €${p.premium.yearly} a year.`,
    "",
    "## Pages",
    `- [Home](${absolute("/", "en")})`,
    `- [Features](${absolute("/fonctionnalites", "en")})`,
    `- [Pricing](${absolute("/tarifs", "en")})`,
    `- [For airlines](${absolute("/compagnies", "en")})`,
    `- [Your data](${absolute("/vos-donnees", "en")}): what is stored and how to export or delete it`,
    "",
    "## Free tools (no account)",
    `- [Night time calculator](${absolute("/outils/heures-de-nuit", "en")}): night time of a flight from the airports and block times, civil twilight along the route`,
    `- [Maximum FDP calculator](${absolute("/outils/fdp-maximum", "en")}): EASA ORO.FTL.205 and Subpart Q maximum flight duty period, with the full table`,
    `- [Recency calculator](${absolute("/outils/experience-recente", "en")}): until when you may carry passengers, from your recent takeoffs and landings (EASA FCL.060(b))`,
    "",
    "## Articles",
    ...POSTS.map((x) => `- [${x.en.title}](${absolute({ pathname: "/blog/[slug]", params: { slug: x.slug } }, "en")}): ${x.en.excerpt}`),
    "",
    "## Contact",
    `- ${SITE.contactEmail}`,
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
