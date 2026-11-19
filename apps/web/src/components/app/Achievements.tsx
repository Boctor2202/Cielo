"use client";

import { Flame, Lock, Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { distanceNm, discoveryBadges, shareLinkUrl, HOUR_LEVELS, hourLevel, hoursLabel, loggingStreak, wingsSvg, type DiscoveryBadge, type Flight, type OpeningBalance, type Tier } from "@cielo/core";
import { useFormatDate } from "@/lib/hooks";
import { TIER_COLORS as TIER, iconFor, starPath, starsOf, starX } from "@/lib/badgeArt";
import { Card, Modal } from "./ui";
import { ShareSheet } from "./ShareSheet";

/** A hexagonal emblem in the metal of its rank, with one star per rank; a dark silhouette with a lock while it is still to earn. */
export function Emblem({ badge, size = 64, locked }: { badge: Pick<DiscoveryBadge, "id" | "series" | "tier" | "rank" | "of">; size?: number; locked?: boolean }) {
  const [from, to] = TIER[badge.tier];
  const Icon = iconFor(badge.id, badge.series);
  const n = locked ? 0 : starsOf(badge.rank, badge.of);
  const g = `e-${badge.id}-${locked ? "l" : "u"}`;
  return (
    <div className="relative shrink-0" style={{ width: size, height: (size * 68) / 64 }}>
      <svg viewBox="0 0 64 68" width={size} height={(size * 68) / 64} aria-hidden style={locked ? undefined : { filter: `drop-shadow(0 8px 14px ${to}66)` }}>
        <defs>
          <linearGradient id={g} x1="0" y1="0" x2="0.6" y2="1">
            <stop offset="0" stopColor={locked ? "#3B4657" : from} />
            <stop offset="1" stopColor={locked ? "#151C27" : to} />
          </linearGradient>
          <linearGradient id={`${g}-s`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity={locked ? 0.08 : 0.45} />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M32 2 L59 17.5 V50.5 L32 66 L5 50.5 V17.5 Z" fill={`url(#${g})`} stroke={locked ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.55)"} strokeWidth="1.5" />
        <path d="M32 8 L54 20.7 V47.3 L32 60 L10 47.3 V20.7 Z" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1" strokeDasharray={locked ? "2 3" : undefined} />
        <path d="M5 17.5 L32 2 L59 17.5 V30 C44 24 20 24 5 30 Z" fill={`url(#${g}-s)`} />
        {Array.from({ length: n }, (_, i) => (
          <path key={i} d={starPath(starX(i, n))} fill="#FFF7D6" transform={`translate(${starX(i, n)} 50) scale(.85) translate(${-starX(i, n)} -50)`} />
        ))}
      </svg>
      <Icon
        className="absolute left-1/2 -translate-x-1/2"
        style={{ top: n ? "22%" : "30%", width: size * 0.4, height: size * 0.4, color: locked ? "rgba(255,255,255,.28)" : "#fff", filter: locked ? undefined : "drop-shadow(0 2px 3px rgba(0,0,0,.35))" }}
        strokeWidth={2.2}
      />
      {locked && (
        <span className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full border border-white/15 bg-[#0b1526] text-white/70">
          <Lock size={12} />
        </span>
      )}
    </div>
  );
}

/** Pilot wings for an hour level, in its metal; grey while locked. */
export function Wings({ hours, tier, locked, width = 120 }: { hours: number; tier: Tier; locked?: boolean; width?: number }) {
  const [from, to] = TIER[tier];
  const svg = wingsSvg({ from, to, label: hoursLabel(hours), locked, id: `w${hours}` });
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`} alt="" width={width} height={(width * 56) / 120} style={{ opacity: locked ? 0.55 : 1, filter: locked ? undefined : `drop-shadow(0 6px 12px ${to}55)` }} />
  );
}

export function Achievements({ flights, opening, airport, pilot }: { flights: Flight[]; opening: OpeningBalance[]; airport: (icao: string) => { country?: string; lat: number; lon: number } | undefined; pilot?: { fullName?: string; rank?: string } }) {
  const t = useTranslations("app.badges");
  const level = useMemo(() => hourLevel(flights, opening), [flights, opening]);
  const streak = useMemo(() => loggingStreak(flights), [flights]);
  const h = Math.floor(level.totalMin / 60);
  const discoveries = useMemo(() => discoveryBadges(flights, airport), [flights, airport]);
  // grouped by series: the highest badge held, and the next one to earn
  const series = useMemo(() => {
    const by = new Map<string, DiscoveryBadge[]>();
    for (const b of discoveries) by.set(b.series, [...(by.get(b.series) ?? []), b]);
    return [...by.entries()].map(([key, steps]) => ({ key, steps, held: [...steps].reverse().find((x) => x.unlocked), next: steps.find((x) => !x.unlocked) }));
  }, [discoveries]);
  const fmt = (b: DiscoveryBadge) => `${Math.floor(b.value).toLocaleString()} / ${b.target.toLocaleString()}${b.series === "distance" || b.series === "longest" ? " NM" : ""}`;
  const fd = useFormatDate();
  const nf = (n: number) => Math.floor(n).toLocaleString();
  const locale = useLocale();

  // the figures printed on a share image (the whole logbook)
  const totals = useMemo(() => {
    const aps = new Set<string>();
    const cts = new Set<string>();
    let nm = 0;
    for (const f of flights) {
      if (f.deletedAt || f.isFstd) continue;
      const a = airport(f.depIcao);
      const b = airport(f.arrIcao);
      for (const [icao, x] of [[f.depIcao, a], [f.arrIcao, b]] as const) {
        aps.add(icao);
        if (x?.country) cts.add(x.country);
      }
      if (a && b && f.depIcao !== f.arrIcao) nm += distanceNm(a, b);
    }
    return { ap: aps.size, ct: cts.size, nm: Math.round(nm) };
  }, [flights, airport]);
  const [openSeries, setOpenSeries] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ base: string; text: string; link: string; square: boolean } | null>(null);
  const cardUrl = (base: string, square: boolean) => `${base}${square ? "&fmt=square" : ""}`;
  /** Shares the image through the device's share sheet; on a computer, shows it with download and links. */
  const share = async (what: string, text: string) => {
    const params = new URLSearchParams(`${what}&${new URLSearchParams({
      lang: locale === "fr" ? "fr" : "en",
      name: pilot?.fullName ?? "",
      rank: pilot?.rank ?? "",
      hrs: String(Math.floor(level.totalMin / 60)),
      ap: String(totals.ap),
      ct: String(totals.ct),
      nm: String(totals.nm),
    })}`);
    const base = `/api/share-card?${params}`;
    // the public page of this achievement: its preview is the image, on every network
    const link = shareLinkUrl(window.location.origin, locale, params);
    try {
      const blob = await (await fetch(base)).blob();
      const file = new File([blob], "geardown.png", { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      // the device's own share sheet (phones, and Windows / macOS in Chrome, Edge, Safari): image + text + link
      if (nav.canShare?.({ files: [file], text, url: link })) {
        await navigator.share({ files: [file], text: `${text} · ${link}` });
        return;
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
    }
    setPreview({ base, text, link, square: false });
  };
  const ShareButton = ({ onClick }: { onClick: () => void }) => (
    <button type="button" onClick={onClick} className="relative mt-2 inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted transition hover:border-accent hover:text-accent">
      <Share2 size={12} /> {t("share")}
    </button>
  );

  return (
    <div className="space-y-5">
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title={t("levels")}>
        <div className="flex flex-wrap items-center gap-4">
          {level.current ? <Wings hours={level.current.hours} tier={level.current.tier} width={150} /> : <Wings hours={100} tier="bronze" locked width={150} />}
          <div className="min-w-0 flex-1">
            {level.current ? <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: TIER[level.current.tier][1] }}>{t(`title.${level.current.hours}`)}</p> : null}
            <p className="text-lg font-bold">{level.current ? t("club", { n: level.current.hours.toLocaleString() }) : t("noLevel")}</p>
            {level.current ? <ShareButton onClick={() => void share(`type=level&h=${level.current!.hours}`, `${t(`title.${level.current!.hours}`)} · ${t("club", { n: level.current!.hours.toLocaleString() })}`)} /> : null}
            {level.next ? (
              <>
                <p className="text-sm text-muted">{t("toNext", { left: (level.next.hours - h).toLocaleString(), n: level.next.hours.toLocaleString() })}</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[color:var(--text)]/10">
                  <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(2, level.ratio * 100)}%`, background: `linear-gradient(90deg, ${TIER[level.next.tier][1]}, ${TIER[level.next.tier][0]})` }} />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">{t("allLevels")}</p>
            )}
          </div>
        </div>
        <button type="button" onClick={() => setOpenSeries("levels")} className="mt-4 inline-flex items-center rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted transition hover:border-accent hover:text-accent">
          {t("seeLevels", { n: HOUR_LEVELS.length })}
        </button>
        <div className="mt-3 flex flex-wrap gap-2">
          {HOUR_LEVELS.map((l) => (
            <div key={l.hours} className="flex flex-col items-center gap-1" title={`${t(`title.${l.hours}`)} · ${t("club", { n: l.hours.toLocaleString() })}`}>
              <Wings hours={l.hours} tier={l.tier} locked={h < l.hours} width={64} />
            </div>
          ))}
        </div>
      </Card>

      <Card title={t("streak")}>
        <div className="flex items-center gap-4">
          <span className="grid h-[76px] w-[76px] shrink-0 place-items-center rounded-full" style={{ background: streak.current ? "radial-gradient(circle at 50% 60%, rgba(251,146,60,.35), rgba(251,146,60,.08))" : "color-mix(in srgb, var(--text) 8%, transparent)" }}>
            <Flame size={38} className={streak.current ? "text-orange-500 dark:text-orange-400" : "text-muted"} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold">{t("weeks", { n: streak.current })}</p>
            <p className="text-sm text-muted">
              {t("best", { n: streak.best })}
              {streak.onTimeRate !== undefined ? ` · ${t("onTime", { p: Math.round(streak.onTimeRate * 100) })}` : ""}
            </p>
          </div>
        </div>
        <div className="mt-5 flex items-end gap-1.5" aria-label={t("last12")}>
          {streak.weeks.map((w) => (
            <span
              key={w.monday}
              title={w.monday}
              className="h-6 flex-1 rounded-md"
              style={{ background: w.state === "onTime" ? "#22C55E" : w.state === "late" ? "#EF4444" : "color-mix(in srgb, var(--text) 10%, transparent)" }}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">{t("hint")}</p>
      </Card>
    </div>
    <Card title={`${t("discoveries")} · ${discoveries.filter((b) => b.unlocked).length}/${discoveries.length}`}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {series.map(({ key, steps, held, next }) => {
          const shown = held ?? steps[0]!;
          const [from, to] = TIER[(next ?? shown).tier];
          return (
            <div key={key} className={`relative flex gap-4 overflow-hidden rounded-2xl border p-4 ${held ? "border-border bg-surface/60" : "border-dashed border-border/70 bg-surface/30"}`}>
              {held && <div aria-hidden className="pointer-events-none absolute -left-8 -top-8 h-28 w-28 rounded-full blur-2xl" style={{ background: TIER[held.tier][0], opacity: 0.25 }} />}
              <Emblem badge={shown} locked={!held} size={64} />
              <div className="relative min-w-0 flex-1">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted">{t(`series.${key}`)}</p>
                <p className="text-[15px] font-bold leading-tight">{t(`d.${shown.id}`)}</p>
                <p className="mt-0.5 text-xs leading-snug text-muted">{held ? t("earned", { date: fd(held.on!) }) : t(`dd.${shown.id}`)}</p>
                {/* the series: one mark per step, in its metal once earned */}
                {steps.length > 1 && (
                  <div className="mt-2 flex gap-1" title={t("seriesOf", { n: steps.filter((x) => x.unlocked).length, of: steps.length })}>
                    {steps.map((x) => (
                      <span key={x.id} className="h-1.5 flex-1 rounded-full" style={{ background: x.unlocked ? `linear-gradient(90deg, ${TIER[x.tier][1]}, ${TIER[x.tier][0]})` : "color-mix(in srgb, var(--text) 12%, transparent)" }} />
                    ))}
                  </div>
                )}
                {next ? (
                  <div className="mt-2.5">
                    <p className="text-xs text-muted">
                      {held ? <>{t("nextBadge")} <span className="font-semibold text-[color:var(--text)]">{t(`d.${next.id}`)}</span> · {t(`dd.${next.id}`)}</> : null}
                    </p>
                    <p className="num mt-0.5 text-[11px] text-muted">{fmt(next)}</p>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[color:var(--text)]/10">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(3, (next.value / next.target) * 100)}%`, background: `linear-gradient(90deg, ${to}, ${from})` }} />
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-xs font-semibold" style={{ color: TIER[shown.tier][0] }}>{t("seriesDone")}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {held && <ShareButton onClick={() => void share(`type=badge&id=${held.id}&on=${held.on}`, `${t(`d.${held.id}`)} · ${t(`dd.${held.id}`)}`)} />}
                  {steps.length > 1 && (
                    <button type="button" onClick={() => setOpenSeries(key)} className="relative mt-2 inline-flex items-center rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted transition hover:border-accent hover:text-accent">
                      {t("seeSeries", { n: steps.length })}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
    <Modal open={!!openSeries} onClose={() => setOpenSeries(null)} title={openSeries === "levels" ? t("levels") : openSeries ? t(`series.${openSeries}`) : ""}>
      <ul className="space-y-2">
        {openSeries === "levels"
          ? HOUR_LEVELS.map((l) => {
              const got = h >= l.hours;
              return (
                <li key={l.hours} className={`flex items-center gap-3 rounded-xl border p-3 ${got ? "border-border" : "border-dashed border-border/70"}`}>
                  <Wings hours={l.hours} tier={l.tier} locked={!got} width={84} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: TIER[l.tier][got ? 1 : 0], opacity: got ? 1 : 0.7 }}>{t(`title.${l.hours}`)}</p>
                    <p className="font-semibold">{t("club", { n: l.hours.toLocaleString() })}</p>
                    <p className="text-xs text-muted">{got ? t("reached") : t("hoursLeft", { n: (l.hours - h).toLocaleString() })}</p>
                  </div>
                </li>
              );
            })
          : series
              .find((x) => x.key === openSeries)
              ?.steps.map((b) => (
                <li key={b.id} className={`flex items-center gap-3 rounded-xl border p-3 ${b.unlocked ? "border-border" : "border-dashed border-border/70"}`}>
                  <Emblem badge={b} locked={!b.unlocked} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{t(`d.${b.id}`)}</p>
                    <p className="text-xs text-muted">{t(`dd.${b.id}`)}</p>
                    {b.unlocked ? (
                      <p className="mt-1 text-xs font-semibold" style={{ color: TIER[b.tier][1] }}>{t("earned", { date: fd(b.on!) })}</p>
                    ) : (
                      <div className="mt-1.5">
                        <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--text)]/10">
                          <div className="h-full rounded-full" style={{ width: `${Math.max(3, (b.value / b.target) * 100)}%`, background: `linear-gradient(90deg, ${TIER[b.tier][1]}, ${TIER[b.tier][0]})` }} />
                        </div>
                        <p className="num mt-0.5 text-[11px] text-muted">{fmt(b)}</p>
                      </div>
                    )}
                  </div>
                </li>
              ))}
      </ul>
    </Modal>
    <Modal open={!!preview} onClose={() => setPreview(null)} title={t("shareTitle")}>
      {preview && (
        <div className="space-y-4">
          <div className="flex justify-center gap-2">
            {[false, true].map((sq) => (
              <button key={String(sq)} type="button" onClick={() => setPreview({ ...preview, square: sq })} className={`rounded-full px-3 py-1 text-xs font-semibold ${preview.square === sq ? "bg-accent text-black" : "border border-border text-muted"}`}>
                {sq ? t("fmtSquare") : t("fmtPortrait")}
              </button>
            ))}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cardUrl(preview.base, preview.square)} alt={preview.text} className="mx-auto max-h-[55vh] w-auto rounded-xl border border-border" />
          <ShareSheet image={cardUrl(preview.base, preview.square)} text={preview.text} link={preview.link} />
        </div>
      )}
    </Modal>
    </div>
  );
}
