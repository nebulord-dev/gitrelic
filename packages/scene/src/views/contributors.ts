// Team & Activity › Contributors: who commits into which package, as a flow
// (docs/atlas-views.md › Contributors). Lanes, its alternate form, is the
// same people week by week.

import {
  contributorFlowOf,
  LEFT_BEHIND_SHARE,
  notActiveShare,
  personStatus,
} from '../contributors/flow';
import { contributorLanesOf } from '../contributors/lanes';
import { ids } from '../ids';
import { reportNow } from '../inspect/personFacts';
import {
  flowScene,
  packageId,
  packageName,
  STATUS_TEXT,
} from '../layouts/flow';
import { lanesScene } from '../layouts/lanes';
import type {
  AnalyzerView,
  Finding,
  Layout,
  LensTable,
  ViewInput,
} from '../model';

/** The people a departure finding looks at: the top this many by commits. */
export const CARRIERS = 10;

const n = (v: number) => v.toLocaleString('en-US');
const plural = (v: number, word: string) =>
  word === 'person'
    ? `${n(v)} ${v === 1 ? 'person' : 'people'}`
    : `${n(v)} ${word}${v === 1 ? '' : 's'}`;

export const flowLayout: Layout = {
  id: 'flow',
  label: 'Flow',
  caption:
    'People on the left, packages on the right; a band is a person’s commits into a package. Grey bands are active people’s, brown quiet, orange gone (no commit in six months or more).',
  focusKinds: ['person', 'dir', 'repo'],
  needsCommits: true,
  build: (input, viewport) =>
    flowScene(contributorFlowOf(input.report, input.commits ?? []), viewport, {
      focus: input.focus,
      now: reportNow(input.report),
    }),
};

export const lanesLayout: Layout = {
  id: 'lanes',
  label: 'Lanes',
  caption:
    'The same people week by week (by month past two years), in their status’s colour. A last commit right of “active” keeps someone active; one left of “gone” makes them gone.',
  focusKinds: ['person'],
  needsCommits: true,
  build: (input, viewport) =>
    lanesScene(
      contributorLanesOf(input.report, input.commits ?? []),
      viewport,
      {
        focus: input.focus,
        now: reportNow(input.report),
      },
    ),
};

export function contributorsFindings(input: ViewInput): Finding[] {
  const { report } = input;
  const all = report.contributors.contributors;
  const findings: Finding[] = [];
  if (all.length === 0) return findings;

  // People who carried the work and have gone.
  const top = all.slice(0, CARRIERS);
  const gone = top.filter((c) => c.isGhost);
  if (gone.length > 0) {
    const segments: Finding['segments'] = [
      `${n(gone.length)} of the top ${n(top.length)} ${gone.length === 1 ? 'is' : 'are'} gone: `,
    ];
    gone.forEach((c, i) => {
      if (i > 0) segments.push(i === gone.length - 1 ? ' and ' : ', ');
      segments.push({ ref: ids.person(c.email), text: c.name });
    });
    const commits = gone.reduce((s, c) => s + c.commitCount, 0);
    const files = gone.reduce((s, c) => s + c.filesOwned, 0);
    segments.push(
      `; ${plural(commits, 'commit')}${gone.length > 1 ? ' between them' : ''}` +
        (files > 0 ? `, and ${plural(files, 'file')} still theirs.` : '.'),
    );
    findings.push({ id: 'carriers', tone: 'warning', segments });
  }

  // Packages mostly built by people no longer active (needs the history).
  if (input.commits) {
    const behind = contributorFlowOf(report, input.commits)
      .packages.filter((p) => notActiveShare(p) >= LEFT_BEHIND_SHARE)
      .slice(0, 2);
    for (const p of behind) {
      findings.push({
        id: `left-behind:${p.dir}`,
        tone: 'warning',
        segments: [
          { ref: packageId(p.dir), text: packageName(p.dir) },
          `: ${Math.round(notActiveShare(p) * 100)}% of its ${plural(p.commits, 'commit')} came from people no longer active.`,
        ],
      });
    }
  }

  // The team's shape: who's here, how concentrated, who's new.
  const active = report.contributors.activeContributors.length;
  const one = all.filter((c) => c.commitCount === 1).length;
  findings.push({
    id: 'team',
    tone: 'neutral',
    segments: [
      `${n(active)} of ${plural(all.length, 'contributor')} ${active === 1 ? 'is' : 'are'} active` +
        `, and ${n(report.contributors.newcomers90d)} joined in the 90 days before the last commit. ` +
        `The top 3 made ${Math.round(report.contributors.top3CommitShare)}% of the commits` +
        (one > 0 ? `; ${plural(one, 'person')} made one.` : '.'),
    ],
  });
  return findings;
}

export const CONTRIBUTOR_TIER_NAMES = [
  'Active',
  'Quiet',
  'Gone',
  'Gone, still owns files',
] as const;

/** Every contributor, most commits first. */
export function contributorsTable(input: ViewInput): LensTable {
  return {
    columns: [
      { id: 'name', label: 'Contributor' },
      { id: 'status', label: 'Status' },
      { id: 'commits', label: 'Commits', numeric: true },
      { id: 'owned', label: 'Files owned', numeric: true },
      { id: 'lines', label: 'Lines changed', numeric: true },
      { id: 'first', label: 'First commit' },
      { id: 'last', label: 'Last commit' },
      { id: 'focus', label: 'Focus areas' },
    ],
    rows: input.report.contributors.contributors.map((c) => {
      const status = personStatus(c);
      return {
        id: ids.person(c.email),
        tier:
          status === 'active'
            ? 0
            : status === 'quiet'
              ? 1
              : c.filesOwned > 0
                ? 3
                : 2,
        search: `${c.name} ${c.email}`.toLowerCase(),
        cells: {
          name: c.name,
          status: STATUS_TEXT[status],
          commits: c.commitCount,
          owned: c.filesOwned,
          lines: c.linesChanged,
          first: c.firstCommit.slice(0, 10),
          last: c.lastCommit.slice(0, 10),
          focus: c.focusAreas.join(', '),
        },
      };
    }),
    tierNames: CONTRIBUTOR_TIER_NAMES,
    sort: { column: 'commits', descending: true },
  };
}

export const contributorsView: AnalyzerView = {
  id: 'contributors',
  layouts: [flowLayout, lanesLayout],
  findings: contributorsFindings,
  table: contributorsTable,
};
