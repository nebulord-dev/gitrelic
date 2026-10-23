// Team & Activity › Parallel Dev: who committed to the same files in the same
// weeks, as a circle of pairs (docs/atlas-views.md › Parallel Dev), with
// Collision lanes (where and when) as its one alternate form.

import { ids } from '../ids';
import { collisionsScene } from '../layouts/collisions';
import { pairsScene } from '../layouts/pairs';
import { collisionsOf } from '../parallel/collisions';
import { parallelPairsOf } from '../parallel/pairs';
import { packagesOf } from '../report/packages';
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

export const collisionsLayout: Layout = {
  id: 'collisions',
  label: 'Collision lanes',
  caption:
    'The files people collided on, weeks across: each mark is a week two or more people committed to the file, one dot per person in their status colour. Files that nearly always change together share a row.',
  focusKinds: ['person', 'file'],
  needsCommits: false,
  build: (input, viewport) =>
    collisionsScene(collisionsOf(input.report), viewport, {
      focus: input.focus,
    }),
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

  // The file people meet on most, and its family if it has one (the same
  // row Collision lanes draws it in).
  const hot = [...report.parallelDev.files].sort(
    (a, b) =>
      b.parallelWeeks - a.parallelWeeks || b.parallelScore - a.parallelScore,
  )[0];
  if (hot) {
    const size = collisionsOf(report).familyOf.get(hot.file)?.length ?? 1;
    findings.push({
      id: 'hot-file',
      tone: 'neutral',
      segments: [
        { ref: ids.file(hot.file), text: baseName(hot.file) },
        ` had two or more people in ${n(hot.parallelWeeks)} of its ${plural(hot.totalActiveWeeks, 'active week')}` +
          (size > 1 ? `, one of ${n(size)} files that change together.` : '.'),
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

/**
 * Score floors of the table's tiers: core's own (`tierMix` in
 * `analyzers/parallel-dev.ts`: 0–24 low, 25–49 medium, 50–74 high, 75+
 * critical). Keep the two in step.
 */
export const PARALLEL_TIERS = [25, 50, 75] as const;

export const PARALLEL_TIER_NAMES = [
  'Low',
  'Medium',
  'High',
  'Critical',
] as const;

/** People named in the table's People column before "+N more". */
export const TABLE_PEOPLE_NAMED = 3;

/**
 * Who collided on a file, most collision weeks first (ties by name): every
 * person in its windows, each with the weeks they were in.
 */
export function filePeople(
  file: { windows: { authors: string[] }[] },
  nameOf: ReadonlyMap<string, string>,
): { name: string; weeks: number }[] {
  const weeks = new Map<string, number>();
  for (const w of file.windows)
    for (const a of w.authors) weeks.set(a, (weeks.get(a) ?? 0) + 1);
  return [...weeks]
    .map(([email, k]) => ({ name: nameOf.get(email) ?? email, weeks: k }))
    .sort((x, y) => y.weeks - x.weeks || x.name.localeCompare(y.name));
}

/** The files people collided on (two or more weeks), most weeks first. */
export function parallelDevTable(input: ViewInput): LensTable {
  const nameOf = new Map(
    input.report.contributors.contributors.map((c) => [c.email, c.name]),
  );
  return {
    columns: [
      { id: 'file', label: 'File' },
      { id: 'people', label: 'People' },
      { id: 'weeks', label: 'Weeks with 2+ people', numeric: true },
      { id: 'active', label: 'Active weeks', numeric: true },
      { id: 'peak', label: 'Most people in a week', numeric: true },
      { id: 'score', label: 'Score', numeric: true },
      { id: 'package', label: 'Package' },
    ],
    rows: input.report.parallelDev.files.map((f) => {
      const people = filePeople(f, nameOf);
      const named = people.slice(0, TABLE_PEOPLE_NAMED).map((p) => p.name);
      const more = people.length - named.length;
      return {
        id: ids.file(f.file),
        tier: PARALLEL_TIERS.filter((floor) => f.parallelScore >= floor)
          .length as 0 | 1 | 2 | 3,
        // Names too, so filtering by a person finds the files they met on.
        search: [f.file, ...people.map((p) => p.name)].join(' ').toLowerCase(),
        cells: {
          file: f.file,
          people: named.join(', ') + (more > 0 ? ` +${n(more)}` : ''),
          weeks: f.parallelWeeks,
          active: f.totalActiveWeeks,
          peak: f.peakAuthors,
          score: f.parallelScore,
          package: packagesOf(input.report)(f.file) || '(root)',
        },
      };
    }),
    tierNames: PARALLEL_TIER_NAMES,
    sort: { column: 'weeks', descending: true },
  };
}

export const parallelDevView: AnalyzerView = {
  id: 'parallel-dev',
  layouts: [pairsLayout, collisionsLayout],
  findings: parallelDevFindings,
  table: parallelDevTable,
};
