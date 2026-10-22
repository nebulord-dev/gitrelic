// Team & Activity › Commit Timing: when the code changes, and which code
// changes off-hours more than the team's own rate explains
// (docs/atlas-views.md › Commit Timing). The packages-against-chance funnel,
// its alternate form, is its own PR.

import { entityKey, entityKind, ids, REPO_ID, type EntityId } from '../ids';
import { punchCardScene } from '../layouts/punchCard';
import {
  busiestCells,
  DAY_NAMES,
  hourName,
  repoGrid,
  selectionHoursOf,
  workingHoursShare,
} from '../timing/punchCard';
import type {
  AnalyzerView,
  Finding,
  Layout,
  LensTable,
  ViewInput,
} from '../model';
import type { PackageOffHours } from '@gitrelic/core';

const n = (v: number) => v.toLocaleString('en-US');
const pct = (v: number) => `${Math.round(v * 100)}%`;
const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);

/** A package's name on the stage: `packages/` dropped, as in Churn. */
export const timingPackageName = (pkg: string) =>
  pkg === '' ? '(root)' : pkg.replace(/^packages\//, '');
export const timingPackageId = (pkg: string): EntityId =>
  pkg === '' ? REPO_ID : ids.dir(pkg);

/** What a selection is called beside its hours. */
function selectionName(id: EntityId): string {
  if (id === REPO_ID) return '(root)';
  const key = entityKey(id);
  return entityKind(id) === 'file' ? baseName(key) : timingPackageName(key);
}

export const punchCardLayout: Layout = {
  id: 'punch-card',
  label: 'Punch card',
  caption:
    'Commits by day and hour, in each author’s local time. Off-hours (the shaded weekend rows and 11pm–5am columns) take the risk colour. Select a package or file to see its own hours.',
  focusKinds: ['dir', 'file', 'repo'],
  needsCommits: true,
  build: (input, viewport) => {
    const hours =
      input.focus && input.commits
        ? selectionHoursOf(input.commits, input.focus)
        : null;
    return punchCardScene(
      {
        grid: repoGrid(input.report),
        selection:
          hours && hours.commits > 0
            ? { name: selectionName(input.focus!), hours }
            : null,
      },
      viewport,
    );
  },
};

export function commitTimingFindings(input: ViewInput): Finding[] {
  const { offHours } = input.report.commitTiming;
  const findings: Finding[] = [];
  const rate = pct(offHours.rate);

  const above = offHours.packages.filter((p) => p.aboveChance);
  if (above.length > 0) {
    const segments: Finding['segments'] = [];
    above.slice(0, 2).forEach((p, i) => {
      if (i > 0) segments.push('; ');
      segments.push({
        ref: timingPackageId(p.package),
        text: timingPackageName(p.package),
      });
      segments.push(` ${n(p.offHours)} of ${n(p.commits)} (${p.percent}%)`);
    });
    segments.push(
      ` change${above.length === 1 ? 's' : ''} off-hours more than chance explains at the repo’s ${rate}.`,
    );
    if (above.length > 2)
      segments.push(` ${n(above.length - 2)} more in the table.`);
    findings.push({ id: 'above-chance', tone: 'warning', segments });
  } else if (offHours.packages.length > 0) {
    findings.push({
      id: 'above-chance',
      tone: 'neutral',
      segments: [
        `No package changes off-hours more than chance explains; ${rate} of commits are off-hours repo-wide.`,
      ],
    });
  }

  const grid = repoGrid(input.report);
  const [busiest] = busiestCells(grid, 1);
  if (busiest) {
    findings.push({
      id: 'hours',
      tone: 'neutral',
      segments: [
        `${pct(workingHoursShare(grid))} of commits land on weekdays between 9am and 7pm; the busiest hour is ${DAY_NAMES[busiest.day]} ${hourName(busiest.hour)}.`,
      ],
    });
  }

  // The most regular package: well under the repo's rate, with plenty of
  // commits to say so.
  const regular = offHours.packages
    .filter(
      (p) =>
        p.commits >= 3 * offHours.minCommits &&
        p.offHours / p.commits < offHours.rate / 2,
    )
    .sort(
      (a, b) =>
        a.offHours / a.commits - b.offHours / b.commits ||
        b.commits - a.commits,
    )[0];
  if (regular) {
    findings.push({
      id: 'regular',
      tone: 'neutral',
      segments: [
        {
          ref: timingPackageId(regular.package),
          text: timingPackageName(regular.package),
        },
        ` keeps the most regular hours: ${n(regular.offHours)} of ${n(regular.commits)} commits off-hours (${regular.percent}%).`,
      ],
    });
  }
  return findings;
}

export const TIMING_TIER_NAMES = [
  'Below the repo’s rate',
  'Above the rate, within chance',
  'Above chance',
  'Above chance, twice the rate',
] as const;

/** A tested package's tier: how far past the repo's rate, and chance. */
export function timingTier(p: PackageOffHours, rate: number): 0 | 1 | 2 | 3 {
  const share = p.offHours / p.commits;
  if (p.aboveChance) return share >= 2 * rate ? 3 : 2;
  return share > rate ? 1 : 0;
}

/** Every package with enough commits to test, above chance first. */
export function commitTimingTable(input: ViewInput): LensTable {
  const { offHours } = input.report.commitTiming;
  return {
    columns: [
      { id: 'package', label: 'Package' },
      { id: 'commits', label: 'Commits', numeric: true },
      { id: 'off', label: 'Off-hours', numeric: true },
      { id: 'percent', label: 'Off-hours %', numeric: true },
      { id: 'allowed', label: 'Chance allows', numeric: true },
      { id: 'above', label: 'Above chance' },
    ],
    rows: offHours.packages.map((p) => ({
      id: timingPackageId(p.package),
      tier: timingTier(p, offHours.rate),
      search: (p.package || '(root)').toLowerCase(),
      cells: {
        package: p.package || '(root)',
        commits: p.commits,
        off: p.offHours,
        percent: p.percent,
        allowed: p.allowed,
        above: p.aboveChance ? 'yes' : '',
      },
    })),
    tierNames: TIMING_TIER_NAMES,
    sort: { column: 'percent', descending: true },
  };
}

export const commitTimingView: AnalyzerView = {
  id: 'commit-timing',
  layouts: [punchCardLayout],
  findings: commitTimingFindings,
  table: commitTimingTable,
};
