// Contributors' Lanes (docs/atlas-views.md › Contributors): the Flow's people
// as rows, their commits bin by bin over the time strip's weeks (months past
// two years), so arrivals, departures and handoffs read across everyone at
// once, where the time strip shows one selection's weeks.
//
// Two cutoffs mark the statuses: a last commit after `active` keeps someone
// active; one before `gone` makes them gone. They mirror core's contributors
// analyzer (`analyzers/contributors.ts`), which counts back from the analyzed
// commit: keep the two formulas in step.

import { packageOf } from '../hotspots/points';
import { reportNow } from '../inspect/personFacts';
import { timeBins } from '../time/bins';
import { contributorFlowOf, type FlowPerson } from './flow';
import type { CommitLike } from '../commits/commitLike';
import type { GitrelicReport } from '@gitrelic/core';

const DAY = 86_400_000;

export interface LaneRow {
  /** A drawn person, or null for everyone else together. */
  person: FlowPerson | null;
  /** Commits per bin, aligned with `Lanes.binStarts`. */
  bins: number[];
  /** Per bin, the package most of those commits touched ('' is the root). */
  topPackage: (string | null)[];
}

export interface Lanes {
  unit: 'week' | 'month';
  binStarts: number[];
  rows: LaneRow[];
  /** People the others' row stands for. */
  others: number;
  /** The status cutoffs, epoch ms; NaN when the report has no dates. */
  activeSince: number;
  goneBefore: number;
}

/**
 * Where the statuses split, as core draws them: a window of a quarter of the
 * history's span (at least 90 days) for active, half of it (at least 180) for
 * gone, both counted back from the last commit.
 */
export function statusCutoffs(report: GitrelicReport): {
  activeSince: number;
  goneBefore: number;
} {
  const now = reportNow(report);
  const first = Date.parse(report.meta.firstCommit);
  const age =
    Number.isFinite(now) && Number.isFinite(first)
      ? Math.max(1, Math.floor((now - first) / DAY))
      : Number.NaN;
  return {
    activeSince: now - Math.max(90, Math.round(age * 0.25)) * DAY,
    goneBefore: now - Math.max(180, Math.round(age * 0.5)) * DAY,
  };
}

export function contributorLanes(
  report: GitrelicReport,
  commits: readonly CommitLike[],
): Lanes {
  const flow = contributorFlowOf(report, commits);
  const { unit, binStarts, binOf } = timeBins(commits);
  const rowOf = new Map(flow.people.map((p, i) => [p.email, i]));
  const othersRow = flow.people.length;
  const count = flow.people.length + 1;
  const bins = Array.from({ length: count }, () =>
    new Array<number>(binStarts.length).fill(0),
  );
  // row → bin → package → commits, for the bars' tooltips.
  const touched = Array.from(
    { length: count },
    () => new Map<number, Map<string, number>>(),
  );
  for (const c of commits) {
    const r = rowOf.get(c.author) ?? othersRow;
    const b = binOf(c.timeMs);
    bins[r][b]++;
    let byPkg = touched[r].get(b);
    if (!byPkg) touched[r].set(b, (byPkg = new Map()));
    for (const d of new Set(c.files.map(packageOf)))
      byPkg.set(d, (byPkg.get(d) ?? 0) + 1);
  }
  const topOf = (r: number, b: number): string | null => {
    let best: string | null = null;
    let most = 0;
    for (const [d, k] of touched[r].get(b) ?? []) {
      if (k > most || (k === most && best !== null && d < best)) {
        best = d;
        most = k;
      }
    }
    return best;
  };

  const rows: LaneRow[] = flow.people.map((person, r) => ({
    person,
    bins: bins[r],
    topPackage: bins[r].map((_, b) => topOf(r, b)),
  }));
  if (flow.otherPeople.count > 0 && bins[othersRow].some((v) => v > 0))
    rows.push({
      person: null,
      bins: bins[othersRow],
      topPackage: bins[othersRow].map((_, b) => topOf(othersRow, b)),
    });
  return {
    unit,
    binStarts,
    rows,
    others: flow.otherPeople.count,
    ...statusCutoffs(report),
  };
}

const cache = new WeakMap<
  GitrelicReport,
  WeakMap<readonly CommitLike[], Lanes>
>();
/** `contributorLanes`, computed once per report and commit list. */
export function contributorLanesOf(
  report: GitrelicReport,
  commits: readonly CommitLike[],
): Lanes {
  let byCommits = cache.get(report);
  if (!byCommits) {
    byCommits = new WeakMap();
    cache.set(report, byCommits);
  }
  let lanes = byCommits.get(commits);
  if (!lanes) {
    lanes = contributorLanes(report, commits);
    byCommits.set(commits, lanes);
  }
  return lanes;
}
