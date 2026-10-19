// Code Health › Churn: the per-package swarm (docs/atlas-views.md › Churn).
// Rhythm, its alternate form, is the top files week by week.

import { lockstepGroups } from '../churn/lockstep';
import { churnRhythmOf } from '../churn/rhythm';
import {
  CHURN_TIER_NAMES,
  churnSwarmOf,
  perFile,
  rowName,
  type SwarmRow,
} from '../churn/swarm';
import { ids, REPO_ID, type EntityId } from '../ids';
import { rhythmScene } from '../layouts/rhythm';
import { swarmScene } from '../layouts/swarm';
import type {
  AnalyzerView,
  Finding,
  Layout,
  LensTable,
  ViewInput,
} from '../model';

export {
  LOCKSTEP_COMMITS,
  LOCKSTEP_MIN_FILES,
  LOCKSTEP_STRENGTH,
  lockstepGroups,
} from '../churn/lockstep';

/** A package needs this many files to lead on changes per file. */
export const PER_FILE_MIN_FILES = 5;
const n = (v: number) => v.toLocaleString('en-US');
const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);
const rowId = (dir: string): EntityId => (dir === '' ? REPO_ID : ids.dir(dir));
const oneDecimal = (v: number) => v.toFixed(1).replace(/\.0$/, '');

export const swarmLayout: Layout = {
  id: 'swarm',
  label: 'Swarm',
  caption:
    'Each row is a package, each dot one of its files: commits across, log scale. The grey band holds files changed once or twice; a row’s shading is its total.',
  needsCommits: false,
  build: (input, viewport) => swarmScene(churnSwarmOf(input.report), viewport),
};

export const rhythmLayout: Layout = {
  id: 'rhythm',
  label: 'Rhythm',
  caption:
    'The files with the most commits, week by week (by month past two years); the line splits the window in half. At the right, lines deleted against added, and how the file changes. Linked rings change in lockstep.',
  needsCommits: true,
  build: (input, viewport) =>
    rhythmScene(churnRhythmOf(input.report, input.commits ?? []), viewport),
};

/** The package churning hardest per file (with enough files to say so). */
export function hardestRow(rows: readonly SwarmRow[]): SwarmRow | undefined {
  return rows
    .filter((r) => r.files.length >= PER_FILE_MIN_FILES)
    .reduce<SwarmRow | undefined>(
      (best, r) => (!best || perFile(r) > perFile(best) ? r : best),
      undefined,
    );
}

export function churnFindings(input: ViewInput): Finding[] {
  const rows = churnSwarmOf(input.report);
  const findings: Finding[] = [];
  const busiest = rows[0];
  if (!busiest) return findings;

  // Most changes in total against most per file: the same total can be a
  // wide low cloud or a few files changed over and over.
  const hardest = hardestRow(rows);
  const stats = (r: SwarmRow) =>
    `${n(r.total)} changes across ${n(r.files.length)} file${r.files.length === 1 ? '' : 's'}, ${oneDecimal(perFile(r))} each`;
  if (!hardest || hardest === busiest) {
    findings.push({
      id: 'leaders',
      tone: 'notable',
      segments: [
        { ref: rowId(busiest.dir), text: rowName(busiest.dir) },
        ` leads on changes: ${stats(busiest)}.`,
      ],
    });
  } else {
    findings.push({
      id: 'leaders',
      tone: 'notable',
      segments: [
        { ref: rowId(busiest.dir), text: rowName(busiest.dir) },
        ` has the most changes (${stats(busiest)}); `,
        { ref: rowId(hardest.dir), text: rowName(hardest.dir) },
        ` churns hardest per file (${stats(hardest)}).`,
      ],
    });
  }

  const [group] = lockstepGroups(input.report);
  if (group) {
    const shown = group.slice(0, 2);
    const segments: Finding['segments'] = [
      `${n(group.length)} files change commit for commit (`,
    ];
    shown.forEach((f, i) => {
      if (i > 0) segments.push(group.length === 2 ? ' and ' : ', ');
      segments.push({ ref: ids.file(f), text: baseName(f) });
    });
    const rest = group.length - shown.length;
    if (rest > 0) segments.push(` and ${n(rest)} more`);
    segments.push(`): one change, made ${n(group.length)} times.`);
    findings.push({ id: 'lockstep', tone: 'warning', segments });
  }
  return findings;
}

/** Every source file with churn, most commits first. */
export function churnTable(input: ViewInput): LensTable {
  return {
    columns: [
      { id: 'file', label: 'File' },
      { id: 'commits', label: 'Commits', numeric: true },
      { id: 'added', label: 'Added', numeric: true },
      { id: 'deleted', label: 'Deleted', numeric: true },
      { id: 'character', label: 'Character' },
      { id: 'package', label: 'Package' },
    ],
    rows: churnSwarmOf(input.report).flatMap((row) =>
      row.files.map((f) => ({
        id: ids.file(f.file),
        tier: f.tier,
        search: f.file.toLowerCase(),
        cells: {
          file: f.file,
          commits: f.commits,
          added: f.insertions,
          deleted: f.deletions,
          character: f.character ?? '',
          package: row.dir || '(root)',
        },
      })),
    ),
    tierNames: CHURN_TIER_NAMES,
    sort: { column: 'commits', descending: true },
  };
}

export const churnView: AnalyzerView = {
  id: 'churn',
  layouts: [swarmLayout, rhythmLayout],
  findings: churnFindings,
  table: churnTable,
};
