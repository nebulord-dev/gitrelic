// Parallel Dev's Collision lanes (docs/atlas-views.md › Parallel Dev): the
// files people collided on as rows, each week two or more people committed
// to one as a stack of those people. Read from core's per-file `windows`
// (every collision week), so no commit history is needed.
//
// Files that nearly always change together are one row: a feature flag
// flipped across eight forks is one collision, not eight rows of the same
// dots. Families use Root causes' rule (`FAMILY_STRENGTH` of the busier
// file's commits, over `FAMILY_COMMITS`), looser than Churn's lockstep: on
// React the lockstep rule left three flag forks as rows of their own. The row
// is drawn as its member with the most collision weeks, and named after the
// family (`ReactFeatureFlags.*`).
//
// Weeks are the time strip's (Monday-start UTC, from the history's first
// commit to its last); past two years they're months (`timeBins`).

import { personStatus, type PersonStatus } from '../contributors/flow';
import { packagesOf } from '../report/packages';
import {
  FAMILY_COMMITS,
  FAMILY_STRENGTH,
  familyName,
  together,
} from '../risk/rootCauses';
import { timeBins } from '../time/bins';
import type { GitrelicReport } from '@gitrelic/core';

/** Rows drawn; the table lists every file. */
export const COLLISION_ROWS = 14;

export interface CollisionPerson {
  email: string;
  name: string;
  status: PersonStatus;
}

export interface CollisionMark {
  /** Index into `Collisions.binStarts`. */
  bin: number;
  /** Who committed to the row's files that bin, most of the row first. */
  people: CollisionPerson[];
}

export interface CollisionRow {
  /** The file the row is drawn as (the family's busiest member). */
  file: string;
  /** Its package (`packagesOf`); '' for the repository root. */
  package: string;
  /** Every file in the row, most collision weeks first. */
  members: string[];
  /** The family's name, or null for a single file. */
  family: string | null;
  /** Bins with a collision, oldest first. */
  marks: CollisionMark[];
  /** Distinct collision weeks across its files. */
  weeks: number;
}

export interface Collisions {
  unit: 'week' | 'month';
  binStarts: number[];
  rows: CollisionRow[];
  /** Rows past `COLLISION_ROWS`, left to the table. */
  hidden: number;
  /**
   * Every listed file's row-mates (itself included), drawn or not, so a
   * finding names the same family the lanes would, past the cap too.
   */
  familyOf: ReadonlyMap<string, readonly string[]>;
}

export function collisions(report: GitrelicReport): Collisions {
  const files = report.parallelDev.files;
  const pkgOf = packagesOf(report);
  const first = Date.parse(report.meta.firstCommit);
  const last = Date.parse(report.meta.lastCommit);
  // timeBins only reads the span; two instants give the strip's bins.
  const span = [first, last]
    .filter(Number.isFinite)
    .map((timeMs) => ({ timeMs, author: '', files: [] }));
  const { unit, binStarts, binOf } = timeBins(span);
  if (files.length === 0 || binStarts.length === 0)
    return { unit, binStarts, rows: [], hidden: 0, familyOf: new Map() };

  const byEmail = new Map(
    report.contributors.contributors.map((c) => [c.email, c]),
  );
  const person = (email: string): CollisionPerson => {
    const c = byEmail.get(email);
    return {
      email,
      name: c?.name ?? email,
      // Someone the contributors report doesn't list counts as quiet.
      status: c ? personStatus(c) : 'quiet',
    };
  };

  // Families among the listed files (union-find); everything else is a row
  // of its own.
  const listed = new Map(files.map((f) => [f.file, f]));
  const parent = new Map(files.map((f) => [f.file, f.file]));
  const find = (f: string): string => {
    let root = f;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(f, root);
    return root;
  };
  for (const p of report.coupling.pairs) {
    if (!listed.has(p.fileA) || !listed.has(p.fileB)) continue;
    if (!together(p, FAMILY_STRENGTH, FAMILY_COMMITS)) continue;
    parent.set(find(p.fileA), find(p.fileB));
  }
  const groupOf = new Map<string, string[]>();
  for (const f of files) {
    const root = find(f.file);
    groupOf.set(root, [...(groupOf.get(root) ?? []), f.file]);
  }
  for (const [root, members] of [...groupOf]) {
    groupOf.delete(root);
    for (const m of members) groupOf.set(m, members);
  }
  const seen = new Set<string>();
  const rows: CollisionRow[] = [];
  for (const f of files) {
    if (seen.has(f.file)) continue;
    const members = (groupOf.get(f.file) ?? [f.file])
      .map((m) => listed.get(m)!)
      .sort(
        (a, b) =>
          b.parallelWeeks - a.parallelWeeks || a.file.localeCompare(b.file),
      );
    for (const m of members) seen.add(m.file);

    // Per bin, everyone across the row's files, by how many of its files
    // they were on that bin.
    const bins = new Map<number, Map<string, number>>();
    const weeks = new Set<string>();
    for (const m of members) {
      for (const w of m.windows) {
        // Counted even if a window fell outside the bins (it can't, with
        // bins spanning the history): weeks are the files' own count.
        weeks.add(w.weekStart);
        const b = binOf(Date.parse(w.weekStart));
        if (b < 0 || b >= binStarts.length) continue;
        let who = bins.get(b);
        if (!who) bins.set(b, (who = new Map()));
        for (const a of w.authors) who.set(a, (who.get(a) ?? 0) + 1);
      }
    }
    rows.push({
      file: members[0].file,
      package: pkgOf(members[0].file),
      members: members.map((m) => m.file),
      family:
        members.length > 1 ? familyName(members.map((m) => m.file)) : null,
      weeks: weeks.size,
      marks: [...bins]
        .sort((x, y) => x[0] - y[0])
        .map(([bin, who]) => ({
          bin,
          people: [...who]
            .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
            .map(([e]) => person(e)),
        })),
    });
  }
  rows.sort((a, b) => b.weeks - a.weeks || a.file.localeCompare(b.file));
  return {
    unit,
    binStarts,
    rows: rows.slice(0, COLLISION_ROWS),
    hidden: Math.max(0, rows.length - COLLISION_ROWS),
    familyOf: new Map(
      rows.flatMap((r) => r.members.map((m) => [m, r.members])),
    ),
  };
}

const cache = new WeakMap<GitrelicReport, Collisions>();
/** `collisions`, computed once per report. */
export function collisionsOf(report: GitrelicReport): Collisions {
  let data = cache.get(report);
  if (!data) {
    data = collisions(report);
    cache.set(report, data);
  }
  return data;
}
