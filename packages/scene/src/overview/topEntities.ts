// A lens's top entities, for the Overview ring's fan-out preview: clicking a
// lens fans these out of its dot, each with a few words of why. Only entities
// the index knows are returned, so every fanned mark is selectable; the ids
// are the ones the lens's own view will use, so the marks can travel into it.

import { sinceText } from '../age/strata';
import { fixRateOf } from '../fixRate/points';
import { ids, type EntityId } from '../ids';
import type { EntityIndex } from '../entities';
import type { GitrelicReport } from '@gitrelic/core';

export interface FannedEntity {
  id: EntityId;
  label: string;
  value: string;
}

const n = (x: number) => x.toLocaleString();

/**
 * A file is a silo when one author wrote more than this share. Mirrors core's
 * SINGLE_AUTHOR_THRESHOLD (analyzers/knowledge-concentration.ts), which the
 * browser can't import; keep the two equal.
 */
const SILO_PERCENT = 80;

/** Lines deleted per line added; `ratio` itself is a 0–1 balance score. */
function rewriteRate(insertions: number, deletions: number): string {
  if (insertions === 0) return `${n(deletions)} deleted, none added`;
  return `${(deletions / insertions).toFixed(2)} deleted per line added`;
}
const base = (path: string) => path.slice(path.lastIndexOf('/') + 1);
/** A directory's last two segments: enough to tell `react-server/src/` apart. */
const shortDir = (dir: string) => `${dir.split('/').slice(-2).join('/')}/`;

type Candidate = { id: EntityId; label: string; value: string };
const file = (path: string, value: string): Candidate => ({
  id: ids.file(path),
  label: base(path),
  value,
});

const byDesc = <T>(list: readonly T[], key: (x: T) => number): T[] =>
  [...list].sort((a, b) => key(b) - key(a));

/** Candidates in rank order; the caller keeps what the index resolves. */
const SOURCES: Record<string, (r: GitrelicReport) => Candidate[]> = {
  hotspots: (r) =>
    byDesc(r.hotspots.files, (h) => h.hotspotScore).map((h) =>
      file(h.file, `score ${h.hotspotScore}`),
    ),
  churn: (r) =>
    r.churn.topFiles.map((f) => file(f.file, `${n(f.commitCount)} commits`)),
  'cursed-files': (r) =>
    byDesc(r.cursedFiles.files, (f) => f.curseScore).map((f) =>
      file(f.file, `curse ${f.curseScore}`),
    ),
  'blast-radius': (r) =>
    r.blastRadius.topBlasters.map((f) =>
      file(f.file, `${f.avgCoChangedFiles.toFixed(1)} files per change`),
    ),
  'complexity-trend': (r) =>
    r.complexityTrend.growingFiles.map((f) =>
      file(f.file, `+${n(Math.round(f.recentGrowthRate))} lines a month`),
    ),
  // Dormant packages first (the badge's count), then orphaned files, oldest
  // first: what the lens's findings point at.
  'age-map': (r) => [
    ...r.ageMap.dormantPackages.map((d) => ({
      id: ids.dir(d.package),
      label: shortDir(d.package),
      value: `dormant ${sinceText(d.newestAgeDays)}`,
    })),
    ...byDesc(
      r.ageMap.files.filter((f) => f.orphaned && !r.fileClasses[f.file]),
      (f) => f.ageInDays,
    ).map((f) => file(f.file, `orphaned, ${sinceText(f.ageInDays)} old`)),
  ],
  'rewrite-ratio': (r) =>
    r.rewriteRatio.topRewriters.map((f) =>
      file(f.file, rewriteRate(f.totalInsertions, f.totalDeletions)),
    ),
  // Above chance first (the lens's own order), only files with a fix.
  'fix-rate': (r) =>
    fixRateOf(r)
      .points.filter((p) => p.fixedAfter > 0)
      .map((p) => file(p.file, `${n(p.fixedAfter)} of ${n(p.changes)} fixed`)),
  'bus-factor': (r) =>
    byDesc(r.busFactors.criticalFiles, (f) => f.dominantAuthorPercent).map(
      (f) =>
        file(
          f.file,
          `${f.dominantAuthor.split('@')[0]} ${f.dominantAuthorPercent}%`,
        ),
    ),
  coupling: (r) =>
    r.coupling.topPairs.map((p) =>
      file(
        p.fileA,
        `with ${base(p.fileB)} · ${Math.round(p.couplingStrength)}%`,
      ),
    ),
  'knowledge-silos': (r) =>
    byDesc(
      r.busFactors.files.filter((f) => f.dominantAuthorPercent > SILO_PERCENT),
      (f) => f.dominantAuthorPercent,
    ).map((f) =>
      file(
        f.file,
        `${f.dominantAuthor.split('@')[0]} ${f.dominantAuthorPercent}%`,
      ),
    ),
  'ghost-files': (r) =>
    r.ghostFiles.files.map((f) =>
      file(
        f.file,
        `${f.dominantAuthor.split('@')[0]}, gone ${n(f.authorInactiveDays)} days`,
      ),
    ),
  contributors: (r) =>
    byDesc(r.contributors.contributors, (c) => c.commitCount).map((c) => ({
      id: ids.person(c.email),
      label: c.name,
      value: `${n(c.commitCount)} commits${c.isGhost ? ' · gone' : ''}`,
    })),
  'parallel-dev': (r) =>
    r.parallelDev.hotFiles.map((f) =>
      file(f.file, `parallel ${f.parallelScore}`),
    ),
  // Packages above chance first (core's order), as directories; the root
  // package has no directory to select.
  'commit-timing': (r) =>
    r.commitTiming.offHours.packages
      .filter((p) => p.package !== '')
      .map((p) => ({
        id: ids.dir(p.package),
        label: shortDir(p.package),
        value: `${p.percent}% off-hours`,
      })),
  'co-authors': (r) =>
    r.coAuthors.aiAuthors.map((a) => ({
      id: ids.person(a.author),
      label: a.displayName,
      value: `${n(a.aiCommits)} AI-assisted commits`,
    })),
  'test-coverage': (r) =>
    byDesc(r.testCoverage.uncoveredDirectories, (d) => d.sourceFiles).map(
      (d) => ({
        id: ids.dir(d.directory),
        label: shortDir(d.directory),
        value: `${n(d.sourceFiles)} files, no tests`,
      }),
    ),
  renames: (r) =>
    byDesc(r.renameTracking.chains, (c) => c.renameCount).map((c) =>
      file(c.currentPath, `renamed ${c.renameCount}×`),
    ),
};

/**
 * Up to `limit` of a lens's top entities, each one the index resolves and
 * none repeated. Languages has none: it counts lines, not things.
 */
export function lensTopEntities(
  preset: string,
  report: GitrelicReport,
  index: EntityIndex,
  limit = 8,
): FannedEntity[] {
  const out: FannedEntity[] = [];
  const seen = new Set<EntityId>();
  for (const c of SOURCES[preset]?.(report) ?? []) {
    if (seen.has(c.id) || !index.get(c.id)) continue;
    seen.add(c.id);
    out.push(c);
    if (out.length === limit) break;
  }
  return disambiguate(out);
}

/**
 * Two files fanned with the same name (`index.ts`, `package.json`) get their
 * parent folder prepended, and two people with one display name their email,
 * so the ring never shows identical labels.
 */
function disambiguate(list: FannedEntity[]): FannedEntity[] {
  const count = new Map<string, number>();
  for (const e of list) count.set(e.label, (count.get(e.label) ?? 0) + 1);
  return list.map((e) => {
    if ((count.get(e.label) ?? 0) < 2) return e;
    if (e.id.startsWith('person:')) {
      // Two people under one display name (identity merging kept them
      // apart): their email tells them apart.
      return { ...e, label: `${e.label} (${e.id.slice('person:'.length)})` };
    }
    if (!e.id.startsWith('file:')) return e;
    const parts = e.id.slice('file:'.length).split('/');
    return parts.length > 1 ? { ...e, label: parts.slice(-2).join('/') } : e;
  });
}
