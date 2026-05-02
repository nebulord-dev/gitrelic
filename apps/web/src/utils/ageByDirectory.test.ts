import { describe, expect, it } from 'vitest';

import { aggregateAgeByDirectory } from './ageByDirectory';

import type { FileAge } from '@gitrelic/core';

function f(file: string, ageInDays: number, status: FileAge['status']): FileAge {
  return {
    file,
    lastCommitDate: '2025-01-01',
    ageInDays,
    status,
  };
}

describe('aggregateAgeByDirectory', () => {
  it('returns an empty array for no files', () => {
    expect(aggregateAgeByDirectory([])).toEqual([]);
  });

  it('groups files by their immediate parent directory', () => {
    const rows = aggregateAgeByDirectory([
      f('packages/a/src/x.ts', 100, 'aging'),
      f('packages/a/src/y.ts', 200, 'stale'),
      f('packages/b/src/z.ts', 50, 'fresh'),
    ]);
    const dirs = rows.map((r) => r.directory);
    expect(dirs).toContain('packages/a/src');
    expect(dirs).toContain('packages/b/src');
  });

  it('counts files per tier within each directory', () => {
    const rows = aggregateAgeByDirectory([
      f('a/x.ts', 10, 'fresh'),
      f('a/y.ts', 50, 'aging'),
      f('a/z.ts', 200, 'stale'),
      f('a/w.ts', 400, 'ancient'),
      f('a/v.ts', 410, 'ancient'),
    ]);
    const aRow = rows.find((r) => r.directory === 'a')!;
    expect(aRow.fileCount).toBe(5);
    expect(aRow.freshCount).toBe(1);
    expect(aRow.agingCount).toBe(1);
    expect(aRow.staleCount).toBe(1);
    expect(aRow.ancientCount).toBe(2);
  });

  it('computes per-directory median age', () => {
    const rows = aggregateAgeByDirectory([
      f('a/x.ts', 10, 'fresh'),
      f('a/y.ts', 50, 'aging'),
      f('a/z.ts', 200, 'stale'),
    ]);
    const aRow = rows.find((r) => r.directory === 'a')!;
    expect(aRow.medianAgeDays).toBe(50);
  });

  it('reports the oldest file (full path + age) per directory', () => {
    const rows = aggregateAgeByDirectory([
      f('a/x.ts', 10, 'fresh'),
      f('a/y.ts', 200, 'stale'),
      f('a/z.ts', 400, 'ancient'),
    ]);
    const aRow = rows.find((r) => r.directory === 'a')!;
    expect(aRow.oldestFile).toBe('a/z.ts');
    expect(aRow.oldestFileAgeDays).toBe(400);
  });

  it('sorts rows by median age desc, breaking ties alphabetically by directory', () => {
    const rows = aggregateAgeByDirectory([
      f('zebra/x.ts', 100, 'aging'),
      f('apple/x.ts', 100, 'aging'),
      f('mango/x.ts', 50, 'aging'),
    ]);
    expect(rows.map((r) => r.directory)).toEqual(['apple', 'zebra', 'mango']);
  });

  it('represents the repo root as the empty string', () => {
    const rows = aggregateAgeByDirectory([f('rootfile.ts', 100, 'aging')]);
    expect(rows[0].directory).toBe('');
  });
});
