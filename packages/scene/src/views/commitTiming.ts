// Team & Activity › Commit Timing: when the code changes, and which code
// changes off-hours more than the team's own rate explains
// (docs/atlas-views.md › Commit Timing). The packages-against-chance funnel,
// its alternate form, is its own PR.

import { entityKey, entityKind, ids, REPO_ID, type EntityId } from '../ids';
import { punchCardScene } from '../layouts/punchCard';
import {
  busiestCells,
  cellAuthorsOf,
  DAY_NAMES,
  hourName,
  repoGrid,
  selectionHoursOf,
  topAuthors,
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
function selectionName(id: EntityId, input: ViewInput): string {
  if (id === REPO_ID) return '(root)';
  if (entityKind(id) === 'person')
    return input.index?.get(id)?.label ?? entityKey(id);
  const key = entityKey(id);
  return entityKind(id) === 'file' ? baseName(key) : timingPackageName(key);
}

/**
 * A cell tooltip's "by" line: the busiest authors in it, of the
 * selection's commits when one is drawn, else the repo's. None for a
 * person's own hours (it would only name them).
 */
function cellWho(
  input: ViewInput,
  drawn: boolean | null,
): ((day: number, hour: number) => string | null) | null {
  if (!input.commits) return null;
  const focus = drawn ? input.focus! : '';
  if (focus && entityKind(focus) === 'person') return null;
  const cells = cellAuthorsOf(input.commits, focus);
  if (!cells) return null;
  const name = (email: string) =>
    input.index?.get(`person:${email}`)?.label ?? email;
  return (day, hour) => {
    const cell = cells[day][hour];
    const top = topAuthors(cell);
    if (top.length === 0) return null;
    const more = cell.size - top.length;
    return (
      'by ' +
      top.map((a) => `${name(a.author)} ${a.commits}`).join(', ') +
      (more > 0 ? ` +${more} more` : '')
    );
  };
}

export const punchCardLayout: Layout = {
  id: 'punch-card',
  label: 'Punch card',
  caption:
    'Commits by day and hour, in each author’s local time. Off-hours (the shaded weekend rows and 11pm–5am columns) take the risk colour. Select a package, a file or a person to see their own hours.',
  focusKinds: ['dir', 'file', 'repo', 'person'],
  needsCommits: true,
  build: (input, viewport) => {
    const hours =
      input.focus && input.commits
        ? selectionHoursOf(input.commits, input.focus)
        : null;
    return punchCardScene(
      {
        grid: repoGrid(input.report),
        who: cellWho(input, hours && hours.commits > 0),
        selection:
          hours && hours.commits > 0
            ? {
                name: selectionName(input.focus!, input),
                hours,
                note:
                  entityKind(input.focus!) === 'person'
                    ? 'their hours: every commit they made, in their local time'
                    : 'its hours, with sweeping and bot commits left out',
              }
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
