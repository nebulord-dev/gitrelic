// Churn as a swarm (docs/atlas-views.md › Churn): the source files churn
// reports, grouped by package, each with its commits and how it changes —
// what the swarm, the findings, the table and the inspector all read.
//
// Tests, fixtures and generated files stay out, as in classic's source Churn
// tab. A file's character comes from rewrite ratio's line counts: growing
// (mostly added), shrinking (mostly deleted), rewriting (rewrite ratio's own
// "doesn't stick" bar), or tweaking (everything else: balanced, small edits).

import { makeFileKind } from '../files/fileKind';
import { REWRITE_HOT } from '../hotspots/facets';
import { packagesOf } from '../report/packages';
import type { ChurnCategory, GitrelicReport } from '@gitrelic/core';

/** Files with this many commits or fewer sit in the swarm's grey band. */
export const QUIET_COMMITS = 2;
/** One side's lines must be this many times the other's to call it growing or shrinking. */
export const LOPSIDED = 3;

export type ChurnCharacter = 'tweaking' | 'rewriting' | 'growing' | 'shrinking';
export type ChurnTier = 0 | 1 | 2 | 3;

export interface SwarmFile {
  file: string;
  commits: number;
  insertions: number;
  deletions: number;
  /** Null when rewrite ratio has no line counts for it. */
  character: ChurnCharacter | null;
  /** Core's churn category: frozen 0 … hot 3. */
  tier: ChurnTier;
}

export interface SwarmRow {
  /** The files' package (`packagesOf`); '' for the repository root. */
  dir: string;
  /** Commits summed over its files: a commit touching three files counts three times. */
  total: number;
  /** Most commits first. */
  files: SwarmFile[];
  /** Files with QUIET_COMMITS or fewer. */
  quiet: number;
}

const TIER: Record<ChurnCategory, ChurnTier> = {
  frozen: 0,
  cold: 1,
  warm: 2,
  hot: 3,
};

export const CHURN_TIER_NAMES = ['Frozen', 'Cold', 'Warm', 'Hot'] as const;

export function churnCharacter(
  insertions: number,
  deletions: number,
  rewriteScore: number,
): ChurnCharacter | null {
  if (insertions === 0 && deletions === 0) return null;
  if (rewriteScore >= REWRITE_HOT) return 'rewriting';
  if (insertions >= LOPSIDED * deletions) return 'growing';
  if (deletions >= LOPSIDED * insertions) return 'shrinking';
  return 'tweaking';
}

/** Every package with source churn, biggest total first. */
export function churnSwarm(report: GitrelicReport): SwarmRow[] {
  const kindOf = makeFileKind(report);
  const pkgOf = packagesOf(report);
  const lines = new Map(report.rewriteRatio.files.map((r) => [r.file, r]));
  const rows = new Map<string, SwarmRow>();
  for (const f of report.churn.files) {
    if (f.commitCount <= 0 || kindOf(f.file) !== 'source') continue;
    const rr = lines.get(f.file);
    const file: SwarmFile = {
      file: f.file,
      commits: f.commitCount,
      insertions: rr?.totalInsertions ?? 0,
      deletions: rr?.totalDeletions ?? 0,
      character: rr
        ? churnCharacter(rr.totalInsertions, rr.totalDeletions, rr.rewriteScore)
        : null,
      tier: TIER[f.category] ?? 0,
    };
    const dir = pkgOf(f.file);
    let row = rows.get(dir);
    if (!row) {
      row = { dir, total: 0, files: [], quiet: 0 };
      rows.set(dir, row);
    }
    row.total += file.commits;
    row.files.push(file);
    if (file.commits <= QUIET_COMMITS) row.quiet++;
  }
  for (const row of rows.values())
    row.files.sort(
      (a, b) => b.commits - a.commits || (a.file < b.file ? -1 : 1),
    );
  return [...rows.values()].sort(
    (a, b) => b.total - a.total || (a.dir < b.dir ? -1 : 1),
  );
}

const cache = new WeakMap<GitrelicReport, readonly SwarmRow[]>();
/** `churnSwarm`, computed once per report: the layout, findings, table and inspector share it. */
export function churnSwarmOf(report: GitrelicReport): readonly SwarmRow[] {
  let rows = cache.get(report);
  if (!rows) {
    rows = churnSwarm(report);
    cache.set(report, rows);
  }
  return rows;
}

/** Changes per file: how hard a package churns, whatever its size. */
export const perFile = (row: SwarmRow) =>
  row.files.length > 0 ? row.total / row.files.length : 0;

const n = (v: number) => v.toLocaleString('en-US');
const plural = (k: number, one: string) =>
  `${n(k)} ${one}${k === 1 ? '' : 's'}`;

/** A package's name as the swarm shows it. */
export const rowName = (dir: string) => (dir === '' ? '(root)' : `${dir}/`);

/** A file dot's tooltip: name, commits, lines added and deleted, character. */
export function swarmFileTip(f: SwarmFile, name: string): string[] {
  const tip = [name, plural(f.commits, 'commit')];
  if (f.insertions > 0 || f.deletions > 0)
    tip.push(`+${n(f.insertions)} −${n(f.deletions)} lines`);
  if (f.character) tip.push(f.character);
  return tip;
}

/** A row's tooltip: its total, file count and quiet files. */
export function swarmRowTip(row: SwarmRow): string[] {
  return [
    rowName(row.dir),
    `${plural(row.total, 'change')} across ${plural(row.files.length, 'file')}`,
    `${n(row.quiet)} with one or two commits`,
  ];
}
