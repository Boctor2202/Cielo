import { createHash, randomBytes } from "node:crypto";
import { adminDb, userFrom } from "@/lib/server/admin";
import { rateLimited } from "@/lib/places";
import { canSign, contentHash, flightFromRow, snapshot } from "@/lib/server/crew";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Signature by link, for a captain / instructor / examiner without a Geardown account.
 *  POST /api/sign-link { action: "create", flightIds[], signerName, signerRole, email?, locale } (the pilot, Max)
 *      → { url, expiresAt, mailed } — the link is shown once; only its SHA-256 is stored.
 *  GET  /api/sign-link?token=… (public) → what the signer sees: the pilot's name and the flights.
 *  POST /api/sign-link { action: "sign", token, name, licence?, image } (public) → signs every flight still
 *      unchanged since the link was made, and locks it.
 *  POST /api/sign-link { action: "refuse", token, reason? } (public)
 *  POST /api/sign-link { action: "revoke", id } (the pilot)
 */

const DAYS = 14;
const clip = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const ipOf = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
const ROLES = ["instructor", "captain", "examiner", "other"] as const;

type LinkFlight = { flightId: string; flight: ReturnType<typeof snapshot>; hash: string };

async function linkBy(token: string) {
  const db = adminDb();
  if (!db || token.length < 20) return null;
  const { data } = await db.from("signature_links").select("*").eq("token_hash", sha(token)).maybeSingle();
  return data;
}

export async function GET(req: Request) {
  if (rateLimited(`sign-link:${ipOf(req)}`, 30)) return Response.json({ error: "rate_limited" }, { status: 429 });
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const l = await linkBy(token);
  if (!l) return Response.json({ error: "not_found" }, { status: 404 });
  const db = adminDb()!;
  const { data: p } = await db.from("pilots").select("full_name, display_name").eq("id", l.requester_id).maybeSingle();
  const expired = l.status === "open" && Date.parse(l.expires_at) < Date.now();
  return Response.json({
    status: expired ? "expired" : l.status,
    pilot: p?.display_name || p?.full_name || "—",
    signerName: l.signer_name,
    signerRole: l.signer_role,
    expiresAt: l.expires_at,
    flights: (l.flights as LinkFlight[]).map((f) => f.flight),
    signedCount: l.signed_count ?? 0,
  });
}

export async function POST(req: Request) {
  const db = adminDb();
  if (!db) return Response.json({ error: "not_configured" }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const now = new Date().toISOString();

  if (body.action === "create" || body.action === "revoke") {
    const user = await userFrom(req).catch(() => null);
    if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
    if (body.action === "revoke") {
      await db.from("signature_links").update({ status: "revoked", updated_at: now }).eq("id", clip(body.id, 40)).eq("requester_id", user.id).eq("status", "open");
      return Response.json({ ok: true });
    }
    if (!(await canSign(db, user.id))) return Response.json({ error: "plan" }, { status: 403 });
    if (rateLimited(`sign-link-create:${user.id}`, 30, 3_600_000)) return Response.json({ error: "rate_limited" }, { status: 429 });
    const ids = (Array.isArray(body.flightIds) ? body.flightIds : []).map(String).slice(0, 300);
    const signerName = clip(body.signerName, 120);
    const role = ROLES.includes(body.signerRole as (typeof ROLES)[number]) ? (body.signerRole as string) : "captain";
    const email = clip(body.email, 200).toLowerCase();
    const locale = body.locale === "en" ? "en" : "fr";
    if (!ids.length || !signerName) return Response.json({ error: "input" }, { status: 400 });
    if (email && !EMAIL.test(email)) return Response.json({ error: "email" }, { status: 400 });

    const { data: rows } = await db.from("flights").select("*").eq("pilot_id", user.id).in("id", ids).is("deleted_at", null).is("signature_id", null);
    if (!rows?.length) return Response.json({ error: "no_flights" }, { status: 400 });
    const flights: LinkFlight[] = rows
      .map((r) => flightFromRow(r))
      .sort((a, b) => (a.date + (a.outUtc ?? "")).localeCompare(b.date + (b.outUtc ?? "")))
      .map((f) => ({ flightId: f.id, flight: snapshot(f), hash: contentHash(f) }));
    const token = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + DAYS * 86_400_000).toISOString();
    const { error } = await db.from("signature_links").insert({ requester_id: user.id, token_hash: sha(token), signer_name: signerName, signer_role: role, signer_email: email || null, flights, expires_at: expiresAt });
    if (error) return Response.json({ error: "db" }, { status: 500 });
    const url = `${SITE_URL}/${locale}/${locale === "fr" ? "signer" : "sign"}/${token}`;

    let mailed = false;
    const key = process.env.RESEND_API_KEY;
    if (email && key) {
      const { data: p } = await db.from("pilots").select("full_name, display_name").eq("id", user.id).maybeSingle();
      const pilot = p?.display_name || p?.full_name || "Geardown";
      const n = flights.length;
      const fr = locale === "fr";
      const subject = fr ? `${pilot} vous demande de signer ${n} vol${n > 1 ? "s" : ""}` : `${pilot} asks you to sign ${n} flight${n > 1 ? "s" : ""}`;
      const text = fr
        ? `Bonjour ${signerName},\n\n${pilot} vous demande de signer ${n} vol${n > 1 ? "s" : ""} de son carnet de vol Geardown. Vous pouvez vérifier chaque vol puis signer, ou refuser, sans créer de compte :\n\n${url}\n\nCe lien est valable ${DAYS} jours et ne sert qu'une fois.`
        : `Hello ${signerName},\n\n${pilot} asks you to sign ${n} flight${n > 1 ? "s" : ""} of their Geardown logbook. You can check each flight then sign, or decline, without creating an account:\n\n${url}\n\nThis link is valid for ${DAYS} days and works once.`;
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `Geardown <${process.env.CONTACT_FROM ?? "noreply@geardown.app"}>`,
          to: [email],
          subject,
          text,
          html: `<p style="white-space:pre-wrap;font-family:system-ui,sans-serif">${esc(text).replace(esc(url), `<a href="${esc(url)}">${esc(url)}</a>`)}</p>`,
        }),
      }).catch(() => null);
      mailed = !!r?.ok;
    }
    return Response.json({ url, expiresAt, mailed, flights: flights.length });
  }

  // the signer's answers (public, by token)
  if (rateLimited(`sign-link:${ipOf(req)}`, 30)) return Response.json({ error: "rate_limited" }, { status: 429 });
  const token = clip(body.token, 100);
  const l = await linkBy(token);
  if (!l) return Response.json({ error: "not_found" }, { status: 404 });
  if (l.status !== "open") return Response.json({ error: l.status }, { status: 409 });
  if (Date.parse(l.expires_at) < Date.now()) {
    await db.from("signature_links").update({ status: "expired", updated_at: now }).eq("id", l.id);
    return Response.json({ error: "expired" }, { status: 409 });
  }
  const audit = { responded_at: now, responded_ip: ipOf(req), responded_agent: clip(req.headers.get("user-agent"), 300), updated_at: now };

  if (body.action === "refuse") {
    await db.from("signature_links").update({ status: "refused", refusal: clip(body.reason, 300) || null, ...audit }).eq("id", l.id).eq("status", "open");
    return Response.json({ ok: true });
  }

  if (body.action === "sign") {
    const name = clip(body.name, 120);
    const licence = clip(body.licence, 60) || null;
    const image = typeof body.image === "string" && /^data:image\/(png|svg\+xml)[;,]/.test(body.image) && body.image.length < 400_000 ? body.image : "";
    if (!name || !image) return Response.json({ error: "input" }, { status: 400 });
    // claim the link first, so two tabs cannot sign twice
    const { data: claimed } = await db.from("signature_links").update({ status: "signed", signed_name: name, signed_licence: licence, ...audit }).eq("id", l.id).eq("status", "open").select("id");
    if (!claimed?.length) return Response.json({ error: "signed" }, { status: 409 });
    let signed = 0;
    let changed = 0;
    for (const lf of l.flights as LinkFlight[]) {
      const { data: row } = await db.from("flights").select("*").eq("id", lf.flightId).eq("pilot_id", l.requester_id).maybeSingle();
      if (!row || row.deleted_at || row.signature_id) continue;
      const f = flightFromRow(row);
      const h = contentHash(f);
      // the pilot changed the flight after sending the link: not what the signer was shown
      if (h !== lf.hash) {
        changed++;
        continue;
      }
      const { data: sig } = await db
        .from("signatures")
        .insert({ pilot_id: l.requester_id, flight_id: f.id, signer_name: name, signer_role: l.signer_role, signer_licence_number: licence, signed_at: now, image_data_url: image, content_hash: h, updated_at: now })
        .select("id")
        .single();
      if (!sig) continue;
      await db.from("flights").update({ signature_id: sig.id, locked: true, updated_at: now }).eq("id", f.id);
      signed++;
    }
    await db.from("signature_links").update({ signed_count: signed }).eq("id", l.id);
    return Response.json({ signed, changed });
  }
  return Response.json({ error: "action" }, { status: 400 });
}
