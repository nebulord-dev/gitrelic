// A lens's top entities, for the Overview ring's fan-out preview: clicking a
// lens fans these out of its dot, each with a few words of why. Only entities
// the index knows are returned, so every fanned mark is selectable; the ids
// are the ones the lens's own view will use, so the marks can travel into it.

import { ids, type EntityId } from '../ids';
import type { EntityIndex } from '../entities';
import type { GitrelicReport } from '@gitrelic/core';

export interface FannedEntity {
  id: EntityId;
  label: string;
  value: string;
}

const n = (x: number) => x.toLocaleString();
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
  'dead-code': (r) =>
    r.deadCode.candidates.map((f) =>
      file(f.file, `untouched ${n(f.ageInDays)} days`),
    ),
  'blast-radius': (r) =>
    r.blastRadius.topBlasters.map((f) =>
      file(f.file, `${f.avgCoChangedFiles.toFixed(1)} files per change`),
    ),
  'complexity-trend': (r) =>
    r.complexityTrend.growingFiles.map((f) =>
      file(f.file, `+${n(Math.round(f.recentGrowthRate))} lines a month`),
    ),
  'age-map': (r) =>
    byDesc(r.ageMap.ancientFiles, (f) => f.ageInDays).map((f) =>
      file(f.file, `${n(f.ageInDays)} days old`),
    ),
  'rewrite-ratio': (r) =>
    r.rewriteRatio.topRewriters.map((f) =>
      file(f.file, `${f.ratio.toFixed(2)} deleted per line added`),
    ),
  shame: (r) =>
    byDesc(r.forensics.files, (f) => f.shameScore)
      .filter((f) => f.shameScore > 0)
      .map((f) => file(f.file, `shame ${f.shameScore}`)),
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
      r.busFactors.files.filter((f) => f.dominantAuthorPercent >= 80),
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
      value: `${n(c.commitCount)} commits${c.isGhost ? ' · gone quiet' : ''}`,
    })),
  'parallel-dev': (r) =>
    r.parallelDev.hotFiles.map((f) =>
      file(f.file, `parallel ${f.parallelScore}`),
    ),
  'commit-timing': (r) =>
    r.commitTiming.stressFiles.map((f) =>
      file(f.file, `${Math.round(f.lateNightPercent)}% late night`),
    ),
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
  return out;
}
