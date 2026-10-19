// Code Health › Churn: the per-package swarm (docs/atlas-views.md › Churn).
// Rhythm, its alternate form, comes in a later PR.

import {
  CHURN_TIER_NAMES,
  churnSwarmOf,
  perFile,
  rowName,
  type SwarmRow,
} from '../churn/swarm';
import { makeFileKind } from '../files/fileKind';
import { ids, REPO_ID, type EntityId } from '../ids';
import { swarmScene } from '../layouts/swarm';
import type {
  AnalyzerView,
  Finding,
  Layout,
  LensTable,
  ViewInput,
} from '../model';
import type { GitrelicReport } from '@gitrelic/core';

/** A package needs this many files to lead on changes per file. */
export const PER_FILE_MIN_FILES = 5;
/** Lockstep: a pair shares at least this share of each file's commits… */
export const LOCKSTEP_STRENGTH = 90;
/** …over at least this many commits. */
export const LOCKSTEP_COMMITS = 5;
/** Files a lockstep group needs before it's a finding. */
export const LOCKSTEP_MIN_FILES = 3;

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

/** The package churning hardest per file (with enough files to say so). */
export function hardestRow(rows: readonly SwarmRow[]): SwarmRow | undefined {
  return rows
    .filter((r) => r.files.length >= PER_FILE_MIN_FILES)
    .reduce<SwarmRow | undefined>(
      (best, r) => (!best || perFile(r) > perFile(best) ? r : best),
      undefined,
    );
}

/**
 * Groups of source files that change commit for commit: pairs at
 * LOCKSTEP_STRENGTH over LOCKSTEP_COMMITS, joined into groups, biggest first.
 *
 * Core's `couplingStrength` divides by the quieter file's commits, so a small
 * file always shipped with a busy hub scores 100 while the hub moves alone
 * most of the time. Lockstep measures against the busier file instead: both
 * files must share LOCKSTEP_STRENGTH of their commits. Reads every pair in
 * `report.coupling.pairs`; a trimmed list would lose groups.
 */
export function lockstepGroups(report: GitrelicReport): string[][] {
  const kindOf = makeFileKind(report);
  const parent = new Map<string, string>();
  const find = (f: string): string => {
    let root = f;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(f, root);
    return root;
  };
  for (const p of report.coupling.pairs) {
    if (
      p.coCommits * 100 <
        LOCKSTEP_STRENGTH * Math.max(p.totalCommitsA, p.totalCommitsB) ||
      p.coCommits < LOCKSTEP_COMMITS ||
      kindOf(p.fileA) !== 'source' ||
      kindOf(p.fileB) !== 'source'
    )
      continue;
    for (const f of [p.fileA, p.fileB]) if (!parent.has(f)) parent.set(f, f);
    const a = find(p.fileA);
    const b = find(p.fileB);
    if (a !== b) parent.set(a < b ? b : a, a < b ? a : b);
  }
  const groups = new Map<string, string[]>();
  for (const f of parent.keys()) {
    const root = find(f);
    const g = groups.get(root);
    if (g) g.push(f);
    else groups.set(root, [f]);
  }
  return [...groups.values()]
    .filter((g) => g.length >= LOCKSTEP_MIN_FILES)
    .map((g) => g.sort())
    .sort((a, b) => b.length - a.length || (a[0] < b[0] ? -1 : 1));
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
  layouts: [swarmLayout],
  findings: churnFindings,
  table: churnTable,
};
