import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { feedUrl } from "@cielo/core";
import { rateLimited } from "@/lib/places";
import { userFrom } from "@/lib/server/admin";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Fetches a calendar the pilot subscribed to (iCloud, Google, Outlook, a crew portal's webcal link) for the web
 * and the app: those servers do not let a browser read them directly. Only public internet addresses are fetched
 * (no private or local network), at most 5 MB, and the response must be an iCal calendar.
 */

const MAX = 5 * 1024 * 1024;

function privateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number) as [number, number];
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return privateIp(v.slice(7));
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb");
}

async function publicHost(host: string): Promise<boolean> {
  if (isIP(host)) return !privateIp(host);
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) return false;
  const addrs = await lookup(host, { all: true }).catch(() => []);
  return addrs.length > 0 && addrs.every((a) => !privateIp(a.address));
}

export async function GET(req: Request) {
  const user = await userFrom(req).catch(() => null);
  if (!user) return Response.json({ error: "signin" }, { status: 401 });
  if (rateLimited(`calfeed:${user.id}`, 120, 3_600_000)) return Response.json({ error: "rate_limited" }, { status: 429 });
  let url = feedUrl(new URL(req.url).searchParams.get("url") ?? "");
  if (!url) return Response.json({ error: "bad_url" }, { status: 400 });
  try {
    // redirects followed by hand, each address checked again
    for (let hop = 0; hop < 4; hop++) {
      const u = new URL(url);
      if (!(await publicHost(u.hostname))) return Response.json({ error: "bad_url" }, { status: 400 });
      const r: Response = await fetch(url, { redirect: "manual", headers: { Accept: "text/calendar, text/plain;q=0.8, */*;q=0.5", "User-Agent": "Geardown calendar sync" }, signal: AbortSignal.timeout(15_000) });
      if (r.status >= 300 && r.status < 400 && r.headers.get("location")) {
        url = new URL(r.headers.get("location")!, url).toString();
        continue;
      }
      if (r.status === 401 || r.status === 403 || r.status === 404) return Response.json({ error: "not_found" }, { status: 404 });
      if (!r.ok || !r.body) return Response.json({ error: "upstream" }, { status: 502 });
      const reader = r.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX) return Response.json({ error: "too_big" }, { status: 413 });
        chunks.push(value);
      }
      const text = new TextDecoder().decode(Buffer.concat(chunks));
      if (!text.includes("BEGIN:VCALENDAR")) return Response.json({ error: "not_calendar" }, { status: 422 });
      return new Response(text, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" } });
    }
    return Response.json({ error: "upstream" }, { status: 502 });
  } catch {
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}
