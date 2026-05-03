import { describe, expect, it } from 'vitest';

import { aggregateRewriteByDirectory } from './rewriteByDirectory';
import type { FileRewriteRatio } from '@gitrelic/core';

function f(path: string): FileRewriteRatio {
  return {
    file: path,
    rewriteScore: 80,
    totalInsertions: 100,
    totalDeletions: 100,
    ratio: 1,
  };
}

describe('aggregateRewriteByDirectory', () => {
  it('returns an empty array for no files', () => {
    expect(aggregateRewriteByDirectory([])).toEqual([]);
  });

  it('groups files by their immediate parent directory', () => {
    const rows = aggregateRewriteByDirectory([
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
    const rows = aggregateRewriteByDirectory([
      f('zebra/x.ts'),
      f('apple/x.ts'),
      f('apple/y.ts'),
      f('mango/x.ts'),
      f('mango/y.ts'),
    ]);
    expect(rows.map((r) => r.directory)).toEqual(['apple', 'mango', 'zebra']);
  });

  it('returns one row per distinct parent directory (no internal cap)', () => {
    const files: FileRewriteRatio[] = [];
    for (let i = 0; i < 8; i++) files.push(f(`dir${i}/file.ts`));
    expect(aggregateRewriteByDirectory(files)).toHaveLength(8);
  });

  it('represents the repo root as the empty string', () => {
    const rows = aggregateRewriteByDirectory([f('rootfile.ts')]);
    expect(rows[0].directory).toBe('');
  });

  it('computes share against the total file count, not the limited slice', () => {
    const files: FileRewriteRatio[] = [];
    files.push(f('big/a.ts'), f('big/b.ts'), f('big/c.ts'));
    for (let i = 0; i < 6; i++) files.push(f(`dir${i}/x.ts`));
    const rows = aggregateRewriteByDirectory(files);
    const big = rows.find((r) => r.directory === 'big')!;
    expect(big.share).toBeCloseTo(3 / 9);
  });
});
