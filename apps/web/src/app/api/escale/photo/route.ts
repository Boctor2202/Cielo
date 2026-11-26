import { rateLimited } from "@/lib/places";
import { meteredFetch } from "@/lib/server/usage";

export const dynamic = "force-dynamic";

/**
 * GET /api/escale/photo?name=places/…/photos/… → the place's photo, by redirect to Google's image URL.
 * Fetched only when a card is shown (each image is one Place Photo request); the redirect is cached briefly only,
 * since Google's photo URLs are not to be kept.
 */
export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get("name") ?? "";
  if (!/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(name)) return new Response("bad request", { status: 400 });
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return new Response("not configured", { status: 503 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(`photo:${ip}`, 120)) return new Response("rate limited", { status: 429 });
  const r = await meteredFetch("google", "photo", `https://places.googleapis.com/v1/${name}/media?maxWidthPx=640&skipHttpRedirect=true`, { headers: { "X-Goog-Api-Key": key }, cache: "no-store" });
  if (!r.ok) return new Response("upstream", { status: 502 });
  const { photoUri } = (await r.json()) as { photoUri?: string };
  if (!photoUri) return new Response("no photo", { status: 404 });
  return new Response(null, { status: 302, headers: { Location: photoUri, "Cache-Control": "public, max-age=600, s-maxage=600" } });
}
