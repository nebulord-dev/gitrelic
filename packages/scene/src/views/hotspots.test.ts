import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import { hotspotReport } from '../../test/hotspotReport';
import { ids } from '../ids';
import {
  fieldLayout,
  hotspotFindings,
  hotspotsView,
  packagesLayout,
} from './hotspots';
import type { GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;
const viewport = { width: 1200, height: 800 };
const findings = (r: GitrelicReport) =>
  hotspotFindings({ report: r, commits: null });
const refs = (r: GitrelicReport, id: string) =>
  findings(r)
    .find((f) => f.id === id)
    ?.segments.filter((s) => typeof s !== 'string');

describe('hotspotsView', () => {
  it('is the field, with By package as its one alternate', () => {
    expect(hotspotsView.layouts.map((l) => l.id)).toEqual([
      'field',
      'packages',
    ]);
    for (const l of hotspotsView.layouts) {
      expect(l.needsCommits).toBe(false);
      expect(l.caption).toBeTruthy();
    }
  });

  it('keeps a file’s id between the two forms, so it travels', () => {
    const field = fieldLayout.build({ report, commits: null }, viewport);
    const pkgs = packagesLayout.build({ report, commits: null }, viewport);
    const inPkgs = new Set(pkgs.marks.map((m) => m.id));
    for (const m of field.marks.filter((m) => m.id.startsWith('file:')))
      expect(inPkgs.has(m.id)).toBe(true);
  });
});

describe('hotspotFindings', () => {
  it('names the hottest file with its commits and lines', () => {
    const hottest = findings(report).find((f) => f.id === 'hottest')!;
    expect(hottest.segments[0]).toEqual({
      ref: ids.file('src/helpers.ts'),
      text: 'helpers.ts',
    });
    expect(hottest.segments[1]).toMatch(/commits across 24 lines/);
  });

  it('says nothing when no file reaches 25', () => {
    const cold = hotspotReport([
      { file: 'a.ts', commits: 1, loc: 10, score: 20 },
    ]);
    expect(findings(cold)).toEqual([]);
  });

  it('calls out two kinds of heat when big and small files both run hot', () => {
    const r = hotspotReport([
      { file: 'engine/big.js', commits: 33, loc: 6600, score: 100 },
      { file: 'shared/flags.js', commits: 31, loc: 100, score: 49 },
      { file: 'shared/flags2.js', commits: 31, loc: 110, score: 52 },
    ]);
    // The hottest small file is the example.
    expect(refs(r, 'two-kinds')).toEqual([
      { ref: ids.file('shared/flags2.js'), text: 'flags2.js' },
    ]);
    // Only big ones hot: no contrast to draw.
    const onlyBig = hotspotReport([
      { file: 'a.js', commits: 30, loc: 5000, score: 100 },
      { file: 'b.js', commits: 25, loc: 4000, score: 80 },
    ]);
    expect(refs(onlyBig, 'two-kinds')).toBeUndefined();
    // One large file: "keeps", not "keep".
    const one = hotspotReport([
      { file: 'big.js', commits: 30, loc: 5000, score: 100 },
      { file: 'flags.js', commits: 25, loc: 100, score: 40 },
    ]);
    const text = findings(one).find((f) => f.id === 'two-kinds')!.segments[0];
    expect(text).toMatch(
      /^Two kinds of heat: 1 large file that keeps changing/,
    );
  });

  it('names the package where heat is densest, against a big cool one', () => {
    const big = Array.from({ length: 40 }, (_, i) => ({
      file: `compiler/f${i}.ts`,
      commits: i === 0 ? 12 : 2,
      loc: 300,
      score: i === 0 ? 30 : 5,
    }));
    const r = hotspotReport([
      { file: 'packages/shared/a.js', commits: 30, loc: 100, score: 90 },
      { file: 'packages/shared/b.js', commits: 28, loc: 100, score: 80 },
      { file: 'packages/shared/c.js', commits: 20, loc: 100, score: 60 },
      { file: 'packages/shared/d.js', commits: 2, loc: 100, score: 5 },
      ...big,
    ]);
    const f = findings(r).find((x) => x.id === 'concentration')!;
    expect(f.segments).toEqual([
      { ref: ids.dir('packages/shared'), text: 'packages/shared/' },
      ': 3 of its 4 files score 25 or more',
      '; ',
      { ref: ids.dir('compiler'), text: 'compiler/' },
      ' has 1 of 40.',
    ]);
  });

  it('names the densest package alone when it is also the biggest', () => {
    const f = findings(report).find((x) => x.id === 'concentration')!;
    expect(f.segments[0]).toEqual({ ref: ids.dir('src'), text: 'src/' });
    expect(f.segments.at(-1)).toBe('.');
  });

  it('skips the concentration finding when heat is spread out', () => {
    const r = hotspotReport(
      Array.from({ length: 6 }, (_, i) => ({
        file: `pkg${i}/a.ts`,
        commits: 10,
        loc: 200,
        score: 30 + i,
      })),
    );
    expect(refs(r, 'concentration')).toBeUndefined();
  });
});
