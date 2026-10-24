import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import { fileFacets } from './facets';
import { hotspotPoints, type HotspotPoint } from './points';
import type { GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;
const points = hotspotPoints(report);
const top = points[0];

const facet = (facets: ReturnType<typeof fileFacets>, id: string) =>
  facets.find((f) => f.id === id);

describe('fileFacets', () => {
  it('reads the top file from every analyzer that reports it, in fan order', () => {
    const facets = fileFacets(top, report);
    expect(facets.map((f) => f.id)).toEqual([
      'churn',
      'size',
      'owners',
      'changes-with',
      'trend',
      // No blast radius: the sample repo's files have under 8 commits.
      'rewrite',
      'root-causes',
      'last-touched',
    ]);
    // src/helpers.ts: 7 commits of 20, coupled with index.ts 3 times at 60%,
    // accelerating 6 of 7, in one of the fixture's two clusters.
    expect(facet(facets, 'churn')!.value).toBe('7 commits · 35% of all');
    expect(facet(facets, 'changes-with')).toMatchObject({
      value: 'index.ts · 3×',
      hot: true,
    });
    expect(facet(facets, 'trend')).toMatchObject({
      value: 'accelerating · 6 of 7 recent',
      hot: true,
    });
    expect(facet(facets, 'root-causes')).toMatchObject({
      value: 'in 1 of 2 clusters',
      hot: false,
    });
  });

  it('marks a file of 1,000+ lines as large', () => {
    const big: HotspotPoint = { ...top, lines: 1000 };
    expect(facet(fileFacets(big, report), 'size')).toMatchObject({
      value: '1,000 lines',
      hot: true,
    });
    expect(facet(fileFacets(top, report), 'size')!.hot).toBe(false);
  });

  it('leaves out what no analyzer reports', () => {
    const bare: GitrelicReport = {
      ...report,
      busFactors: { ...report.busFactors, files: [] },
      coupling: { ...report.coupling, pairs: [] },
      churnVelocity: { ...report.churnVelocity, files: [] },
      blastRadius: { ...report.blastRadius, files: [] },
      rewriteRatio: { ...report.rewriteRatio, files: [] },
      hotspotClusters: { ...report.hotspotClusters, clusters: [] },
      ageMap: { ...report.ageMap, files: [] },
    };
    expect(fileFacets(top, bare).map((f) => f.id)).toEqual(['churn', 'size']);
  });

  it('names a sole owner without a share', () => {
    const solo: GitrelicReport = {
      ...report,
      busFactors: {
        ...report.busFactors,
        files: report.busFactors.files.map((f) =>
          f.file === top.file
            ? { ...f, uniqueAuthors: 1, authors: f.authors.slice(0, 1) }
            : f,
        ),
      },
    };
    expect(facet(fileFacets(top, solo), 'owners')!.value).toMatch(
      /^1 person · \S/,
    );
  });

  it('reads a share under 1% as <1%', () => {
    const huge: GitrelicReport = {
      ...report,
      meta: { ...report.meta, totalCommits: 10_000 },
    };
    expect(facet(fileFacets(top, huge), 'churn')!.value).toBe(
      '7 commits · <1% of all',
    );
  });

  it('says today for a file touched today', () => {
    const fresh: GitrelicReport = {
      ...report,
      ageMap: {
        ...report.ageMap,
        files: report.ageMap.files.map((f) =>
          f.file === top.file ? { ...f, ageInDays: 0 } : f,
        ),
      },
    };
    expect(facet(fileFacets(top, fresh), 'last-touched')!.value).toBe('today');
  });

  it('shows blast radius as a median, hot from 10 other files per change', () => {
    const rated = (median: number) =>
      fileFacets(top, {
        ...report,
        blastRadius: {
          ...report.blastRadius,
          files: [
            {
              file: top.file,
              blastScore: 0,
              avgCoChangedFiles: 20,
              maxCoChangedFiles: 0,
              totalCommits: 9,
              medianCoChanged: median,
              footprint: [],
            },
          ],
        },
      });
    expect(facet(rated(12), 'blast')).toMatchObject({
      value: '12 files per change',
      hot: true,
    });
    expect(facet(rated(4), 'blast')?.hot).toBe(false);
  });
});
