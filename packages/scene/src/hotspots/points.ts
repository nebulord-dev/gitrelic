// Hotspots as points: each scored file with the commits and lines it's
// plotted by, and the scale that turns core's score back into a curve.
//
// Core scores a file as churnScore × log₂(lines), scaled so the top file is
// 100, where churnScore is commits over the most-changed file's commits, also
// out of 100 (packages/core/src/analyzers/{churn,hotspot}.ts). So, up to
// rounding, score = commits × log₂(lines) / k, and the files scoring S lie on
// commits = S × k / log₂(lines) — the equal-score curves the field draws.

import type { GitrelicReport } from '@gitrelic/core';

/** Tier floors, as core categorises: moderate, warning, critical. */
export const HOTSPOT_TIERS = [25, 50, 75] as const;
export type HotspotTier = 0 | 1 | 2 | 3;

export interface HotspotPoint {
  file: string;
  commits: number;
  lines: number;
  score: number;
  tier: HotspotTier;
}

const CATEGORY_TIER: Record<string, HotspotTier> = {
  low: 0,
  moderate: 1,
  warning: 2,
  critical: 3,
};

export function hotspotTier(score: number): HotspotTier {
  if (score >= HOTSPOT_TIERS[2]) return 3;
  if (score >= HOTSPOT_TIERS[1]) return 2;
  if (score >= HOTSPOT_TIERS[0]) return 1;
  return 0;
}

/** Every scored file, hottest first. */
export function hotspotPoints(report: GitrelicReport): HotspotPoint[] {
  const commits = new Map(
    report.churn.files.map((f) => [f.file, f.commitCount]),
  );
  const points: HotspotPoint[] = [];
  for (const h of report.hotspots.files) {
    const c = commits.get(h.file);
    if (!c) continue;
    points.push({
      file: h.file,
      commits: c,
      lines: h.loc,
      score: h.hotspotScore,
      // Core's own category, so the tiers move if its thresholds do; the
      // score is the fallback for anything unexpected.
      tier: CATEGORY_TIER[h.category] ?? hotspotTier(h.hotspotScore),
    });
  }
  return points.sort((a, b) => b.score - a.score || (a.file < b.file ? -1 : 1));
}

/**
 * k in score ≈ commits × log₂(lines) / k, or null when there's nothing to
 * scale by. Mirrors core: raw = churnScore × log₂(max(1, lines)), the top raw
 * score floored at 1.
 */
export function hotspotScale(report: GitrelicReport): number | null {
  let maxCount = 0;
  for (const f of report.churn.files)
    if (f.commitCount > maxCount) maxCount = f.commitCount;
  let maxRaw = 1;
  for (const h of report.hotspots.files) {
    const raw = h.churnScore * Math.log2(Math.max(1, h.loc));
    if (raw > maxRaw) maxRaw = raw;
  }
  return maxCount > 0 ? (maxCount * maxRaw) / 10_000 : null;
}

/** The commits a file of `lines` needs to score `score`. */
export function commitsForScore(
  score: number,
  lines: number,
  k: number,
): number {
  return (score * k) / Math.log2(lines);
}

/**
 * The package a file belongs to: `packages/<name>` inside a `packages/`
 * monorepo folder, else its top-level directory; '' for files at the root.
 */
export function packageOf(path: string): string {
  const parts = path.split('/');
  if (parts.length === 1) return '';
  if (parts[0] === 'packages' && parts.length > 2)
    return `packages/${parts[1]}`;
  return parts[0];
}

export interface HotspotSummary {
  /** Files per tier, low to critical. */
  tiers: [number, number, number, number];
  total: number;
}

export function hotspotSummary(
  points: readonly HotspotPoint[],
): HotspotSummary {
  const tiers: [number, number, number, number] = [0, 0, 0, 0];
  for (const p of points) tiers[p.tier]++;
  return { tiers, total: points.length };
}
