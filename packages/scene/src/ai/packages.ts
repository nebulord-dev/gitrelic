// AI & Co-authors' Where AI writes (docs/atlas-views.md › AI & Co-authors):
// each package's commits, and how many had AI in them, assisted (a person's
// commit with an AI co-author) or authored (an AI agent's own commit).
//
// The repo's rows come from core's `coAuthors.packages`, so the lens draws
// with the lite report. A person's come from the commit index, with core's
// rules: sweeping commits (Fix rate's size) and bot commits left out, and
// only files the analyzed commit still has.

import { classifyAuthor } from '../authors/authorClassification';
import { packageOf } from '../hotspots/points';
import { REPO_ID, ids, type EntityId } from '../ids';
import { SWEEPING_COMMIT_FILES } from '../timing/punchCard';
import type { CommitLike } from '../commits/commitLike';
import type { CoAuthorPackage, GitrelicReport } from '@gitrelic/core';

/** Rows drawn; the rest are counted for a "+N more in the table" note. */
export const AI_PACKAGE_ROWS = 18;

export interface AiPackageRow {
  id: EntityId;
  /** Core's package ('' is the root). */
  package: string;
  /** Its name on the stage: `packages/` dropped, as in Churn. */
  name: string;
  commits: number;
  assisted: number;
  authored: number;
}

export interface AiPackages {
  /** Every package, most commits first. */
  rows: AiPackageRow[];
  /** Commits counted (each once, however many packages it touched). */
  commits: number;
  /** Of those, with AI in them. */
  ai: number;
}

export const aiPackageName = (pkg: string) =>
  pkg === '' ? '(root)' : pkg.replace(/^packages\//, '');
export const aiPackageId = (pkg: string): EntityId =>
  pkg === '' ? REPO_ID : ids.dir(pkg);

const row = (p: CoAuthorPackage): AiPackageRow => ({
  id: aiPackageId(p.package),
  package: p.package,
  name: aiPackageName(p.package),
  commits: p.commits,
  assisted: p.aiAssisted,
  authored: p.aiAuthored,
});

const byCommits = (a: AiPackageRow, b: AiPackageRow) =>
  b.commits - a.commits || a.package.localeCompare(b.package);

const cache = new WeakMap<GitrelicReport, AiPackages>();
/** The repo's packages from core, computed once per report. */
export function aiPackagesOf(report: GitrelicReport): AiPackages {
  let out = cache.get(report);
  if (!out) {
    const { coAuthors } = report;
    out = {
      rows: coAuthors.packages.map(row).sort(byCommits),
      commits: coAuthors.humanAuthoredCommits + coAuthors.aiAuthoredCommits,
      ai: coAuthors.aiAssistedCommits + coAuthors.aiAuthoredCommits,
    };
    cache.set(report, out);
  }
  return out;
}

/**
 * The packages of the commits `match` picks (a person's), by core's rules.
 * `commits` and `ai` count every matching non-bot commit, sweeping ones too,
 * as core's adoption share does.
 */
export function aiPackagesFrom(
  report: GitrelicReport,
  commits: readonly CommitLike[],
  match: (c: CommitLike) => boolean,
): AiPackages {
  const tracked = new Set(report.loc.files.map((f) => f.file));
  const byPackage = new Map<string, CoAuthorPackage>();
  let total = 0;
  let ai = 0;
  for (const c of commits) {
    if (!match(c) || classifyAuthor(c.author) === 'bot') continue;
    total++;
    if ((c.ai ?? 0) > 0) ai++;
    if (c.files.length > SWEEPING_COMMIT_FILES) continue;
    const touched = new Set(
      c.files
        .filter((f) => tracked.size === 0 || tracked.has(f))
        .map(packageOf),
    );
    for (const pkg of touched) {
      const p = byPackage.get(pkg) ?? {
        package: pkg,
        commits: 0,
        aiAssisted: 0,
        aiAuthored: 0,
      };
      p.commits++;
      if (c.ai === 2) p.aiAuthored++;
      else if (c.ai === 1) p.aiAssisted++;
      byPackage.set(pkg, p);
    }
  }
  return {
    rows: [...byPackage.values()].map(row).sort(byCommits),
    commits: total,
    ai,
  };
}
