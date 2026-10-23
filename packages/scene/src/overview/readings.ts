// What the Overview ring shows for each lens: a short reading ("811
// single-owner") and how far outside normal it sits (the outlier grade from
// the badge rules; lenses without a rule read 0, descriptive by design).

import { outlierGrades, type OutlierGrade } from '../badges';
import { CATALOG, type CatalogEntry, type PresetGroup } from '../catalog';
import { fixRateOf } from '../fixRate/points';
import { filesInTier } from '../report/ageTiers';
import type { GitrelicReport } from '@gitrelic/core';

export interface LensReading {
  preset: string;
  label: string;
  group: PresetGroup;
  grade: OutlierGrade;
  /** A few words: the number that matters, and what it counts. */
  value: string;
  /** The grade's reason in a sentence, when a rule graded it. */
  reason?: string;
}

const n = (x: number) => x.toLocaleString();
const pct = (x: number) => `${Math.round(x)}%`;

/** One reading per lens. Missing data reads as an em dash, never as zero. */
const VALUE: Record<string, (r: GitrelicReport) => string> = {
  hotspots: (r) =>
    `${n(r.hotspots.files.filter((h) => h.category === 'critical').length)} critical`,
  churn: (r) => {
    const top = r.churn.topFiles[0];
    return top ? `${n(top.commitCount)} commits, top file` : '—';
  },
  'cursed-files': (r) => `${n(r.cursedFiles.files.length)} files`,
  'dead-code': (r) => `${n(r.deadCode.totalDeadFiles)} untouched`,
  'blast-radius': (r) =>
    `${n(r.blastRadius.files.filter((f) => f.blastScore >= 70).length)} load-bearing`,
  'complexity-trend': (r) =>
    `${n(r.complexityTrend.files.filter((f) => f.trend === 'growing').length)} growing`,
  'age-map': (r) => `${n(filesInTier(r.ageMap, 'ancient').length)} ancient`,
  'rewrite-ratio': (r) => `${n(r.rewriteRatio.highRewrite)} high rewrite`,
  'fix-rate': (r) => {
    const { available, points } = fixRateOf(r);
    return available
      ? `${n(points.filter((p) => p.aboveChance).length)} above chance`
      : '—';
  },
  'bus-factor': (r) => `${n(r.busFactors.criticalFiles.length)} single-owner`,
  coupling: (r) => `${n(r.coupling.pairs.length)} pairs`,
  'knowledge-silos': (r) =>
    r.knowledgeConcentration.totalFiles > 0
      ? `${pct(r.knowledgeConcentration.concentrationIndex)} one author`
      : '—',
  'ghost-files': (r) => `${n(r.ghostFiles.totalGhostFiles)} files`,
  contributors: (r) =>
    `${n(r.contributors.ghostContributors.length)} ghosts of ${n(r.contributors.contributors.length)}`,
  'parallel-dev': (r) => `${n(r.parallelDev.totalParallelFiles)} files`,
  'commit-timing': (r) =>
    `${pct(r.commitTiming.offHours.rate * 100)} off-hours`,
  'co-authors': (r) => `${pct(r.coAuthors.aiAdoptionPercent)} AI-assisted`,
  languages: (r) => {
    const top = r.loc.languages[0];
    return top ? `${top.language} ${pct(top.percentage)}` : '—';
  },
  'test-coverage': (r) =>
    `${n(r.testCoverage.uncoveredDirectories.length)} untested dirs`,
  renames: (r) => `${n(r.renameTracking.totalRenames)} renames`,
};

export interface RepoReading {
  /** The repo's name (not the branch: a feature branch won't fit the ring). */
  label: string;
  /** Its size: "7,009 files · 999K lines". */
  sub: string;
}

// English on purpose, both numbers: the words around them are English, and
// a mixed line ("7.009 files · 999K lines" in German) reads as a typo. The
// viewer's locale would also lengthen it (German compact notation doesn't
// shorten thousands), and a longer line drops out of the ring sooner.
const en = new Intl.NumberFormat('en');
const compact = new Intl.NumberFormat('en', { notation: 'compact' });

/** What the ring's centre says about the repo itself. */
export function repoReading(report: GitrelicReport): RepoReading {
  const lines = report.loc.totalLines;
  return {
    label: report.repoName,
    sub: [
      `${en.format(report.meta.totalFiles)} files`,
      ...(lines > 0 ? [`${compact.format(lines)} lines`] : []),
    ].join(' · '),
  };
}

/** Every lens outside the Overview view, in catalog (lens-bar) order. */
export function lensReadings(report: GitrelicReport): LensReading[] {
  const grades = outlierGrades(report);
  return CATALOG.filter((e: CatalogEntry) => e.group !== 'overview').map(
    (e) => {
      const graded = grades.get(e.id);
      return {
        preset: e.id,
        label: e.label,
        group: e.group,
        grade: graded?.grade ?? 0,
        value: VALUE[e.id]?.(report) ?? '—',
        reason: graded && graded.grade > 0 ? graded.reason : undefined,
      };
    },
  );
}
