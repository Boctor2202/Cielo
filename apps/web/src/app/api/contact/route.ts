import { SITE } from "@/config/site";
import { adminDb } from "@/lib/server/admin";
import { rateLimited } from "@/lib/places";

export const dynamic = "force-dynamic";

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * POST /api/contact {name, email, message, company?} — the public contact form. The message is kept with the
 * other feedback (admin page, kind "idea", context.source "contact") and, when RESEND_API_KEY is set, also
 * e-mailed to the contact address with Reply-To set to the sender. `company` is a hidden honeypot field.
 */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(`contact:${ip}`, 5)) return Response.json({ error: "rate_limited" }, { status: 429 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = clip(b?.name, 120);
  const email = clip(b?.email, 200);
  const message = clip(b?.message, 3500);
  if (!name || !EMAIL.test(email) || !message) return Response.json({ error: "bad_request" }, { status: 400 });
  // bots fill every field: pretend it worked
  if (clip(b?.company, 200)) return Response.json({ ok: true });

  let stored = false;
  const db = adminDb();
  if (db) {
    const { error } = await db.from("feedback").insert({
      kind: "idea",
      message: `[Contact] ${name} <${email}>\n\n${message}`,
      page: "/contact",
      platform: "web",
      user_agent: req.headers.get("user-agent")?.slice(0, 300),
      context: { source: "contact", name, email },
    });
    stored = !error;
  }

  let mailed = false;
  const key = process.env.RESEND_API_KEY;
  if (key) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `Geardown <${process.env.CONTACT_FROM ?? "noreply@geardown.app"}>`,
        to: [process.env.CONTACT_TO ?? SITE.contactEmail],
        reply_to: email,
        subject: `Contact Geardown — ${name}`,
        text: `${message}\n\n— ${name} <${email}>`,
        html: `<p style="white-space:pre-wrap">${esc(message)}</p><p>— ${esc(name)} &lt;${esc(email)}&gt;</p>`,
      }),
    }).catch(() => null);
    mailed = !!r?.ok;
  }

  if (!stored && !mailed) return Response.json({ error: "server" }, { status: 502 });
  return Response.json({ ok: true });
}
