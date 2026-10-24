// What makes a hot file hot: the facets the field fans out around a selected
// file (docs/atlas-views.md › Hotspots, "Selecting a file"). Each one is a
// different analyzer's reading of the same file, in a fixed order, present
// only when that analyzer reports the file. `hot` marks the readings worth a
// second look; the thresholds are the analyzers' own where they have one.

import { BLAST_WIDE } from '../coupling/boundaries';
import { coupledWith } from '../inspect/coupledWith';
import { fileContributors } from '../inspect/fileContributors';
import { LARGE_FILE, type HotspotPoint } from './points';
import type { GitrelicReport } from '@gitrelic/core';

export type FacetId =
  | 'churn'
  | 'size'
  | 'owners'
  | 'changes-with'
  | 'trend'
  | 'blast'
  | 'rewrite'
  | 'root-causes'
  | 'last-touched';

export interface FileFacet {
  id: FacetId;
  name: string;
  value: string;
  /** What the reading means, for the tooltip. */
  hint: string;
  /** Worth a second look: drawn in the accent. */
  hot: boolean;
}

/** Rewrite ratio's "high rewrite" bar (core's HIGH_REWRITE_THRESHOLD). */
export const REWRITE_HOT = 70;
/** A partner sharing at least this share of the rarer file's commits. */
export const COUPLING_HOT = 50;
/** Clusters a file must sit in for its root causes to read as hot. */
export const CLUSTERS_HOT = 2;

const n = (v: number) => v.toLocaleString('en-US');
const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);
const plural = (k: number, one: string, many = `${one}s`) =>
  `${n(k)} ${k === 1 ? one : many}`;

function ago(days: number): string {
  if (days <= 0) return 'today';
  return `${plural(days, 'day')} ago`;
}

/** The facets of a scored file, in fan order. */
export function fileFacets(
  point: HotspotPoint,
  report: GitrelicReport,
): FileFacet[] {
  const { file } = point;
  const total = report.meta.totalCommits;
  const share = total > 0 ? (point.commits / total) * 100 : 0;
  const facets: FileFacet[] = [
    {
      id: 'churn',
      name: 'Churn',
      value: `${plural(point.commits, 'commit')} · ${share < 1 ? '<1' : Math.round(share)}% of all`,
      hint: 'Commits that touched it in the window',
      hot: false,
    },
    {
      id: 'size',
      name: 'Size',
      value: plural(point.lines, 'line'),
      hint: 'Lines at the analyzed commit',
      hot: point.lines >= LARGE_FILE,
    },
  ];

  const bf = report.busFactors.files.find((f) => f.file === file);
  if (bf) {
    const top = fileContributors(file, report)[0];
    const people = plural(bf.uniqueAuthors, 'person', 'people');
    facets.push({
      id: 'owners',
      name: 'Owners',
      value:
        bf.uniqueAuthors === 1 || !top
          ? `${people}${top ? ` · ${top.name}` : ''}`
          : `${people} · ${top.name} ${Math.round(bf.dominantAuthorPercent)}%`,
      hint: "Who wrote its commits; the share is the top author's",
      hot: bf.risk === 'critical',
    });
  }

  const partner = coupledWith(file, report, 1)[0];
  if (partner) {
    facets.push({
      id: 'changes-with',
      name: 'Changes with',
      value: `${baseName(partner.file)} · ${n(partner.coCommits)}×`,
      hint: 'The file it is most often committed with',
      hot: partner.strength >= COUPLING_HOT,
    });
  }

  const cv = report.churnVelocity.files.find((f) => f.file === file);
  if (cv) {
    facets.push({
      id: 'trend',
      name: 'Trend',
      value: `${cv.trend} · ${n(cv.recentCommits)} of ${n(cv.totalCommits)} recent`,
      hint: 'Commits in the recent half of the window against the older half',
      hot: cv.trend === 'accelerating',
    });
  }

  const blast = report.blastRadius.files.find((f) => f.file === file);
  if (blast?.medianCoChanged !== undefined) {
    facets.push({
      id: 'blast',
      name: 'Blast radius',
      value: `${n(blast.medianCoChanged)} files per change`,
      hint: 'Other files its commits usually change (the median)',
      hot: blast.medianCoChanged >= BLAST_WIDE,
    });
  }

  const rr = report.rewriteRatio.files.find((f) => f.file === file);
  if (rr) {
    facets.push({
      id: 'rewrite',
      name: 'Rewrite ratio',
      value: `${rr.ratio.toFixed(2)} · ${n(rr.totalDeletions)} deleted, ${n(rr.totalInsertions)} added`,
      hint: 'Lines deleted against lines added; near 1, code that does not stick',
      hot: rr.rewriteScore >= REWRITE_HOT,
    });
  }

  const clusters = report.hotspotClusters.clusters;
  const inClusters = clusters.filter((c) =>
    c.members.some((m) => m.file === file),
  ).length;
  if (inClusters > 0) {
    facets.push({
      id: 'root-causes',
      name: 'Root causes',
      value: `in ${n(inClusters)} of ${plural(clusters.length, 'cluster')}`,
      hint: 'Hotspot clusters: groups of hot files sharing a cause',
      hot: inClusters >= CLUSTERS_HOT,
    });
  }

  const age = report.ageMap.files.find((f) => f.file === file);
  if (age) {
    facets.push({
      id: 'last-touched',
      name: 'Last touched',
      value: ago(age.ageInDays),
      hint: 'Since its last commit',
      hot: false,
    });
  }

  return facets;
}
