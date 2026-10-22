// Team & Activity › Parallel Dev: who committed to the same files in the same
// weeks, as a circle of pairs (docs/atlas-views.md › Parallel Dev). The
// Collision lanes form (where and when) is its own PR.

import { lockstepGroups } from '../churn/lockstep';
import { packageOf } from '../hotspots/points';
import { ids } from '../ids';
import { pairsScene } from '../layouts/pairs';
import { parallelPairsOf } from '../parallel/pairs';
import type {
  AnalyzerView,
  Finding,
  Layout,
  LensTable,
  ViewInput,
} from '../model';

const n = (v: number) => v.toLocaleString('en-US');
const plural = (v: number, word: string) =>
  `${n(v)} ${word}${v === 1 ? '' : 's'}`;
const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);

export const pairsLayout: Layout = {
  id: 'pairs',
  label: 'Pairs',
  caption:
    'People who committed to the same file in the same week, joined by a chord as wide as the weeks they did. Sweeping commits (over 20 files), bots and non-source files are left out.',
  focusKinds: ['person'],
  needsCommits: false,
  build: (input, viewport) =>
    pairsScene(parallelPairsOf(input.report), viewport, { focus: input.focus }),
};

export function parallelDevFindings(input: ViewInput): Finding[] {
  const { report } = input;
  const data = parallelPairsOf(report);
  const findings: Finding[] = [];
  const nameOf = new Map(
    report.contributors.contributors.map((c) => [c.email, c.name]),
  );

  const [top] = data.allPairs;
  if (top) {
    const segments: Finding['segments'] = [
      { ref: ids.person(top.a), text: nameOf.get(top.a) ?? top.a },
      ' and ',
      { ref: ids.person(top.b), text: nameOf.get(top.b) ?? top.b },
      ` committed to the same files in ${plural(top.weeks, 'week')}`,
    ];
    const files = top.files.slice(0, 2);
    files.forEach((f, i) => {
      segments.push(i === 0 ? ': ' : ', ');
      segments.push({ ref: ids.file(f), text: baseName(f) });
    });
    segments.push('.');
    findings.push({ id: 'top-pair', tone: 'notable', segments });
  }

  // The file people meet on most, and its lockstep family if it has one.
  const hot = [...report.parallelDev.files].sort(
    (a, b) =>
      b.parallelWeeks - a.parallelWeeks || b.parallelScore - a.parallelScore,
  )[0];
  if (hot) {
    const family = lockstepGroups(report).find((g) => g.includes(hot.file));
    findings.push({
      id: 'hot-file',
      tone: 'neutral',
      segments: [
        { ref: ids.file(hot.file), text: baseName(hot.file) },
        ` had two or more people in ${n(hot.parallelWeeks)} of its ${plural(hot.totalActiveWeeks, 'active week')}` +
          (family
            ? `, one of ${n(family.length)} files that change together.`
            : '.'),
      ],
    });
  }

  const { sweepingCommits, botCommits } = data.leftOut;
  if (sweepingCommits + botCommits > 0)
    findings.push({
      id: 'left-out',
      tone: 'neutral',
      segments: [
        `Left out ${plural(sweepingCommits, 'sweeping commit')} (over 20 files) and ${plural(botCommits, 'bot commit')}: two big commits in one week aren’t people coordinating.`,
      ],
    });
  return findings;
}

export const PARALLEL_TIER_NAMES = [
  'Low',
  'Medium',
  'High',
  'Critical',
] as const;

/** The files people collided on (two or more weeks), most weeks first. */
export function parallelDevTable(input: ViewInput): LensTable {
  return {
    columns: [
      { id: 'file', label: 'File' },
      { id: 'weeks', label: 'Weeks with 2+ people', numeric: true },
      { id: 'active', label: 'Active weeks', numeric: true },
      { id: 'peak', label: 'Most people in a week', numeric: true },
      { id: 'score', label: 'Score', numeric: true },
      { id: 'package', label: 'Package' },
    ],
    rows: input.report.parallelDev.files.map((f) => ({
      id: ids.file(f.file),
      tier:
        f.parallelScore >= 75
          ? 3
          : f.parallelScore >= 50
            ? 2
            : f.parallelScore >= 25
              ? 1
              : 0,
      search: f.file.toLowerCase(),
      cells: {
        file: f.file,
        weeks: f.parallelWeeks,
        active: f.totalActiveWeeks,
        peak: f.peakAuthors,
        score: f.parallelScore,
        package: packageOf(f.file) || '(root)',
      },
    })),
    tierNames: PARALLEL_TIER_NAMES,
    sort: { column: 'weeks', descending: true },
  };
}

export const parallelDevView: AnalyzerView = {
  id: 'parallel-dev',
  layouts: [pairsLayout],
  findings: parallelDevFindings,
  table: parallelDevTable,
};
