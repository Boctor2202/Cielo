import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { HOUR_LEVELS, rankStripes, type DiscoveryId } from "@cielo/core";
import { DISCOVERY_ICON_SVG, DISCOVERY_LOOK, TIER_COLORS, emblemSvg, epauletteSvg, medalSvg } from "@/lib/badgeArt";
import en from "../../../../messages/en.json";
import fr from "../../../../messages/fr.json";

export const runtime = "nodejs";

/**
 * The image a pilot shares for an achievement (Instagram portrait 1080×1350, or square 1080×1080).
 * Everything shown comes from the query, chosen by the pilot: nothing is read from their account.
 *  ?type=badge&id=firstNight | ?type=level&h=1500, &on=2026-11-04, &name=, &rank=, &hrs=, &ap=, &ct=, &nm=, &lang=fr|en, &fmt=square
 */

const clip = (v: string | null, n: number) => (v ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, n);
const num = (v: string | null) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n < 1e7 ? Math.floor(n) : undefined;
};
const uri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 600 | 700 }[]> | null = null;
const loadFonts = () =>
  (fonts ??= Promise.all(
    ([400, 600, 700] as const).map(async (w) => ({ name: "Inter", weight: w, data: await readFile(path.join(process.cwd(), "public/fonts/cv", `Inter-${w}.ttf`)) })),
  ));

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const lang = q.get("lang") === "fr" ? "fr" : "en";
  const B = (lang === "fr" ? fr : en).app.badges as unknown as { d: Record<string, string>; dd: Record<string, string>; title: Record<string, string>; club: string; earned: string };
  const square = q.get("fmt") === "square";
  const W = 1080;
  const H = square ? 1080 : 1350;

  // what is shown big: a badge, or an hour level
  let art: string;
  let glow: string;
  let kicker: string;
  let title: string;
  let sub: string;
  if (q.get("type") === "level") {
    const level = HOUR_LEVELS.find((l) => l.hours === num(q.get("h")));
    if (!level) return new Response("level", { status: 400 });
    art = uri(medalSvg(level.hours, level.tier));
    glow = TIER_COLORS[level.tier][0];
    kicker = B.title[String(level.hours)] ?? "";
    title = B.club.replace("{n}", level.hours.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB"));
    sub = "";
  } else {
    const id = q.get("id") as DiscoveryId;
    const look = DISCOVERY_LOOK[id];
    if (!look) return new Response("badge", { status: 400 });
    const icon = DISCOVERY_ICON_SVG[id];
    art = uri(emblemSvg(id, `<g fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${icon}</g>`));
    glow = look.from;
    kicker = lang === "fr" ? "Badge débloqué" : "Badge unlocked";
    title = B.d[id] ?? id;
    sub = B.dd[id] ?? "";
  }
  const on = /^\d{4}-\d{2}-\d{2}$/.test(q.get("on") ?? "") ? q.get("on")! : undefined;
  const date = on ? new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${on}T12:00:00Z`)) : "";
  const name = clip(q.get("name"), 40);
  const rank = clip(q.get("rank"), 40);
  const stripes = rankStripes(rank);
  const nf = (n: number) => n.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB");
  const stats = [
    { v: num(q.get("hrs")), l: lang === "fr" ? "heures de vol" : "flight hours" },
    { v: num(q.get("ap")), l: lang === "fr" ? "aérodromes" : "airports" },
    { v: num(q.get("ct")), l: lang === "fr" ? "pays" : "countries" },
    { v: num(q.get("nm")), l: "NM" },
  ].filter((s) => s.v !== undefined && s.v > 0);
  const artSize = square ? 420 : 520;

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", flexDirection: "column", alignItems: "center", background: "linear-gradient(160deg, #0B1A2E 0%, #050B16 60%, #02040B 100%)", color: "#fff", fontFamily: "Inter", position: "relative" }}>
        {/* glow of the badge's colour behind it */}
        <div style={{ position: "absolute", top: square ? 120 : 170, left: W / 2 - 380, width: 760, height: 760, borderRadius: 380, background: `radial-gradient(circle, ${glow}55 0%, ${glow}00 65%)`, display: "flex" }} />
        {/* the brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 64 }}>
          <svg width="44" height="44" viewBox="0 0 40 40">
            <circle cx="20" cy="13.5" r="5" fill="#22C55E" />
            <circle cx="11.5" cy="26.5" r="5" fill="#22C55E" />
            <circle cx="28.5" cy="26.5" r="5" fill="#22C55E" />
          </svg>
          <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: 10 }}>GEARDOWN</div>
        </div>
        <div style={{ display: "flex", marginTop: square ? 18 : 40 }}>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={art} width={artSize} height={q.get("type") === "level" ? artSize : (artSize * 68) / 64} />
        </div>
        <div style={{ display: "flex", fontSize: 26, fontWeight: 700, letterSpacing: 6, color: glow, marginTop: 18, textTransform: "uppercase" }}>{kicker}</div>
        <div style={{ display: "flex", fontSize: 76, fontWeight: 700, marginTop: 8, textAlign: "center", maxWidth: 940, lineHeight: 1.05 }}>{title}</div>
        {sub ? <div style={{ display: "flex", fontSize: 32, color: "rgba(255,255,255,.72)", marginTop: 14, textAlign: "center", maxWidth: 900 }}>{sub}</div> : null}
        {date ? <div style={{ display: "flex", fontSize: 26, color: "rgba(255,255,255,.55)", marginTop: 14 }}>{date}</div> : null}
        <div style={{ display: "flex", flex: 1 }} />
        {stats.length ? (
          <div style={{ display: "flex", gap: 22, marginBottom: 34 }}>
            {stats.map((s) => (
              <div key={s.l} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "18px 26px", borderRadius: 24, background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)" }}>
                <div style={{ fontSize: 40, fontWeight: 700 }}>{nf(s.v!)}</div>
                <div style={{ fontSize: 20, color: "rgba(255,255,255,.6)", marginTop: 4 }}>{s.l}</div>
              </div>
            ))}
          </div>
        ) : null}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: W - 140, paddingTop: 28, paddingBottom: 56, borderTop: "1px solid rgba(255,255,255,.14)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {stripes ? (
              // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
              <img src={uri(epauletteSvg(stripes))} height={60} width={((14 + stripes * 5.5 + 4) / 22) * 60} />
            ) : null}
            <div style={{ display: "flex", flexDirection: "column" }}>
              {name ? <div style={{ fontSize: 34, fontWeight: 700 }}>{name}</div> : null}
              {rank ? <div style={{ fontSize: 24, color: "rgba(255,255,255,.6)" }}>{rank}</div> : null}
            </div>
          </div>
          <div style={{ fontSize: 26, color: "#22C55E", fontWeight: 600 }}>geardown.app</div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts: await loadFonts(), headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
