// Fix rate's data (docs/atlas-views.md › Fix rate): core's rated files, each
// set against what chance gives at the repo rate. A file is *above chance*
// when its fixed-after count has under CHANCE_TAIL probability at the repo
// rate for its number of changes (the binomial upper tail): the one threshold
// the lens, its badge, the inspector's fact and What to do share.

import type { FileFixRate, FixRateFix, GitrelicReport } from '@gitrelic/core';

/** Under this upper-tail probability, a file's count isn't chance. */
export const CHANCE_TAIL = 0.025;

/** 0 no fix · 1 one fix · 2 several, within chance · 3 above chance. */
export type FixTier = 0 | 1 | 2 | 3;
export const FIX_TIER_NAMES = [
  'No fix',
  'One fix',
  'Several fixes',
  'Above chance',
] as const;

export interface FixPoint {
  file: string;
  changes: number;
  fixedAfter: number;
  rate: number;
  /** The most fixed-after changes chance explains at this many changes. */
  allowed: number;
  aboveChance: boolean;
  tier: FixTier;
  /** Newest first, at most five (core's cap). */
  fixes: readonly FixRateFix[];
}

export interface FixRateData {
  /** False for a report from before fix rate (windowDays 0). */
  available: boolean;
  /** Rated files: above chance first, then by rate, then by changes. */
  points: FixPoint[];
  repoRate: number | null;
  windowDays: number;
  minChanges: number;
  unratedFiles: number;
}

/** P(X ≥ k) for X ~ Binomial(n, p). */
export function binomialUpperTail(n: number, k: number, p: number): number {
  if (k <= 0) return 1;
  if (k > n) return 0;
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  // P(X ≥ k) = 1 − P(X ≤ k − 1); terms built by ratio, so no factorials.
  // In log space: (1 − p)^n underflows to 0 past a few thousand changes,
  // which would zero every term and make any count look like chance.
  let logTerm = n * Math.log1p(-p);
  const logRatio = Math.log(p) - Math.log1p(-p);
  let below = 0;
  for (let i = 0; i < k; i++) {
    below += Math.exp(logTerm);
    logTerm += Math.log((n - i) / (i + 1)) + logRatio;
  }
  return Math.max(0, 1 - below);
}

/** The most fixed-after changes, of `n`, chance explains at rate `p`. */
export function chanceAllows(n: number, p: number): number {
  let k = 0;
  while (k < n && binomialUpperTail(n, k + 1, p) >= CHANCE_TAIL) k++;
  return k;
}

function tierOf(fixedAfter: number, above: boolean): FixTier {
  if (above) return 3;
  if (fixedAfter === 0) return 0;
  return fixedAfter === 1 ? 1 : 2;
}

export function fixPoint(f: FileFixRate, repoRate: number): FixPoint {
  const allowed = chanceAllows(f.changes, repoRate);
  const above = f.fixedAfter > allowed;
  return {
    file: f.file,
    changes: f.changes,
    fixedAfter: f.fixedAfter,
    rate: f.rate,
    allowed,
    aboveChance: above,
    tier: tierOf(f.fixedAfter, above),
    fixes: f.fixes,
  };
}

export function fixRateData(report: GitrelicReport): FixRateData {
  const fr = report.fixRate;
  const repoRate = fr.rate;
  const points =
    repoRate === null
      ? []
      : fr.files
          .map((f) => fixPoint(f, repoRate))
          .sort(
            (a, b) =>
              Number(b.aboveChance) - Number(a.aboveChance) ||
              b.rate - a.rate ||
              b.changes - a.changes ||
              (a.file < b.file ? -1 : 1),
          );
  return {
    available: fr.windowDays > 0,
    points,
    repoRate,
    windowDays: fr.windowDays,
    minChanges: fr.minChanges,
    unratedFiles: fr.unratedFiles,
  };
}

const cache = new WeakMap<GitrelicReport, FixRateData>();
/** `fixRateData`, once per report: the lens, badge, facts and advice share it. */
export function fixRateOf(report: GitrelicReport): FixRateData {
  let data = cache.get(report);
  if (!data) {
    data = fixRateData(report);
    cache.set(report, data);
  }
  return data;
}

/** One file's rated point, when it has one. */
export function fixPointOf(
  report: GitrelicReport,
  file: string,
): FixPoint | undefined {
  return fixRateOf(report).points.find((p) => p.file === file);
}

/** A rate as people say it: one decimal under 10%, whole above. */
export function ratePct(rate: number): string {
  const pct = rate * 100;
  return pct < 10 && pct > 0
    ? `${pct.toFixed(1).replace(/\.0$/, '')}%`
    : `${Math.round(pct)}%`;
}

/** The tooltip and fact wording: "3 of 8 changes fixed within 30 days". */
export function fixedOf(p: FixPoint, windowDays: number): string {
  return `${p.fixedAfter.toLocaleString('en-US')} of ${p.changes.toLocaleString('en-US')} changes fixed within ${windowDays} days`;
}
