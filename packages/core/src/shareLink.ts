/**
 * The public link of a shared achievement: the share image's settings packed in the path, so the page needs no
 * storage. Its preview (Open Graph) is the image, which every network shows with the link.
 */
// map cards also carry their routes (r), flights (fl), period (per) and aircraft type (ty), light look (th)
const ALLOWED = ["type", "id", "h", "on", "name", "rank", "hrs", "ap", "ct", "nm", "lang", "r", "fl", "per", "ty", "th"];

/** The public page of a shared achievement, e.g. https://geardown.app/fr/b/dHlwZT1… */
export const shareLinkUrl = (site: string, lang: string, params: URLSearchParams | Record<string, string>) => `${site.replace(/\/$/, "")}/${lang === "fr" ? "fr" : "en"}/b/${packShare(params)}`;

export function packShare(params: URLSearchParams | Record<string, string>): string {
  const q = new URLSearchParams(params as Record<string, string>);
  for (const k of [...q.keys()]) if (!ALLOWED.includes(k) || !q.get(k)) q.delete(k);
  const bytes = new TextEncoder().encode(q.toString());
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function unpackShare(p: string): URLSearchParams | null {
  try {
    const b64 = p.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    const s = new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
    const q = new URLSearchParams(s);
    for (const k of [...q.keys()]) if (!ALLOWED.includes(k)) q.delete(k);
    return q.get("type") ? q : null;
  } catch {
    return null;
  }
}

/** A short id (10 characters) stands for settings kept on the server; a long one carries them itself. */
export const isShortShareId = (p: string) => /^[A-Za-z0-9_-]{10}$/.test(p);

/**
 * The public link of a share, short (geardown.app/fr/b/Xk3pQ9aZ2m): the settings are kept by the server under a
 * short id. If the server cannot be reached, the long link (settings in the path) still works.
 */
export async function createShareLink(site: string, lang: string, params: URLSearchParams | Record<string, string>): Promise<string> {
  const base = site.replace(/\/$/, "");
  const packed = packShare(params);
  try {
    const r = await fetch(`${base}/api/share-link`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p: packed }) });
    const d = r.ok ? ((await r.json()) as { id?: string }) : {};
    if (d.id && isShortShareId(d.id)) return `${base}/${lang === "fr" ? "fr" : "en"}/b/${d.id}`;
  } catch {
    // the long link below
  }
  return `${base}/${lang === "fr" ? "fr" : "en"}/b/${packed}`;
}
