import Anthropic from "@anthropic-ai/sdk";
import { reportAiFailure } from "@/lib/server/anthropic";
import { accessFor, noCardTrialDays, ep5Legs, parseAirFranceEp5, parseLogTenEasa, parseFlightReport, sheetCellText, tableSignature, type LogbookLeg, type StoredMapping } from "@cielo/core";
import { adminDb, isAdminId, userFrom } from "@/lib/server/admin";
import { pdfText } from "@/lib/server/pdf";
import { extractLegs, ImportAiError, mapTable } from "@/lib/server/importAi";
import { splitPdf } from "@cielo/export";
import { pageImages } from "@/lib/server/pageImages";
import { rateLimited } from "@/lib/places";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/import-any — the universal import. Whatever the pilot has, in one door:
 *  { kind: "pdf", pdf: base64 }                 an airline statement, a logbook export
 *  { kind: "pdf", storagePath }                 the same, too large for a request: uploaded first to the pilot's
 *                                               folder of the private "imports" bucket, read once, then deleted
 *  { kind: "images", images: [{ data, type }] } photos of a paper logbook (several pages), of an ACARS screen…
 *  { kind: "text", text }                       a pasted e-mail or summary
 *  { kind: "table", header, rows }              a CSV / Excel the app could not map by itself
 *  { kind: "learn", header, mapping, source }   a table layout the pilot confirmed: kept for everyone
 *  { kind: "sheet", data: base64 }              an Excel workbook (.xlsx) read into a table, for the phone app
 * with share: true when the pilot agrees to send an unknown layout so a dedicated reader can be written.
 * Known layouts are read without AI on every plan; anything else is read by Claude (Max plan).
 */

const MAX_IMAGES = 12;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(req: Request) {
  const user = await userFrom(req).catch(() => null);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "bad_request" }, { status: 400 });
  const db = adminDb();
  const today = new Date().toISOString().slice(0, 10);
  const kind = body.kind;
  const share = body.share === true;
  const fileName = typeof body.fileName === "string" ? body.fileName.slice(0, 120) : null;
  /**
   * A failed import, kept for the team (feedback, kind "error"): what was sent and what went wrong, never the
   * document itself, so readers can be fixed without asking the pilot.
   */
  const logImport = async (code: string, extra: Record<string, unknown> = {}) => {
    if (!db) return;
    const images = Array.isArray(body.images) ? (body.images as { data?: unknown }[]) : [];
    const context = {
      kind: String(kind),
      code,
      images: images.length || undefined,
      bytes: images.length ? images.map((i) => (typeof i.data === "string" ? Math.round((i.data.length * 3) / 4) : 0)) : typeof body.pdf === "string" ? Math.round((body.pdf.length * 3) / 4) : typeof body.text === "string" ? body.text.length : undefined,
      ext: fileName?.match(/\.[a-z0-9]{2,5}$/i)?.[0] ?? undefined,
      ...extra,
    };
    await db
      .from("feedback")
      .insert({ pilot_id: user.id, kind: "error", message: `Import ${String(kind)}: ${code}`, page: "/api/import-any", platform: req.headers.get("x-client") === "ios" ? "ios" : "web", user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null, context, fingerprint: `import:${String(kind)}:${code}:${Date.now()}` })
      .then(() => undefined, () => undefined);
  };

  // a confirmed table layout: only column titles are stored
  if (kind === "learn") {
    const header = Array.isArray(body.header) ? (body.header as unknown[]).map((h) => String(h).slice(0, 80)).slice(0, 80) : [];
    const mapping = (body.mapping && typeof body.mapping === "object" ? body.mapping : {}) as StoredMapping;
    if (!header.length || !Object.keys(mapping).length || !db) return Response.json({ ok: false });
    const signature = tableSignature(header);
    const { data: prev } = await db.from("import_layouts").select("uses").eq("signature", signature).maybeSingle();
    await db.from("import_layouts").upsert({ signature, mapping, source: typeof body.source === "string" ? body.source.slice(0, 80) : null, uses: (prev?.uses ?? 0) + 1, updated_at: new Date().toISOString() });
    return Response.json({ ok: true });
  }

  if (rateLimited(`importany:${user.id}`, 30, 3_600_000)) {
    await logImport("rate_limited");
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  // an Excel workbook (the phone app cannot unzip it): its first sheet as a table of text cells, no AI
  if (kind === "sheet") {
    const data = typeof body.data === "string" ? body.data.replace(/\s+/g, "") : "";
    if (!data || data.length > 8_000_000 || !/^[A-Za-z0-9+/=]+$/.test(data)) return Response.json({ error: "bad_request" }, { status: 400 });
    try {
      const { readSheet } = await import("read-excel-file/node");
      const rows = (await readSheet(Buffer.from(data, "base64"))) as unknown[][];
      return Response.json({ reader: "sheet", table: rows.slice(0, 20_000).map((r) => r.map(sheetCellText)) });
    } catch {
      return Response.json({ error: "unreadable" }, { status: 422 });
    }
  }

  // 1. what we read without AI
  let text = "";
  if (kind === "text") {
    text = typeof body.text === "string" ? body.text.slice(0, 60_000) : "";
    const r = parseFlightReport(text);
    if (r?.from && r.to) {
      const leg: LogbookLeg = { date: r.date ?? today, dep: r.from, arr: r.to, out: r.out, off: r.off, on: r.on, in: r.in, registration: r.registration, flightNumber: r.flightNumber };
      return Response.json({ reader: "report", legs: [leg], takeoffBy: r.takeoffBy, landingBy: r.landingBy });
    }
  }
  let pdf = "";
  if (kind === "pdf") {
    const storagePath = typeof body.storagePath === "string" ? body.storagePath : "";
    if (storagePath) {
      // a large file: the pilot's own upload, read once and deleted
      if (!db || !storagePath.startsWith(`${user.id}/`) || storagePath.includes("..") || !/\.pdf$/i.test(storagePath)) return Response.json({ error: "bad_request" }, { status: 400 });
      const { data: file, error } = await db.storage.from("imports").download(storagePath);
      void db.storage.from("imports").remove([storagePath]);
      if (error || !file) return Response.json({ error: "unreadable" }, { status: 422 });
      pdf = Buffer.from(await file.arrayBuffer()).toString("base64");
    } else {
      pdf = typeof body.pdf === "string" ? body.pdf.replace(/\s+/g, "") : "";
      if (!pdf || pdf.length > 8_000_000 || !/^[A-Za-z0-9+/=]+$/.test(pdf)) return Response.json({ error: "bad_request" }, { status: 400 });
    }
    try {
      // a LogTen logbook prints its flights on two facing pages: a year is easily over a hundred pages
      const pages = await pdfText(Uint8Array.from(Buffer.from(pdf, "base64")), 1500);
      const ep5 = parseAirFranceEp5(pages);
      if (ep5) return Response.json({ reader: "airfrance-ep5", role: ep5.role ?? null, legs: ep5Legs(ep5) });
      // LogTen's "EASA-FCL Compliant" PDF: read without AI, checked against the page totals it prints
      const logten = parseLogTenEasa(pages);
      if (logten) return Response.json({ reader: "logten-pdf", legs: logten.legs, previous: logten.previous ?? null, checked: logten.checked });
      text = pages.map((p) => p.map((i) => i.s).join(" ")).join("\n").slice(0, 60_000);
    } catch {
      // a scanned PDF: Claude reads the images
    }
  }
  if (kind === "table") {
    const header = Array.isArray(body.header) ? (body.header as unknown[]).map((h) => String(h ?? "")).slice(0, 80) : [];
    const rows = Array.isArray(body.rows) ? (body.rows as unknown[][]).slice(0, 25).map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? "").slice(0, 80)) : [])) : [];
    if (!header.length) return Response.json({ error: "bad_request" }, { status: 400 });
    // a layout another pilot already confirmed
    if (db) {
      const { data } = await db.from("import_layouts").select("mapping, source").eq("signature", tableSignature(header)).maybeSingle();
      if (data) return Response.json({ reader: "learned", mapping: data.mapping, source: data.source });
    }
    text = [header, ...rows].map((r) => r.join("\t")).join("\n");
  }

  // 2. anything else: Claude (Max plan)
  const { data: p } = db ? await db.from("pilots").select("created_at, trial_started_at, subscription_tier, subscription_expires_at").eq("id", user.id).maybeSingle() : { data: null };
  const access = accessFor(p ? { createdAt: p.trial_started_at ?? p.created_at, subscriptionTier: p.subscription_tier, subscriptionExpiresAt: p.subscription_expires_at } : undefined, { signedIn: true, noCardTrialDays: noCardTrialDays(process.env.NEXT_PUBLIC_NO_CARD_TRIAL_DAYS) });
  if (!(access.plan === "premium" && !access.demo) && !isAdminId(user.id)) {
    await logImport("plan", { tier: p?.subscription_tier ?? null });
    return Response.json({ error: "plan" }, { status: 403 });
  }
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "unsupported" }, { status: 422 });

  // the document, kept for 90 days when the pilot shared it, to write a dedicated reader
  const keep = async (reader: string, legs: number) => {
    if (!share || !db || !text.trim()) return;
    await db.from("import_samples").insert({ pilot_id: user.id, kind: String(kind), file_name: fileName, reader, legs, content: text.slice(0, 60_000) });
    // kept 90 days at most
    await db.from("import_samples").delete().lt("created_at", new Date(Date.now() - 90 * 86_400_000).toISOString());
  };

  try {
    if (kind === "table") {
      const header = (body.header as unknown[]).map((h) => String(h ?? ""));
      const rows = (body.rows as unknown[][]).slice(0, 25).map((r) => r.map((c) => String(c ?? "")));
      const r = await mapTable(header, rows);
      await keep(`ai:${r.source}`, 0);
      return Response.json({ reader: "ai", source: r.source, mappingIndex: r.mapping });
    }
    let content: Parameters<typeof extractLegs>[0];
    if (kind === "pdf") content = [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } }];
    else if (kind === "images") {
      const images = (Array.isArray(body.images) ? body.images : []).slice(0, MAX_IMAGES) as { data?: unknown; type?: unknown }[];
      const ok = images.filter((i) => typeof i.data === "string" && i.data.length < 7_000_000 && IMAGE_TYPES.includes(String(i.type)));
      if (!ok.length) {
        await logImport("bad_request", { types: images.map((i) => String(i.type)).slice(0, 12) });
        return Response.json({ error: "bad_request" }, { status: 400 });
      }
      content = await pageImages(ok as { data: string; type: string }[]);
      text = `[${ok.length} photo(s)]`;
    } else if (kind === "text" && text.trim()) content = [{ type: "text", text: `Document:\n${text}` }];
    else return Response.json({ error: "bad_request" }, { status: 400 });
    // handwritten pages take more care to read than a printed statement
    const r = kind === "pdf" ? await extractPdfLegs(Uint8Array.from(Buffer.from(pdf, "base64")), today) : await extractLegs(content, today, kind === "images" ? "high" : "medium");
    await keep(`ai:${r.source}`, r.legs.length);
    if (!r.legs.length) await logImport("none", { reader: r.source });
    return Response.json({ reader: "ai", source: r.source, timeBasis: r.timeBasis, legs: r.legs }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof ImportAiError) {
      await logImport(e.code);
      return Response.json({ error: e.code }, { status: 422 });
    }
    if (e instanceof SyntaxError) {
      await logImport("unreadable");
      return Response.json({ error: "unreadable" }, { status: 422 });
    }
    if (e instanceof Anthropic.RateLimitError) {
      await logImport("busy");
      return Response.json({ error: "busy" }, { status: 429 });
    }
    await logImport("upstream", { detail: e instanceof Anthropic.APIError ? `${e.status} ${e.message}`.slice(0, 300) : String(e).slice(0, 300) });
    await reportAiFailure(`import ${String(kind)}`, e);
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}

/**
 * A PDF read a few pages at a time, the parts side by side: a whole logbook or a long statement holds more
 * flights than one answer can carry (it ended "too long"). A part still too long is split again, down to a page.
 */
async function extractPdfLegs(bytes: Uint8Array, today: string): Promise<Awaited<ReturnType<typeof extractLegs>>> {
  let parts: Uint8Array[];
  try {
    parts = await splitPdf(bytes, 3);
  } catch {
    // a PDF pdf-lib cannot open: sent whole, as before
    return extractLegs([{ type: "document", source: { type: "base64", media_type: "application/pdf", data: Buffer.from(bytes).toString("base64") } }], today, "medium");
  }
  const read = async (part: Uint8Array): Promise<Awaited<ReturnType<typeof extractLegs>>> => {
    try {
      return await extractLegs([{ type: "document", source: { type: "base64", media_type: "application/pdf", data: Buffer.from(part).toString("base64") } }], today, "medium");
    } catch (e) {
      if (!(e instanceof ImportAiError && e.code === "too_long")) throw e;
      const pages = await splitPdf(part, 1);
      if (pages.length < 2) throw e;
      const halves = await Promise.all(pages.map(read));
      return { source: halves[0]!.source, timeBasis: halves[0]!.timeBasis, legs: halves.flatMap((h) => h.legs) };
    }
  };
  // four parts at a time, results kept in page order
  const results: Awaited<ReturnType<typeof extractLegs>>[] = new Array(parts.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, parts.length) }, async () => {
      for (let k = next++; k < parts.length; k = next++) results[k] = await read(parts[k]!);
    }),
  );
  const first = results.find((r) => r.legs.length) ?? results[0]!;
  return { source: first.source, timeBasis: first.timeBasis, legs: results.flatMap((r) => r.legs) };
}
