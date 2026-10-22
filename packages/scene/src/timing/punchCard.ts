// Commit Timing's punch card (docs/atlas-views.md › Commit Timing): commits
// by day and hour in each author's local time, and, for a selection, the
// hours its own commits landed in. The repo's grid is core's
// `repoHourDayMatrix`; a selection's comes from the commit index (each
// commit carries its author's UTC offset).
//
// A package's or file's hours leave out what core's package test leaves
// out: sweeping commits (over `SWEEPING_COMMIT_FILES`) and bot commits, so a
// package's lit cells add up to the count beside it. A person's hours are
// every commit they made: a mass rename at 2am is still them working at 2am.

import { classifyAuthor } from '../authors/authorClassification';
import { localDayHour, type CommitLike } from '../commits/commitLike';
import { entityKey, entityKind, REPO_ID, type EntityId } from '../ids';
import type { GitrelicReport } from '@gitrelic/core';

/** Core's sweeping size (`MAX_FIX_FILES`): keep the two in step. */
export const SWEEPING_COMMIT_FILES = 20;

/** Rows in display order: Monday first, the weekend last (0 = Sunday). */
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Core's off-hours: late night (23:00 through 04:59) or the weekend. */
export const isLateNight = (hour: number) => hour === 23 || hour <= 4;
export const isWeekend = (day: number) => day === 0 || day === 6;
export const isOffHours = (day: number, hour: number) =>
  isLateNight(hour) || isWeekend(day);

/** A day × hour grid of counts, `[day][hour]`, day 0 = Sunday. */
export type DayHourGrid = number[][];

export const emptyGrid = (): DayHourGrid =>
  Array.from({ length: 7 }, () => new Array<number>(24).fill(0));

/**
 * Whether a commit belongs to a selection: a file (or its directory's files),
 * or the root package (`repo`: files at the top level). Null for selections
 * the punch card doesn't draw.
 */
export function touchesSelection(
  id: EntityId,
): ((files: readonly string[]) => boolean) | null {
  const kind = entityKind(id);
  const key = entityKey(id);
  if (kind === 'file') return (files) => files.includes(key);
  if (kind === 'dir') {
    const prefix = `${key}/`;
    return (files) => files.some((f) => f.startsWith(prefix));
  }
  if (id === REPO_ID) return (files) => files.some((f) => !f.includes('/'));
  return null;
}

/** Which commits a selection's hours count. */
export interface SelectionRule {
  match: (c: CommitLike) => boolean;
  /** Leave out sweeping and bot commits, as core's package test does. */
  asPackages: boolean;
}

/** The rule for a selection the punch card draws, or null. */
export function selectionRule(id: EntityId): SelectionRule | null {
  if (entityKind(id) === 'person') {
    const email = entityKey(id).toLowerCase();
    return {
      match: (c) => c.author.toLowerCase() === email,
      asPackages: false,
    };
  }
  const touches = touchesSelection(id);
  return touches ? { match: (c) => touches(c.files), asPackages: true } : null;
}

export interface SelectionHours {
  grid: DayHourGrid;
  commits: number;
  offHours: number;
}

/** The hours a selection's commits landed in. */
export function selectionHours(
  commits: readonly CommitLike[],
  rule: SelectionRule,
): SelectionHours {
  const grid = emptyGrid();
  let n = 0;
  let off = 0;
  for (const c of commits) {
    if (rule.asPackages) {
      if (c.files.length > SWEEPING_COMMIT_FILES) continue;
      if (classifyAuthor(c.author) === 'bot') continue;
    }
    if (!rule.match(c)) continue;
    const { day, hour } = localDayHour(c);
    grid[day][hour]++;
    n++;
    if (isOffHours(day, hour)) off++;
  }
  return { grid, commits: n, offHours: off };
}

/** The repo's grid, as core counted it (every commit). */
export function repoGrid(report: GitrelicReport): DayHourGrid {
  const m = report.commitTiming.repoHourDayMatrix;
  return m.length === 7 ? m : emptyGrid();
}

/** Share of a grid's commits in weekday working hours (9am–7pm). */
export function workingHoursShare(grid: DayHourGrid): number {
  let all = 0;
  let work = 0;
  grid.forEach((row, day) =>
    row.forEach((v, hour) => {
      all += v;
      if (day >= 1 && day <= 5 && hour >= 9 && hour <= 18) work += v;
    }),
  );
  return all === 0 ? 0 : work / all;
}

/** The busiest cells, most commits first. */
export function busiestCells(
  grid: DayHourGrid,
  count = 2,
): { day: number; hour: number; commits: number }[] {
  const cells: { day: number; hour: number; commits: number }[] = [];
  grid.forEach((row, day) =>
    row.forEach((v, hour) => cells.push({ day, hour, commits: v })),
  );
  return cells
    .filter((c) => c.commits > 0)
    .sort((a, b) => b.commits - a.commits || a.day - b.day || a.hour - b.hour)
    .slice(0, count);
}

/** `0` → "12am", `13` → "1pm". */
export function hourName(hour: number): string {
  if (hour === 0) return '12am';
  if (hour === 12) return '12pm';
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

const cache = new WeakMap<
  readonly CommitLike[],
  Map<EntityId, SelectionHours | null>
>();
/** `selectionHours` for a selection, once per commit list and id. */
export function selectionHoursOf(
  commits: readonly CommitLike[],
  id: EntityId,
): SelectionHours | null {
  let byId = cache.get(commits);
  if (!byId) cache.set(commits, (byId = new Map()));
  if (!byId.has(id)) {
    const rule = selectionRule(id);
    byId.set(id, rule ? selectionHours(commits, rule) : null);
  }
  return byId.get(id)!;
}

export interface OffHoursRegular {
  /** The person's entity id (the contributors report's email). */
  id: EntityId;
  name: string;
  activeWeeks: number;
  weekendWeeks: number;
  lateNightWeeks: number;
  lateNights: number;
  regularWeekends: boolean;
  regularLateNights: boolean;
}

/**
 * People who work off-hours regularly (core's rule: in at least a third of
 * their active weeks, over at least six), most regular first: the larger of
 * their weekend and late-night shares of active weeks.
 */
export function offHoursRegulars(report: GitrelicReport): OffHoursRegular[] {
  // Core keys authors by lower-cased email; ids use the contributors
  // report's spelling.
  const idOf = new Map(
    report.contributors.contributors.map((c) => [
      c.email.toLowerCase(),
      c.email,
    ]),
  );
  const share = (a: OffHoursRegular) =>
    Math.max(a.weekendWeeks, a.lateNightWeeks) / Math.max(1, a.activeWeeks);
  return report.commitTiming.authorStress
    .filter((a) => a.regularWeekends || a.regularLateNights)
    .map((a) => ({
      id: `person:${idOf.get(a.email.toLowerCase()) ?? a.email}`,
      name: a.name,
      activeWeeks: a.activeWeeks,
      weekendWeeks: a.weekendWeeks,
      lateNightWeeks: a.lateNightWeeks,
      lateNights: a.lateNights,
      regularWeekends: a.regularWeekends,
      regularLateNights: a.regularLateNights,
    }))
    .sort((x, y) => share(y) - share(x) || x.name.localeCompare(y.name));
}

/** What a regular's pattern is, in words: "weekends in 9 of 12 active weeks". */
export function regularLine(r: OffHoursRegular): string {
  const parts: string[] = [];
  if (r.regularWeekends)
    parts.push(
      `weekends in ${r.weekendWeeks} of ${r.activeWeeks} active weeks`,
    );
  if (r.regularLateNights)
    parts.push(
      `late nights in ${r.lateNightWeeks} of ${r.activeWeeks} active weeks (${r.lateNights} nights)`,
    );
  return parts.join('; ');
}
