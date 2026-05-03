import { describe, expect, it } from 'vitest';

import { directoryFor, prepareLanguagesData } from './LanguagesStackedBar';

import type { GitrelicReport } from '@gitrelic/core';

interface LocFixture {
  file: string;
  lines: number;
  language: string;
}

function makeReport(files: LocFixture[]): GitrelicReport {
  return {
    loc: {
      totalFiles: files.length,
      totalLines: files.reduce((s, f) => s + f.lines, 0),
      files,
      languages: [],
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('directoryFor', () => {
  it('returns the first 2 segments for nested paths', () => {
    expect(directoryFor('packages/core/src/foo.ts')).toBe('packages/core');
    expect(directoryFor('apps/web/src/components/Bar.tsx')).toBe('apps/web');
  });

  it('returns the only segment for files in a single directory', () => {
    expect(directoryFor('src/foo.ts')).toBe('src');
  });

  it('returns "(root)" for files at the repo root', () => {
    expect(directoryFor('README.md')).toBe('(root)');
    expect(directoryFor('package.json')).toBe('(root)');
  });

  it('respects a custom depth', () => {
    expect(directoryFor('packages/core/src/foo.ts', 1)).toBe('packages');
    expect(directoryFor('packages/core/src/foo.ts', 3)).toBe(
      'packages/core/src',
    );
  });
});

describe('prepareLanguagesData', () => {
  it('groups files by top-level directory (depth 2 by default)', () => {
    const { rows } = prepareLanguagesData(
      makeReport([
        { file: 'apps/web/src/a.ts', lines: 100, language: 'TypeScript' },
        { file: 'apps/web/src/b.tsx', lines: 50, language: 'TypeScript' },
        { file: 'packages/core/x.ts', lines: 200, language: 'TypeScript' },
      ]),
    );
    expect(rows.map((r) => r.directory).sort()).toEqual([
      'apps/web',
      'packages/core',
    ]);
  });

  it('aggregates LOC per language within each row', () => {
    const { rows } = prepareLanguagesData(
      makeReport([
        { file: 'apps/web/src/a.ts', lines: 100, language: 'TypeScript' },
        { file: 'apps/web/src/b.tsx', lines: 50, language: 'TypeScript' },
        { file: 'apps/web/styles/c.css', lines: 30, language: 'CSS' },
      ]),
    );
    const webRow = rows.find((r) => r.directory === 'apps/web');
    expect(webRow).toBeDefined();
    expect(webRow!.totalLoc).toBe(180);
    const ts = webRow!.segments.find((s) => s.language === 'TypeScript');
    const css = webRow!.segments.find((s) => s.language === 'CSS');
    expect(ts?.loc).toBe(150);
    expect(css?.loc).toBe(30);
  });

  it('sorts rows by totalLoc desc', () => {
    const { rows } = prepareLanguagesData(
      makeReport([
        { file: 'small/a.ts', lines: 10, language: 'TypeScript' },
        { file: 'large/a.ts', lines: 1000, language: 'TypeScript' },
        { file: 'medium/a.ts', lines: 100, language: 'TypeScript' },
      ]),
    );
    expect(rows.map((r) => r.directory)).toEqual(['large', 'medium', 'small']);
  });

  it('sorts segments within each row by loc desc (largest leftmost)', () => {
    const { rows } = prepareLanguagesData(
      makeReport([
        { file: 'src/a.ts', lines: 10, language: 'TypeScript' },
        { file: 'src/b.css', lines: 200, language: 'CSS' },
        { file: 'src/c.md', lines: 50, language: 'Markdown' },
      ]),
    );
    expect(rows[0].segments.map((s) => s.language)).toEqual([
      'CSS',
      'Markdown',
      'TypeScript',
    ]);
  });

  it('caps at 30 rows by default', () => {
    const many: LocFixture[] = [];
    for (let i = 0; i < 50; i += 1) {
      many.push({
        file: `dir${i}/foo.ts`,
        lines: 100 - i,
        language: 'TypeScript',
      });
    }
    const { rows } = prepareLanguagesData(makeReport(many));
    expect(rows).toHaveLength(30);
  });

  it('returns maxRowLoc for axis scaling across rendered rows only', () => {
    const many: LocFixture[] = [];
    for (let i = 0; i < 35; i += 1) {
      // i=0 has 1000 LOC; i=34 has trivial LOC and falls outside the top-30
      many.push({
        file: `dir${i}/foo.ts`,
        lines: i === 0 ? 1000 : 100 - i,
        language: 'TypeScript',
      });
    }
    const { rows, maxRowLoc } = prepareLanguagesData(makeReport(many));
    expect(rows[0].totalLoc).toBe(1000);
    expect(maxRowLoc).toBe(1000);
  });

  it('returns [] rows and maxRowLoc=0 for an empty report', () => {
    const { rows, maxRowLoc } = prepareLanguagesData(makeReport([]));
    expect(rows).toEqual([]);
    expect(maxRowLoc).toBe(0);
  });

  it('groups root-level files under "(root)"', () => {
    const { rows } = prepareLanguagesData(
      makeReport([
        { file: 'README.md', lines: 50, language: 'Markdown' },
        { file: 'package.json', lines: 30, language: 'JSON' },
      ]),
    );
    const rootRow = rows.find((r) => r.directory === '(root)');
    expect(rootRow).toBeDefined();
    expect(rootRow!.totalLoc).toBe(80);
  });

  it('does not mutate the input files array', () => {
    const original: LocFixture[] = [
      { file: 'a/b.ts', lines: 10, language: 'TypeScript' },
      { file: 'a/c.ts', lines: 20, language: 'TypeScript' },
    ];
    const before = original.map((f) => f.file);
    prepareLanguagesData(makeReport(original));
    expect(original.map((f) => f.file)).toEqual(before);
  });
});
