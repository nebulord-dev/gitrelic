import { describe, expect, it } from 'vitest';

import { ageReport } from '../../test/ageReport';
import reportJson from '../../test/fixtures/report.small.json';
import { ageFindings, ageTable, ageView } from './age';
import type { Finding } from '../model';
import type { GitrelicReport } from '@gitrelic/core';

const young = reportJson as unknown as GitrelicReport;
const text = (f: Finding) =>
  f.segments.map((s) => (typeof s === 'string' ? s : s.text)).join('');
const find = (findings: Finding[], id: string) =>
  findings.find((f) => f.id === id);

describe('ageView', () => {
  it('is Strata first, Warm and cold as its alternate', () => {
    expect(ageView.id).toBe('age-map');
    expect(ageView.layouts.map((l) => l.id)).toEqual(['strata', 'warm-cold']);
    for (const layout of ageView.layouts) {
      expect(layout.needsCommits).toBe(false);
      expect(layout.caption).toBeTruthy();
    }
  });
});

describe('ageFindings', () => {
  const findings = ageFindings({ report: ageReport(), commits: null });

  it('says how much is cold, and how thin', () => {
    expect(text(find(findings, 'cold')!)).toBe(
      '8 files (980 lines) unchanged for a year or more; the median one has 100 lines.',
    );
  });

  it('names dormant packages with their action, as a warning', () => {
    const f = find(findings, 'dormant')!;
    expect(f.tone).toBe('warning');
    expect(f.segments).toContainEqual({
      ref: 'dir:packages/old',
      text: 'packages/old/',
    });
    expect(text(f)).toBe(
      'packages/old/ has had no source change in 3.4 years (5 files): archive it, delete it, or say why it stays.',
    );
  });

  it('counts orphaned files and where most of them are', () => {
    const f = find(findings, 'orphaned')!;
    expect(f.tone).toBe('warning');
    expect(text(f)).toBe(
      '3 cold files (600 lines) have nobody left who changed them, most in scripts/ and packages/old/.',
    );
  });

  it('names the longest-woken file, without calling it risky', () => {
    const f = find(findings, 'woken')!;
    expect(f.tone).toBe('neutral');
    expect(text(f)).toBe(
      '1 file changed this year after a year or more untouched, the longest flags.ts after 8.2 years: check that whoever changed it knew it.',
    );
  });

  it('says what it left out', () => {
    expect(text(find(findings, 'left-out')!)).toBe(
      '1 fixture or generated file left out.',
    );
  });

  it('warns when ages cover the window only', () => {
    const windowOnly = ageFindings({
      report: ageReport({ source: 'window' }),
      commits: null,
    });
    expect(find(windowOnly, 'window')?.tone).toBe('warning');
    expect(find(findings, 'window')).toBeUndefined();
  });

  it('reads a young repo as nothing cold, naming the oldest file', () => {
    const calm = ageFindings({ report: young, commits: null });
    expect(text(find(calm, 'cold')!)).toMatch(
      /^Nothing is a year old: the oldest file, .+, last changed .+ ago\.$/,
    );
    expect(find(calm, 'dormant')).toBeUndefined();
    expect(find(calm, 'orphaned')).toBeUndefined();
  });
});

describe('ageTable', () => {
  const table = ageTable({ report: ageReport(), commits: null });

  it('lists source and test files, oldest first, never fixtures', () => {
    const ids = table.rows.map((r) => r.id);
    expect(ids).toContain('file:src/core.test.ts');
    expect(ids).not.toContain('file:fixtures/snap.txt');
    expect(table.sort).toEqual({ column: 'age', descending: true });
  });

  it('tiers rows by band: under a year, 1–2, 2–4, 4+ years', () => {
    const tier = (file: string) =>
      table.rows.find((r) => r.id === `file:${file}`)!.tier;
    expect(tier('src/core.ts')).toBe(0);
    expect(tier('src/core.test.ts')).toBe(1);
    expect(tier('scripts/release.js')).toBe(2);
    expect(tier('src/legacy.ts')).toBe(3);
    expect(table.tierNames).toEqual([
      'Under a year',
      '1–2 years',
      '2–4 years',
      '4+ years',
    ]);
  });

  it('says who an orphaned file was left by', () => {
    const row = table.rows.find((r) => r.id === 'file:scripts/release.js')!;
    expect(row.cells).toMatchObject({
      lines: 400,
      orphaned: 'Bob, Cy',
      kind: 'source',
      package: 'scripts',
    });
  });
});
