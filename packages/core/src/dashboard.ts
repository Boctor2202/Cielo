import type { Flight, Layover, Pilot } from "./types";

/**
 * The Overview widgets, shared by the website and the app: what each one is, the sizes it comes in, the layout a
 * pilot starts with, and the figures the new widgets show. The layout lives on the pilot record (pilots.dashboard),
 * so it is the same on every device.
 */
export type WidgetSize = "s" | "l";
export type WidgetId =
  | "hero"
  | "periods"
  | "nextDuty"
  | "lastFlight"
  | "recency"
  | "expiries"
  | "ftl"
  | "byType"
  | "countries"
  | "byOperator"
  | "nextLayover"
  | "nextBadge"
  | "jobs"
  | "hud";

export interface WidgetSpec {
  id: WidgetId;
  sizes: WidgetSize[];
  label: { fr: string; en: string };
  /** a Max feature (shown locked otherwise) */
  max?: boolean;
}

export const WIDGETS: WidgetSpec[] = [
  { id: "hero", sizes: ["l", "s"], label: { fr: "Temps total et objectif", en: "Total time and goal" } },
  { id: "periods", sizes: ["l", "s"], label: { fr: "28 jours, 90 jours, 12 mois", en: "28 days, 90 days, 12 months" } },
  { id: "nextDuty", sizes: ["l", "s"], label: { fr: "Prochain service", en: "Next duty" }, max: true },
  { id: "lastFlight", sizes: ["l", "s"], label: { fr: "Dernier vol", en: "Last flight" } },
  { id: "recency", sizes: ["l", "s"], label: { fr: "Expérience récente", en: "Recency" } },
  { id: "expiries", sizes: ["l", "s"], label: { fr: "Prochaines échéances", en: "Next expiries" } },
  { id: "ftl", sizes: ["l", "s"], label: { fr: "Limites FTL", en: "FTL limits" }, max: true },
  { id: "byType", sizes: ["l", "s"], label: { fr: "Heures par type", en: "Hours by type" } },
  { id: "countries", sizes: ["s", "l"], label: { fr: "Pays et aéroports visités", en: "Countries and airports" } },
  { id: "byOperator", sizes: ["l", "s"], label: { fr: "Heures par opérateur", en: "Hours by operator" } },
  { id: "nextLayover", sizes: ["s", "l"], label: { fr: "Prochaine escale", en: "Next layover" }, max: true },
  { id: "nextBadge", sizes: ["s", "l"], label: { fr: "Prochain badge", en: "Next badge" } },
  { id: "jobs", sizes: ["s", "l"], label: { fr: "Offres pour toi", en: "Jobs for you" }, max: true },
  { id: "hud", sizes: ["l", "s"], label: { fr: "Décollages et atterrissages HUD", en: "HUD takeoffs and landings" } },
];

export interface WidgetPlacement {
  id: WidgetId;
  size: WidgetSize;
}

/** What a pilot sees before customising: the Overview as it was. */
export const DEFAULT_WIDGETS: WidgetPlacement[] = [
  { id: "hero", size: "l" },
  { id: "periods", size: "l" },
  { id: "nextDuty", size: "l" },
  { id: "lastFlight", size: "l" },
  { id: "recency", size: "l" },
  { id: "expiries", size: "l" },
  { id: "ftl", size: "l" },
];

const SPEC = new Map(WIDGETS.map((w) => [w.id, w]));
export const widgetSpec = (id: WidgetId) => SPEC.get(id)!;
export const widgetLabel = (id: WidgetId, locale: string) => SPEC.get(id)?.label[locale === "fr" ? "fr" : "en"] ?? id;

/**
 * A pilot who flies with a head-up display (an Air France pilot: HUD takeoffs or landings in the logbook, or
 * flights with Air France): the Overview offers the HUD counter.
 */
export function isHudPilot(flights: Flight[]): boolean {
  return flights.some((f) => !f.deletedAt && ((f.hudTakeoffs ?? 0) + (f.hudLandings ?? 0) > 0 || /^air france$/i.test(f.operator?.trim() ?? "")));
}

/**
 * The pilot's widgets, cleaned: unknown ids and duplicates dropped, sizes the widget allows; the default if none.
 * `hud`: the HUD counter is added after the first widget for a pilot who flies with a HUD, unless taken off.
 */
export function dashboardWidgets(pilot: Pick<Pilot, "dashboard"> | undefined, opts: { hud?: boolean } = {}): WidgetPlacement[] {
  const list = cleanWidgets(pilot);
  if (opts.hud && !list.some((w) => w.id === "hud") && !(pilot?.dashboard?.dropped ?? []).includes("hud")) {
    return [...list.slice(0, 1), { id: "hud", size: "l" }, ...list.slice(1)];
  }
  return list;
}

function cleanWidgets(pilot: Pick<Pilot, "dashboard"> | undefined): WidgetPlacement[] {
  const raw = pilot?.dashboard?.widgets;
  if (!Array.isArray(raw)) return DEFAULT_WIDGETS;
  const seen = new Set<string>();
  const out: WidgetPlacement[] = [];
  for (const w of raw) {
    const spec = SPEC.get(w?.id as WidgetId);
    if (!spec || seen.has(spec.id)) continue;
    seen.add(spec.id);
    out.push({ id: spec.id, size: spec.sizes.includes(w.size as WidgetSize) ? (w.size as WidgetSize) : spec.sizes[0]! });
  }
  return out;
}

/** Widgets not on the Overview yet, to add. */
export const hiddenWidgets = (shown: WidgetPlacement[]) => WIDGETS.filter((w) => !shown.some((s) => s.id === w.id));

/** The layout as stored on the pilot record. */
export const dashboardValue = (widgets: WidgetPlacement[], prev?: Pick<Pilot, "dashboard">): NonNullable<Pilot["dashboard"]> => {
  // a widget offered automatically and taken off stays off
  const dropped = new Set(prev?.dashboard?.dropped ?? []);
  if (widgets.some((w) => w.id === "hud")) dropped.delete("hud");
  else if (prev && (prev.dashboard?.widgets ?? []).some((w) => w.id === "hud")) dropped.add("hud");
  return { widgets: widgets.map((w) => ({ id: w.id, size: w.size })), ...(dropped.size ? { dropped: [...dropped] } : {}) };
};

/** HUD counts: all time, and the 90-day HUD recency (3 takeoffs and 3 landings). */
export function hudSummary(flights: Flight[], today: string) {
  const live = flights.filter((f) => !f.deletedAt && !f.isFstd);
  const takeoffs = live.reduce((s, f) => s + (f.hudTakeoffs ?? 0), 0);
  const landings = live.reduce((s, f) => s + (f.hudLandings ?? 0), 0);
  const from = addDaysIso(today, -89);
  const recent = live.filter((f) => f.date >= from && f.date <= today);
  return {
    takeoffs,
    landings,
    takeoffs90: recent.reduce((s, f) => s + (f.hudTakeoffs ?? 0), 0),
    landings90: recent.reduce((s, f) => s + (f.hudLandings ?? 0), 0),
  };
}
const addDaysIso = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export function moveWidget(list: WidgetPlacement[], from: number, to: number): WidgetPlacement[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [w] = next.splice(from, 1);
  if (w) next.splice(to, 0, w);
  return next;
}

const live = (flights: Flight[]) => flights.filter((f) => !f.deletedAt && !f.isFstd);

/** Hours by aircraft type, most flown first. */
export function hoursByType(flights: Flight[], limit = 5): { key: string; minutes: number; flights: number }[] {
  const m = new Map<string, { minutes: number; flights: number }>();
  for (const f of live(flights)) {
    const k = f.aircraftTypeIcao || "—";
    const v = m.get(k) ?? { minutes: 0, flights: 0 };
    v.minutes += f.totalMin;
    v.flights += 1;
    m.set(k, v);
  }
  return [...m].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.minutes - a.minutes).slice(0, limit);
}

/** Hours by operator (flights without one under "—"), most flown first. */
export function hoursByOperator(flights: Flight[], limit = 5): { key: string; minutes: number; flights: number }[] {
  const m = new Map<string, { minutes: number; flights: number }>();
  for (const f of live(flights)) {
    const k = f.operator?.trim() || "—";
    const v = m.get(k) ?? { minutes: 0, flights: 0 };
    v.minutes += f.totalMin;
    v.flights += 1;
    m.set(k, v);
  }
  return [...m].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.minutes - a.minutes).slice(0, limit);
}

/** Distinct airports and countries landed at or departed from. */
export function placesVisited(flights: Flight[], countryOf: (icao: string) => string | undefined): { airports: number; countries: string[] } {
  const airports = new Set<string>();
  const countries = new Set<string>();
  for (const f of live(flights)) {
    for (const a of [f.depIcao, f.arrIcao]) {
      if (!a) continue;
      airports.add(a);
      const c = countryOf(a);
      if (c) countries.add(c);
    }
  }
  return { airports: airports.size, countries: [...countries].sort() };
}

/** The next layover (arrival still to come, or under way). */
export function nextLayover(layovers: Layover[], nowIso: string): Layover | undefined {
  return layovers
    .filter((l) => !l.deletedAt && ((l.departureUtc ?? l.arrivalUtc ?? "") >= nowIso || (l.arrivalUtc ?? "") >= nowIso))
    .sort((a, b) => (a.arrivalUtc ?? "").localeCompare(b.arrivalUtc ?? ""))[0];
}

/** The locked badge closest to being earned (by share of its target). */
export function closestBadge<B extends { unlocked: boolean; value: number; target: number }>(badges: B[]): B | undefined {
  return badges.filter((b) => !b.unlocked && b.target > 0).sort((a, b) => b.value / b.target - a.value / a.target)[0];
}

/** The locked badges closest to being earned, nearest first. */
export function closestBadges<B extends { unlocked: boolean; value: number; target: number }>(badges: B[], n = 3): B[] {
  return badges.filter((b) => !b.unlocked && b.target > 0).sort((a, b) => b.value / b.target - a.value / a.target).slice(0, n);
}
