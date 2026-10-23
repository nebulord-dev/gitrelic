// Rail badges, for outliers only. Classic's sidebar badged almost every
// analyzer with a raw count, and several of those counts can never be zero
// (churn and hotspot scores are scaled to the top file, so the top tier always
// has members). Here a badge fires only when a problem covers an unusual share
// of the repo, or crosses an absolute score that isn't scaled; descriptive
// analyzers (languages, renames, co-authors…) never badge.
//
// Every threshold lives in RULES so tuning is a one-line change; the badge
// shows the count of flagged items. The Overview ring grades every lens from
// the same table (outlierGrades), so the badge and the ring always agree.
//
// Age badges dormant packages, not old files: React has 979 source files
// unchanged for a year, which says the codebase is mature, and one package
// nobody has touched in three years, which asks for a decision.

import { fixRateOf } from './fixRate/points';
import type { GitrelicReport } from '@gitrelic/core';

export interface Badge {
  preset: string;
  count: number;
  /** Plain-language reason, for the badge's tooltip. */
  reason: string;
}

interface Rule {
  preset: string;
  /** The flagged items and the population they're a share of. */
  measure: (r: GitrelicReport) => { count: number; of: number };
  /** Fires when count / of reaches this share (0 = any count fires). */
  share: number;
  /** …and count reaches at least this. */
  min: number;
  reason: (count: number, of: number) => string;
}

const pct = (count: number, of: number) =>
  `${Math.round((count / Math.max(1, of)) * 100)}%`;

export const RULES: readonly Rule[] = [
  {
    preset: 'hotspots',
    // Scores are scaled to the top file, so "critical" always has members;
    // only a crowd of near-top files is unusual.
    measure: (r) => ({
      count: r.hotspots.files.filter((h) => h.category === 'critical').length,
      of: r.hotspots.files.length,
    }),
    share: 0.05,
    min: 3,
    reason: (c, of) =>
      `${c} critical hotspots (${pct(c, of)} of tracked files that changed)`,
  },
  {
    preset: 'cursed-files',
    // Curse scores are absolute; the 70+ "critical" tier is effectively
    // unreachable, so 50+ is the high bar.
    measure: (r) => ({
      count: r.cursedFiles.files.filter((f) => f.curseScore >= 50).length,
      of: r.meta.totalFiles,
    }),
    share: 0,
    min: 1,
    reason: (c) => `${c} file${c === 1 ? '' : 's'} with a curse score of 50+`,
  },
  {
    preset: 'fix-rate',
    // "Above chance" already adapts to the repo's own rate, so any one fires.
    measure: (r) => {
      const { points } = fixRateOf(r);
      return {
        count: points.filter((p) => p.aboveChance).length,
        of: points.length,
      };
    },
    share: 0,
    min: 1,
    reason: (c) =>
      `${c} file${c === 1 ? ' is' : 's are'} fixed more often than chance`,
  },
  {
    preset: 'age-map',
    measure: (r) => ({
      count: r.ageMap.dormantPackages.length,
      of: r.meta.totalFiles,
    }),
    share: 0,
    min: 1,
    reason: (c) =>
      `${c} package${c === 1 ? '' : 's'} with no source change in a year`,
  },
  {
    preset: 'bus-factor',
    measure: (r) => ({
      count: r.busFactors.criticalFiles.length,
      of: r.busFactors.files.length,
    }),
    share: 0.25,
    min: 1,
    reason: (c, of) => `${pct(c, of)} of files rest on one author`,
  },
  {
    preset: 'knowledge-silos',
    measure: (r) => ({
      count: r.knowledgeConcentration.singleAuthorFiles,
      of: r.knowledgeConcentration.totalFiles,
    }),
    share: 0.6,
    min: 1,
    reason: (c, of) => `${pct(c, of)} of files have a single dominant author`,
  },
  {
    preset: 'ghost-files',
    measure: (r) => ({
      count: r.ghostFiles.totalGhostFiles,
      of: r.meta.totalFiles,
    }),
    share: 0.05,
    min: 1,
    reason: (c, of) => `${pct(c, of)} of files are owned by inactive people`,
  },
  {
    preset: 'parallel-dev',
    measure: (r) => ({
      count: r.parallelDev.highParallel,
      of: r.meta.totalFiles,
    }),
    share: 0.02,
    min: 1,
    reason: (c) =>
      `${c} file${c === 1 ? '' : 's'} with heavy same-week editing`,
  },
  {
    preset: 'commit-timing',
    // Packages changed off-hours more than the repo's rate explains (core's
    // binomial test, as Fix rate's), of the packages with enough commits to
    // test. Classic's per-file stress counted files from three commits.
    measure: (r) => ({
      count: r.commitTiming.offHours.packages.filter((p) => p.aboveChance)
        .length,
      of: r.commitTiming.offHours.packages.length,
    }),
    share: 0.1,
    min: 2,
    reason: (c) =>
      `${c} package${c === 1 ? '' : 's'} changed off-hours more than chance explains`,
  },

  {
    preset: 'test-coverage',
    measure: (r) => ({
      count: r.testCoverage.uncoveredDirectories.length,
      of: r.testCoverage.directories.length,
    }),
    share: 0.5,
    min: 1,
    reason: (c, of) => `${pct(c, of)} of directories have no tests nearby`,
  },
];

export type OutlierGrade = 0 | 1 | 2 | 3;

export interface Outlier {
  preset: string;
  /** 0 quiet · 1 approaching the bar · 2 over it (badged) · 3 far over. */
  grade: OutlierGrade;
  count: number;
  of: number;
  reason: string;
}

/**
 * Every rule's reading as a grade. A share rule grades by how far its share
 * is from the threshold (half way: 1; reached: 2; doubled: 3); an absolute
 * rule (share 0) by count against its minimum (reached: 2; five times: 3).
 * Grade 2 and up is exactly when the badge fires.
 */
export function outlierGrades(report: GitrelicReport): Map<string, Outlier> {
  const out = new Map<string, Outlier>();
  for (const rule of RULES) {
    const { count, of } = rule.measure(report);
    let grade: OutlierGrade = 0;
    if (of > 0 && count > 0) {
      if (rule.share === 0) {
        if (count >= rule.min * 5) grade = 3;
        else if (count >= rule.min) grade = 2;
      } else {
        const ratio = count / of / rule.share;
        if (ratio >= 2 && count >= rule.min) grade = 3;
        else if (ratio >= 1 && count >= rule.min) grade = 2;
        else if (ratio >= 0.5) grade = 1;
      }
    }
    out.set(rule.preset, {
      preset: rule.preset,
      grade,
      count,
      of,
      reason: rule.reason(count, of),
    });
  }
  return out;
}

/** Badges that fire for `report`, keyed by preset id. */
export function computeOutlierBadges(
  report: GitrelicReport,
): Map<string, Badge> {
  const out = new Map<string, Badge>();
  for (const o of outlierGrades(report).values()) {
    if (o.grade < 2) continue;
    out.set(o.preset, { preset: o.preset, count: o.count, reason: o.reason });
  }
  return out;
}
