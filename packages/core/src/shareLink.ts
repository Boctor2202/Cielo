/**
 * The public link of a shared achievement: the share image's settings packed in the path, so the page needs no
 * storage. Its preview (Open Graph) is the image, which every network shows with the link.
 */
// map cards also carry their routes (r), flights (fl), period (per) and aircraft type (ty)
const ALLOWED = ["type", "id", "h", "on", "name", "rank", "hrs", "ap", "ct", "nm", "lang", "r", "fl", "per", "ty"];

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
