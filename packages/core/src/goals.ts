import { addDays, daysBetween } from "./time";
import type { Flight, GoalKind, OpeningBalance, PilotGoal } from "./types";

/** Progress of one goal, worked out from the logbook (and the totals carried from paper logbooks). */
export interface GoalProgress {
  goal: PilotGoal;
  /** minutes for hour goals, a count for landings */
  done: number;
  ratio: number;
  reached: boolean;
  /** what is left */
  left: number;
  /** days to the deadline (negative when past) */
  daysLeft?: number;
  /** pace needed per 30 days to make the deadline */
  perMonth?: number;
}

export const GOAL_KINDS: GoalKind[] = ["total", "pic", "type", "multiPilot", "jet", "night", "ifr", "landings"];
export const isHourGoal = (k: GoalKind) => k !== "landings";

/** Logged value for a goal kind; jet hours need the type's engine type (typeIsJet). */
export function goalValue(kind: GoalKind, flights: Flight[], opening: OpeningBalance[], opts: { icao?: string; typeIsJet?: (icao: string) => boolean } = {}): number {
  const real = flights.filter((f) => !f.deletedAt && !f.isFstd);
  const open = opening.filter((o) => !o.deletedAt);
  const sum = (fs: Flight[], k: (f: Flight) => number) => fs.reduce((s, f) => s + (k(f) || 0), 0);
  const osum = (os: OpeningBalance[], k: (o: OpeningBalance) => number | undefined) => os.reduce((s, o) => s + (k(o) || 0), 0);
  switch (kind) {
    case "total":
      return sum(real, (f) => f.totalMin) + osum(open, (o) => o.totalMin);
    case "pic":
      return sum(real, (f) => f.picMin + (f.picusMin ?? 0)) + osum(open, (o) => o.picMin);
    case "type": {
      const t = (opts.icao ?? "").toUpperCase();
      return sum(real.filter((f) => (f.aircraftTypeIcao ?? "").toUpperCase() === t), (f) => f.totalMin) + osum(open.filter((o) => (o.aircraftTypeIcao ?? "").toUpperCase() === t), (o) => o.totalMin);
    }
    case "multiPilot":
      return sum(real, (f) => f.multiPilotMin) + osum(open, (o) => o.multiPilotMin);
    case "jet":
      return sum(real.filter((f) => !!f.aircraftTypeIcao && !!opts.typeIsJet?.(f.aircraftTypeIcao)), (f) => f.totalMin);
    case "night":
      return sum(real, (f) => f.nightMin) + osum(open, (o) => o.nightMin);
    case "ifr":
      return sum(real, (f) => f.ifrMin) + osum(open, (o) => o.ifrMin);
    case "landings":
      return sum(real, (f) => f.landingsDay + f.landingsNight) + osum(open, (o) => (o.landingsDay ?? 0) + (o.landingsNight ?? 0));
  }
}

export function goalProgress(goal: PilotGoal, flights: Flight[], opening: OpeningBalance[], today: string, typeIsJet?: (icao: string) => boolean): GoalProgress {
  const done = goalValue(goal.kind, flights, opening, { icao: goal.icao, typeIsJet });
  const left = Math.max(0, goal.target - done);
  const daysLeft = goal.by ? daysBetween(today, goal.by) : undefined;
  return {
    goal,
    done,
    ratio: goal.target > 0 ? Math.min(1, done / goal.target) : 1,
    reached: done >= goal.target,
    left,
    daysLeft,
    perMonth: daysLeft !== undefined && daysLeft > 0 && left > 0 ? Math.ceil((left / daysLeft) * 30) : undefined,
  };
}

const MILESTONES = [100, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000, 15000, 20000];
const nextMilestone = (h: number) => MILESTONES.find((m) => m > h) ?? Math.ceil((h + 1) / 5000) * 5000;

/** The goals shown when the pilot has not set any: next total and PIC milestones. */
export function defaultGoals(flights: Flight[], opening: OpeningBalance[]): PilotGoal[] {
  const t = Math.floor(goalValue("total", flights, opening) / 60);
  const p = Math.floor(goalValue("pic", flights, opening) / 60);
  return [
    { id: "auto-total", kind: "total", target: nextMilestone(t) * 60 },
    { id: "auto-pic", kind: "pic", target: nextMilestone(p) * 60 },
  ];
}

/** A deadline a year from now, as offered by default in the editor. */
export const defaultDeadline = (today: string) => addDays(today, 365);
