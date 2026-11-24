"use client";

import { CalendarSync, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { feedLabel, type Roster } from "@cielo/core";
import { feedRosters, lastFeedSync, subscribeFeed, syncFeed, unsubscribeFeed, type FeedError } from "@/lib/calendarFeeds";
import { useTable } from "@/lib/hooks";

/** Subscribing to a calendar (iCloud, Google, Outlook, a crew portal) that holds the roster, and the subscriptions. */
export function CalendarFeeds({ onSynced }: { onSynced: (msg: string) => void }) {
  const t = useTranslations("app.roster.feed");
  const rosters = useTable("rosters");
  const [feeds, setFeeds] = useState<(Roster & { last: string | null })[]>([]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<FeedError | null>(null);
  useEffect(() => {
    void feedRosters().then(async (rs) => setFeeds(await Promise.all(rs.map(async (r) => ({ ...r, last: await lastFeedSync(r.id) })))));
  }, [rosters, busy]);
  const report = (r: { added: number; updated: number; removed: number }) => onSynced(t("done", r));
  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 font-semibold"><CalendarSync size={17} className="text-accent" aria-hidden /> {t("title")}</h3>
      <p className="text-sm text-muted">{t("help")}</p>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          setBusy("new");
          const r = await subscribeFeed(url);
          setBusy(null);
          if ("error" in r) return setErr(r.error);
          setUrl("");
          if (!("error" in r.result)) report(r.result);
        }}
      >
        <input className="input flex-1" type="url" inputMode="url" placeholder={t("placeholder")} value={url} onChange={(e) => setUrl(e.target.value)} required />
        <button type="submit" className="btn btn-primary btn-sm shrink-0" disabled={busy !== null}>
          {busy === "new" ? <Loader2 size={15} className="animate-spin" /> : null} {t("subscribe")}
        </button>
      </form>
      {busy === "new" ? <p className="text-sm text-muted">{t("syncing")}</p> : null}
      {err ? <p className="text-sm text-[var(--warning)]">{t(`err.${err}`)}</p> : null}
      {feeds.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {feeds.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="min-w-0">
                <span className="block font-semibold">{feedLabel(f.fileName!)}</span>
                <span className="block text-xs text-muted">{f.last ? t("last", { when: new Date(f.last).toLocaleString() }) : t("never")}</span>
              </span>
              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busy !== null}
                  onClick={async () => {
                    setBusy(f.id);
                    setErr(null);
                    const r = await syncFeed(f);
                    setBusy(null);
                    if ("error" in r) setErr(r.error);
                    else report(r);
                  }}
                >
                  {busy === f.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {t("syncNow")}
                </button>
                <button type="button" className="btn btn-ghost btn-sm text-[var(--warning)]" aria-label={t("remove")} title={t("remove")} onClick={async () => window.confirm(t("removeConfirm")) && (await unsubscribeFeed(f), setFeeds((x) => x.filter((y) => y.id !== f.id)))}>
                  <Trash2 size={14} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <details className="text-sm text-muted">
        <summary className="cursor-pointer font-medium text-text">{t("how")}</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>{t("howApple")}</li>
          <li>{t("howGoogle")}</li>
          <li>{t("howOutlook")}</li>
          <li>{t("howPortal")}</li>
        </ul>
      </details>
    </div>
  );
}
