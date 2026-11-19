import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { badgeEmblemSvg, DISCOVERY_SERIES, HOUR_LEVELS, hoursLabel, rankStripes, tierOfRank, wingsSvg, type DiscoveryId } from "@cielo/core";
import { TIER_COLORS, epauletteSvg } from "@/lib/badgeArt";
import en from "../../../../messages/en.json";
import fr from "../../../../messages/fr.json";

export const runtime = "nodejs";

/**
 * The image a pilot shares for an achievement (Instagram portrait 1080×1350, or square 1080×1080).
 * Everything shown comes from the query, chosen by the pilot: nothing is read from their account.
 *  ?type=badge&id=firstNight | ?type=level&h=1500, &on=2026-11-04, &name=, &rank=, &hrs=, &ap=, &ct=, &nm=, &lang=fr|en,
 *  &fmt=square | og (1200×630 link preview). Drawn at twice the size (HD): 2160×2700, 2160×2160, 2400×1260.
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
  // the Geardown wordmark: GEAR bold, D, the O drawn as the three greens in a ring, WN
  const fs = u(36);
  const ls = fs * 0.18;
  const brand = (
    <div style={{ display: "flex", alignItems: "center", fontSize: fs, lineHeight: 1, color: "#fff" }}>
      <div style={{ display: "flex", fontWeight: 700, letterSpacing: ls }}>GEAR</div>
      <div style={{ display: "flex", fontWeight: 400, marginRight: ls }}>D</div>
      <svg width={fs * 1.3} height={fs * 1.3} viewBox="0 0 40 40" style={{ marginRight: ls }}>
        <circle cx="20" cy="20" r="17.3" stroke="#ffffff" strokeWidth="3.4" fill="none" />
        <circle cx="20" cy="13.4" r="4.6" fill="#22C55E" />
        <circle cx="14" cy="23.8" r="4.6" fill="#22C55E" />
        <circle cx="26" cy="23.8" r="4.6" fill="#22C55E" />
      </svg>
      <div style={{ display: "flex", fontWeight: 400, letterSpacing: ls }}>WN</div>
    </div>
  );
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
