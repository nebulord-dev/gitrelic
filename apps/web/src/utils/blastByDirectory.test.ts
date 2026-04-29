import { describe, expect, it } from 'vitest';

import { aggregateBlastByDirectory } from './blastByDirectory';

import type { FileBlastRadius } from '@gitrelic/core';

function f(path: string): FileBlastRadius {
  return {
    file: path,
    blastScore: 80,
    avgCoChangedFiles: 10,
    maxCoChangedFiles: 15,
    totalCommits: 5,
  };
}

describe('aggregateBlastByDirectory', () => {
  it('returns an empty array for no files', () => {
    expect(aggregateBlastByDirectory([])).toEqual([]);
  });

  it('groups files by their immediate parent directory', () => {
    const rows = aggregateBlastByDirectory([
      f('packages/a/src/x.ts'),
      f('packages/a/src/y.ts'),
      f('packages/b/src/z.ts'),
    ]);
    const dirs = rows.map((r) => r.directory);
    expect(dirs).toContain('packages/a/src');
    expect(dirs).toContain('packages/b/src');
    const aRow = rows.find((r) => r.directory === 'packages/a/src')!;
    expect(aRow.count).toBe(2);
    expect(aRow.share).toBeCloseTo(2 / 3);
  });

  it('sorts by count desc, breaking ties alphabetically', () => {
    const rows = aggregateBlastByDirectory([
      f('zebra/x.ts'),
      f('apple/x.ts'),
      f('apple/y.ts'),
      f('mango/x.ts'),
      f('mango/y.ts'),
    ]);
    expect(rows.map((r) => r.directory)).toEqual(['apple', 'mango', 'zebra']);
  });

  it('honors the limit option (default 5)', () => {
    const files: FileBlastRadius[] = [];
    for (let i = 0; i < 8; i++) {
      files.push(f(`dir${i}/file.ts`));
    }
    expect(aggregateBlastByDirectory(files)).toHaveLength(5);
    expect(aggregateBlastByDirectory(files, { limit: 3 })).toHaveLength(3);
    expect(aggregateBlastByDirectory(files, { limit: 100 })).toHaveLength(8);
  });

  it('represents the repo root as the empty string', () => {
    const rows = aggregateBlastByDirectory([f('rootfile.ts')]);
    expect(rows[0].directory).toBe('');
  });

  it('computes share against the total file count, not the limited slice', () => {
    const files: FileBlastRadius[] = [];
    // 3 in big/, 1 each in 6 other directories — 9 total
    files.push(f('big/a.ts'), f('big/b.ts'), f('big/c.ts'));
    for (let i = 0; i < 6; i++) files.push(f(`dir${i}/x.ts`));
    const rows = aggregateBlastByDirectory(files);
    const big = rows.find((r) => r.directory === 'big')!;
    expect(big.share).toBeCloseTo(3 / 9);
  });
});
