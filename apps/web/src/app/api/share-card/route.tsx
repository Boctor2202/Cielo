import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { badgeEmblemSvg, decodeShareRoutes, DISCOVERY_SERIES, HOUR_LEVELS, hoursLabel, rankStripes, tierOfRank, wingsSvg, type DiscoveryId } from "@cielo/core";
import { TIER_COLORS, epauletteSvg } from "@/lib/badgeArt";
import { routeMapSvg, serverAirports, type MapPoint } from "@/lib/server/routeMapSvg";
import en from "../../../../messages/en.json";
import fr from "../../../../messages/fr.json";

export const runtime = "nodejs";

/**
 * The image a pilot shares for an achievement (Instagram portrait 1080×1350, or square 1080×1080).
 * Everything shown comes from the query, chosen by the pilot: nothing is read from their account.
 *  ?type=badge&id=firstNight | ?type=level&h=1500, &on=2026-11-04, &name=, &rank=, &hrs=, &ap=, &ct=, &nm=, &lang=fr|en,
 *  &fmt=square | og (1200×630 link preview). Drawn at twice the size (HD): 2160×2700, 2160×2160, 2400×1260.
 *  ?type=map: the pilot's route map, &r=LFPG.EGLL.3,… (routes and how often), &fl=, &ap=, &nm=, &ct= (totals),
 *  &per= (the period shown, as written by the app), &ty= (aircraft type), &th=light (the light map), &name=, &rank=.
 */

const clip = (v: string | null, n: number) => (v ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, n);
const num = (v: string | null) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n < 1e7 ? Math.floor(n) : undefined;
};
const uri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

let fonts: Promise<{ name: string; data: ArrayBuffer; weight: 400 | 600 | 700 }[]> | null = null;
/** Inter, from the site's own public files (served by the CDN), else from the disk in development. */
const loadFonts = (origin: string) =>
  (fonts ??= Promise.all(
    ([400, 600, 700] as const).map(async (w) => {
      const r = await fetch(`${origin}/fonts/cv/Inter-${w}.ttf`).catch(() => null);
      const data = r?.ok ? await r.arrayBuffer() : (await readFile(path.join(process.cwd(), "public/fonts/cv", `Inter-${w}.ttf`))).buffer as ArrayBuffer;
      return { name: "Inter", weight: w, data };
    }),
  ).catch((e) => {
    fonts = null;
    throw e;
  }));

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const lang = q.get("lang") === "fr" ? "fr" : "en";
  const B = (lang === "fr" ? fr : en).app.badges as unknown as { d: Record<string, string>; dd: Record<string, string>; title: Record<string, string>; club: string };
  const fmt = q.get("fmt") === "square" ? "square" : q.get("fmt") === "og" ? "og" : "portrait";
  if (q.get("type") === "map") return mapCard(req, q, lang, fmt);
  // everything is laid out at 1× and drawn at 2× (HD)
  const k = 2;
  const u = (n: number) => Math.round(n * k);
  const W = fmt === "og" ? 1200 : 1080;
  const H = fmt === "og" ? 630 : fmt === "square" ? 1080 : 1350;

  // what is shown big: a badge, or an hour level
  let art: string;
  let ratio: number; // height / width of the art
  let glow: string;
  let kicker: string;
  let title: string;
  let sub = "";
  let medalLabel: string | undefined;
  if (q.get("type") === "level") {
    const level = HOUR_LEVELS.find((l) => l.hours === num(q.get("h")));
    if (!level) return new Response("level", { status: 400 });
    const [from, to] = TIER_COLORS[level.tier];
    art = uri(wingsSvg({ from, to }));
    ratio = 56 / 120;
    medalLabel = hoursLabel(level.hours);
    glow = from;
    kicker = B.title[String(level.hours)] ?? "";
    title = B.club.replace("{n}", level.hours.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB").replace(/[\u202f\u00a0]/g, " "));
  } else {
    const id = q.get("id");
    const s = DISCOVERY_SERIES.find((x) => x.steps.some((st) => st.id === id));
    const rank = s ? s.steps.findIndex((st) => st.id === id) + 1 : 0;
    if (!s || !id) return new Response("badge", { status: 400 });
    const tier = tierOfRank(rank, s.steps.length);
    art = uri(badgeEmblemSvg({ series: s.series, id: id as DiscoveryId, tier, rank, of: s.steps.length }));
    ratio = 68 / 64;
    glow = TIER_COLORS[tier][0];
    kicker = lang === "fr" ? "Badge débloqué" : "Badge unlocked";
    title = B.d[id] ?? id;
    sub = B.dd[id] ?? "";
  }
  const on = /^\d{4}-\d{2}-\d{2}$/.test(q.get("on") ?? "") ? q.get("on")! : undefined;
  const date = on ? new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${on}T12:00:00Z`)) : "";
  const name = clip(q.get("name"), 40);
  const rank = clip(q.get("rank"), 40);
  const stripes = rankStripes(rank);
  // French groups thousands with a narrow no-break space, which Inter does not have here
  const nf = (n: number) => n.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB").replace(/[\u202f\u00a0]/g, " ");
  const stats = [
    { v: num(q.get("hrs")), l: lang === "fr" ? "heures de vol" : "flight hours" },
    { v: num(q.get("ap")), l: lang === "fr" ? "aérodromes" : "airports" },
    { v: num(q.get("ct")), l: lang === "fr" ? "pays" : "countries" },
    { v: num(q.get("nm")), l: "NM" },
  ].filter((x) => x.v !== undefined && x.v > 0);

  const isLevel = q.get("type") === "level";
  const artW = fmt === "og" ? (isLevel ? 420 : 400) : isLevel ? (fmt === "square" ? 760 : 880) : fmt === "square" ? 420 : 520;
  const artH = artW * ratio;
  const brand = brandMark(u);
  const artBlock = (
    <div style={{ display: "flex", position: "relative" }}>
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={art} width={u(artW)} height={u(artH)} />
      {medalLabel ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: u((artH * 27) / 56 - artW * 0.045), height: u(artW * 0.09), display: "flex", alignItems: "center", justifyContent: "center", fontSize: u(artW * (medalLabel.length > 3 ? 0.062 : 0.075)), fontWeight: 700, color: "rgba(10,22,38,.82)" }}>{medalLabel}</div>
      ) : null}
    </div>
  );
  const pilot = (
    <div style={{ display: "flex", alignItems: "center", gap: u(20) }}>
      {stripes ? (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        <img src={uri(epauletteSvg(stripes))} height={u(60)} width={u(((14 + stripes * 5.5 + 4) / 22) * 60)} />
      ) : null}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {name ? <div style={{ fontSize: u(34), fontWeight: 700 }}>{name}</div> : null}
        {rank ? <div style={{ fontSize: u(24), color: "rgba(255,255,255,.6)" }}>{rank}</div> : null}
      </div>
    </div>
  );
  const statRow = stats.length ? (
    <div style={{ display: "flex", gap: u(22) }}>
      {stats.map((x) => (
        <div key={x.l} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: `${u(18)}px ${u(26)}px`, borderRadius: u(24), background: "rgba(255,255,255,.07)", border: `${u(1)}px solid rgba(255,255,255,.12)` }}>
          <div style={{ fontSize: u(40), fontWeight: 700 }}>{nf(x.v!)}</div>
          <div style={{ fontSize: u(20), color: "rgba(255,255,255,.6)", marginTop: u(4) }}>{x.l}</div>
        </div>
      ))}
    </div>
  ) : null;
  const bg = "linear-gradient(160deg, #0B1A2E 0%, #050B16 60%, #02040B 100%)";

  const tree =
    fmt === "og" ? (
      // the link preview: the badge on the left, the words on the right
      <div style={{ width: u(W), height: u(H), display: "flex", alignItems: "center", background: bg, color: "#fff", fontFamily: "Inter", position: "relative", padding: `0 ${u(70)}px` }}>
        <div style={{ position: "absolute", top: u(-80), left: u(-60), width: u(720), height: u(720), borderRadius: u(360), background: `radial-gradient(circle, ${glow}55 0%, ${glow}00 65%)`, display: "flex" }} />
        <div style={{ display: "flex", width: u(440), justifyContent: "center" }}>{artBlock}</div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: u(50), gap: u(14) }}>
          {brand}
          <div style={{ display: "flex", fontSize: u(22), fontWeight: 700, letterSpacing: u(5), color: glow, textTransform: "uppercase", marginTop: u(18) }}>{kicker}</div>
          <div style={{ display: "flex", fontSize: u(title.length > 16 ? 52 : 62), fontWeight: 700, lineHeight: 1.05, whiteSpace: "nowrap" }}>{title}</div>
          {sub ? <div style={{ display: "flex", fontSize: u(26), color: "rgba(255,255,255,.72)" }}>{sub}</div> : null}
          {date ? <div style={{ display: "flex", fontSize: u(22), color: "rgba(255,255,255,.55)" }}>{date}</div> : null}
          <div style={{ display: "flex", marginTop: u(22) }}>{pilot}</div>
          <div style={{ display: "flex", fontSize: u(24), color: "#22C55E", fontWeight: 600, marginTop: u(6) }}>geardown.app</div>
        </div>
      </div>
    ) : (
      <div style={{ width: u(W), height: u(H), display: "flex", flexDirection: "column", alignItems: "center", background: bg, color: "#fff", fontFamily: "Inter", position: "relative" }}>
        <div style={{ position: "absolute", top: u(fmt === "square" ? 120 : 170), left: u(W / 2 - 380), width: u(760), height: u(760), borderRadius: u(380), background: `radial-gradient(circle, ${glow}55 0%, ${glow}00 65%)`, display: "flex" }} />
        <div style={{ display: "flex", marginTop: u(64) }}>{brand}</div>
        <div style={{ display: "flex", marginTop: u(fmt === "square" ? 18 : 40) }}>{artBlock}</div>
        <div style={{ display: "flex", fontSize: u(26), fontWeight: 700, letterSpacing: u(6), color: glow, marginTop: u(18), textTransform: "uppercase" }}>{kicker}</div>
        <div style={{ display: "flex", fontSize: u(76), fontWeight: 700, marginTop: u(8), textAlign: "center", maxWidth: u(940), lineHeight: 1.05 }}>{title}</div>
        {sub ? <div style={{ display: "flex", fontSize: u(32), color: "rgba(255,255,255,.72)", marginTop: u(14), textAlign: "center", maxWidth: u(900) }}>{sub}</div> : null}
        {date ? <div style={{ display: "flex", fontSize: u(26), color: "rgba(255,255,255,.55)", marginTop: u(14) }}>{date}</div> : null}
        <div style={{ display: "flex", flex: 1 }} />
        {statRow ? <div style={{ display: "flex", marginBottom: u(34) }}>{statRow}</div> : null}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: u(W - 140), paddingTop: u(28), paddingBottom: u(56), borderTop: `${u(1)}px solid rgba(255,255,255,.14)` }}>
          {pilot}
          <div style={{ fontSize: u(26), color: "#22C55E", fontWeight: 600 }}>geardown.app</div>
        </div>
      </div>
    );

  return new ImageResponse(tree, { width: u(W), height: u(H), fonts: await loadFonts(new URL(req.url).origin), headers: { "Cache-Control": "public, max-age=86400" } });
}

/** The Geardown wordmark: GEAR bold, D, the O drawn as the three greens in a ring, WN. */
function brandMark(u: (n: number) => number, size = 36, color = "#fff") {
  const fs = u(size);
  const ls = fs * 0.18;
  return (
    <div style={{ display: "flex", alignItems: "center", fontSize: fs, lineHeight: 1, color }}>
      <div style={{ display: "flex", fontWeight: 700, letterSpacing: ls }}>GEAR</div>
      <div style={{ display: "flex", fontWeight: 400, marginRight: ls }}>D</div>
      <svg width={fs * 1.3} height={fs * 1.3} viewBox="0 0 40 40" style={{ marginRight: ls }}>
        <circle cx="20" cy="20" r="17.3" stroke={color} strokeWidth="3.4" fill="none" />
        <circle cx="20" cy="13.4" r="4.6" fill="#22C55E" />
        <circle cx="14" cy="23.8" r="4.6" fill="#22C55E" />
        <circle cx="26" cy="23.8" r="4.6" fill="#22C55E" />
      </svg>
      <div style={{ display: "flex", fontWeight: 400, letterSpacing: ls }}>WN</div>
    </div>
  );
}

/** The route map card: the routes flown on the map, the four totals under it, the pilot and geardown.app. */
async function mapCard(req: Request, q: URLSearchParams, lang: "fr" | "en", fmt: "portrait" | "square" | "og") {
  const k = 2;
  const u = (n: number) => Math.round(n * k);
  const W = fmt === "og" ? 1200 : 1080;
  const H = fmt === "og" ? 630 : fmt === "square" ? 1080 : 1350;
  const origin = new URL(req.url).origin;
  // the map's light or dark look, as chosen on the map
  const light = q.get("th") === "light";
  const P = light
    ? { bg: "#E6EDF4", bgA: "rgba(230,237,244,0)", text: "#0A1626", soft: "rgba(10,22,38,.6)", tile: "rgba(255,255,255,.85)", tileLine: "rgba(10,22,38,.10)", rule: "rgba(10,22,38,.14)", label: "#ffffff", labelBg: "rgba(10,22,38,.78)", kick: "#16A34A", water: "#E6EDF4" }
    : { bg: "#050B16", bgA: "rgba(5,11,22,0)", text: "#ffffff", soft: "rgba(255,255,255,.6)", tile: "rgba(255,255,255,.07)", tileLine: "rgba(255,255,255,.12)", rule: "rgba(255,255,255,.14)", label: "#ffffff", labelBg: "rgba(5,12,24,.72)", kick: "#4ade80", water: "#050B16" };
  const idx = await serverAirports(origin);
  const pts = new Map<string, MapPoint>();
  const routes = decodeShareRoutes(q.get("r")).flatMap((r) => {
    const A = idx.get(r.a);
    const B = idx.get(r.b);
    if (!A || !B) return [];
    for (const x of [A, B]) {
      const p = pts.get(x.icao) ?? { icao: x.icao, lat: x.lat, lon: x.lon, n: 0 };
      p.n += r.n;
      pts.set(x.icao, p);
    }
    return [{ a: pts.get(A.icao)!, b: pts.get(B.icao)!, n: r.n }];
  });
  const points = [...pts.values()];
  // the map's box, in the card
  const mapW = fmt === "og" ? 700 : W;
  const mapH = fmt === "og" ? H : fmt === "square" ? 640 : 860;
  const mapTop = fmt === "og" ? 0 : fmt === "square" ? 130 : 150;
  const { svg, dots } = routeMapSvg(routes, points, u(mapW), u(mapH), k, light);
  // the codes of the busiest airports, never one over another
  const busiest: typeof dots = [];
  for (const d of dots.slice().sort((a, b) => b.n - a.n)) {
    if (busiest.length >= 6) break;
    if (d.x < u(50) || d.x > u(mapW - 50) || d.y < u(30) || d.y > u(mapH - 40)) continue;
    if (busiest.some((o) => Math.abs(o.x - d.x) < u(96) && Math.abs(o.y - d.y) < u(40))) continue;
    busiest.push(d);
  }

  const nf = (n: number) => n.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB").replace(/[\u202f\u00a0]/g, " ");
  const name = clip(q.get("name"), 40);
  const rank = clip(q.get("rank"), 40);
  const per = clip(q.get("per"), 30);
  const ty = clip(q.get("ty"), 8);
  const kicker = [lang === "fr" ? "Ma carte des vols" : "My flight map", per, ty].filter(Boolean).join(" · ");
  const fr = lang === "fr";
  const stats = [
    { v: num(q.get("fl")) ?? 0, l: fr ? "vols" : "flights" },
    { v: num(q.get("ap")) ?? points.length, l: fr ? "aéroports" : "airports" },
    { v: num(q.get("nm")) ?? 0, l: fr ? "NM parcourus" : "NM flown" },
    { v: num(q.get("ct")) ?? 0, l: fr ? "pays" : "countries" },
  ];
  const stripes = rankStripes(rank);
  const pilot = (
    <div style={{ display: "flex", alignItems: "center", gap: u(18) }}>
      {stripes ? (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        <img src={uri(epauletteSvg(stripes))} height={u(52)} width={u(((14 + stripes * 5.5 + 4) / 22) * 52)} />
      ) : null}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {name ? <div style={{ fontSize: u(30), fontWeight: 700 }}>{name}</div> : null}
        {rank ? <div style={{ fontSize: u(22), color: P.soft }}>{rank}</div> : null}
      </div>
    </div>
  );
  const map = (
    <div style={{ display: "flex", position: "relative", width: u(mapW), height: u(mapH) }}>
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={uri(svg)} width={u(mapW)} height={u(mapH)} />
      {busiest.map((d) => (
        <div key={d.icao} style={{ position: "absolute", left: Math.round(d.x - u(40)), top: Math.round(d.y + d.r + u(4)), width: u(80), display: "flex", justifyContent: "center" }}>
          <div style={{ display: "flex", fontSize: u(17), fontWeight: 700, letterSpacing: u(1), color: P.label, background: P.labelBg, borderRadius: u(8), padding: `${u(2)}px ${u(8)}px` }}>{d.icao}</div>
        </div>
      ))}
      {/* the map melts into the card at its edges */}
      {fmt === "og" ? (
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: u(160), display: "flex", background: `linear-gradient(90deg, ${P.bgA}, ${P.bg})` }} />
      ) : (
        <>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: u(130), display: "flex", background: `linear-gradient(180deg, ${P.bg}, ${P.bgA})` }} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: u(240), display: "flex", background: `linear-gradient(0deg, ${P.bg}, ${P.bgA})` }} />
        </>
      )}
    </div>
  );
  const tile = (x: { v: number; l: string }, wide: boolean) => (
    <div key={x.l} style={{ display: "flex", flexDirection: "column", alignItems: wide ? "center" : "flex-start", justifyContent: "center", flex: 1, padding: `${u(16)}px ${u(18)}px`, borderRadius: u(22), background: P.tile, border: `${u(1)}px solid ${P.tileLine}` }}>
      <div style={{ display: "flex", whiteSpace: "nowrap", fontSize: u((wide ? 50 : 40) * Math.min(1, 6 / Math.max(6, nf(x.v).length))), fontWeight: 700, color: P.text }}>{nf(x.v)}</div>
      <div style={{ display: "flex", fontSize: u(wide ? 21 : 19), color: P.soft, marginTop: u(2) }}>{x.l}</div>
    </div>
  );
  const bg = P.water;

  const tree =
    fmt === "og" ? (
      <div style={{ width: u(W), height: u(H), display: "flex", background: bg, color: P.text, fontFamily: "Inter", position: "relative" }}>
        {map}
        <div style={{ position: "absolute", left: u(640), top: 0, bottom: 0, right: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: `0 ${u(50)}px 0 ${u(20)}px`, gap: u(16) }}>
          {brandMark(u, 30, P.text)}
          <div style={{ display: "flex", fontSize: u(20), fontWeight: 700, letterSpacing: u(4), color: P.kick, textTransform: "uppercase" }}>{kicker}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: u(12) }}>
            {stats.map((x) => (
              <div key={x.l} style={{ display: "flex", width: u(232) }}>{tile(x, false)}</div>
            ))}
          </div>
          {name ? pilot : null}
          <div style={{ display: "flex", fontSize: u(22), color: "#22C55E", fontWeight: 600 }}>geardown.app</div>
        </div>
      </div>
    ) : (
      <div style={{ width: u(W), height: u(H), display: "flex", flexDirection: "column", background: bg, color: P.text, fontFamily: "Inter", position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: u(mapTop), display: "flex" }}>{map}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: `${u(52)}px ${u(64)}px 0` }}>
          {brandMark(u, 32, P.text)}
          <div style={{ display: "flex", fontSize: u(20), fontWeight: 700, letterSpacing: u(4), color: P.kick, textTransform: "uppercase" }}>{kicker}</div>
        </div>
        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", gap: u(14), padding: `0 ${u(56)}px`, marginBottom: u(30) }}>{stats.map((x) => tile(x, true))}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: `0 ${u(64)}px`, paddingTop: u(24), paddingBottom: u(fmt === "square" ? 40 : 52), borderTop: `${u(1)}px solid ${P.rule}`, minHeight: u(70) }}>
          {pilot}
          <div style={{ display: "flex", fontSize: u(26), color: "#22C55E", fontWeight: 600 }}>geardown.app</div>
        </div>
      </div>
    );

  return new ImageResponse(tree, { width: u(W), height: u(H), fonts: await loadFonts(origin), headers: { "Cache-Control": "public, max-age=86400" } });
}
