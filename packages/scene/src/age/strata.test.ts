import { describe, expect, it } from 'vitest';

import { ageReport } from '../../test/ageReport';
import reportJson from '../../test/fixtures/report.small.json';
import { ageStrata, ageStrataOf, ageSummaryOf, bandOf } from './strata';
import type { GitrelicReport } from '@gitrelic/core';

describe('bandOf', () => {
  it('puts each edge in the older band', () => {
    expect(bandOf(0)).toBe(0);
    expect(bandOf(89)).toBe(0);
    expect(bandOf(90)).toBe(1);
    expect(bandOf(364)).toBe(1);
    expect(bandOf(365)).toBe(2);
    expect(bandOf(730)).toBe(3);
    expect(bandOf(1460)).toBe(4);
  });
});

describe('ageStrata', () => {
  const rows = ageStrata(ageReport(), { tests: false });
  const row = (dir: string) => rows.find((r) => r.dir === dir)!;

  it('groups source files by package, most cold lines first', () => {
    expect(rows.map((r) => r.dir)).toEqual([
      'packages/old',
      'scripts',
      'src',
      '',
    ]);
    expect(row('scripts')).toMatchObject({ warm: 1000, cold: 400 });
    expect(row('src')).toMatchObject({ warm: 3020, cold: 50 });
  });

  it('leaves fixtures out always and tests out unless asked', () => {
    const files = rows.flatMap((r) => r.files.map((f) => f.file));
    expect(files).not.toContain('fixtures/snap.txt');
    expect(files).not.toContain('src/core.test.ts');
    const withTests = ageStrata(ageReport(), { tests: true });
    const src = withTests.find((r) => r.dir === 'src')!;
    expect(src.files.find((f) => f.file === 'src/core.test.ts')).toMatchObject({
      test: true,
      band: 2,
    });
    expect(src.cold).toBe(250);
    expect(withTests.flatMap((r) => r.files.map((f) => f.file))).not.toContain(
      'fixtures/snap.txt',
    );
  });

  it('sums lines by band, oldest files first', () => {
    expect(row('packages/old').lines).toEqual([0, 0, 0, 500, 0]);
    expect(row('src').files.map((f) => f.file)).toEqual([
      'src/legacy.ts',
      'src/flags.ts',
      'src/core.ts',
    ]);
  });

  it('carries orphaned lines and core’s dormant packages', () => {
    expect(row('packages/old')).toMatchObject({
      orphaned: 200,
      orphanedFiles: 2,
      coldFiles: 5,
      dormant: true,
      newestSource: 1250,
    });
    expect(row('scripts')).toMatchObject({ orphaned: 400, dormant: false });
  });

  it('is memoised per report and tests switch', () => {
    const report = ageReport();
    expect(ageStrataOf(report, false)).toBe(ageStrataOf(report, false));
    expect(ageStrataOf(report, true)).not.toBe(ageStrataOf(report, false));
  });
});

describe('ageSummaryOf', () => {
  it('sums the source files', () => {
    const s = ageSummaryOf(ageReport());
    expect(s).toMatchObject({
      lines: 5000,
      coldLines: 980,
      coldFiles: 8,
      medianColdLines: 100,
      leftOut: 1,
      source: 'history',
    });
    expect(s.oldest?.file).toBe('src/legacy.ts');
    expect(s.dormant.map((d) => d.package)).toEqual(['packages/old']);
  });

  it('counts orphaned files by package, most lines first', () => {
    const s = ageSummaryOf(ageReport());
    expect(s.orphanedFiles).toBe(3);
    expect(s.orphanedLines).toBe(600);
    expect(s.orphanedByPackage).toEqual([
      ['scripts', 400],
      ['packages/old', 200],
    ]);
  });

  it('lists woken source files, the longest gap first', () => {
    const s = ageSummaryOf(ageReport());
    expect(s.woken.map((f) => [f.file, f.wokeAfterDays])).toEqual([
      ['src/flags.ts', 3000],
    ]);
  });

  it('reads a young repo as nothing cold', () => {
    const s = ageSummaryOf(reportJson as unknown as GitrelicReport);
    expect(s.coldFiles).toBe(0);
    expect(s.dormant).toEqual([]);
    expect(s.oldest).toBeDefined();
  });
});
