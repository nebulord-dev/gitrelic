import { describe, expect, it } from 'vitest';

import { aggregateBusFactorByDirectory } from './busFactorByDirectory';

import type { FileBusFactor } from '@gitrelic/core';

function f(path: string): FileBusFactor {
  return {
    file: path,
    uniqueAuthors: 1,
    authors: ['solo@example.com'],
    dominantAuthor: 'solo@example.com',
    dominantAuthorPercent: 100,
    risk: 'critical',
  };
}

describe('aggregateBusFactorByDirectory', () => {
  it('returns an empty array for no files', () => {
    expect(aggregateBusFactorByDirectory([])).toEqual([]);
  });

  it('groups files by their immediate parent directory', () => {
    const rows = aggregateBusFactorByDirectory([
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
    const rows = aggregateBusFactorByDirectory([
      f('zebra/x.ts'),
      f('apple/x.ts'),
      f('apple/y.ts'),
      f('mango/x.ts'),
      f('mango/y.ts'),
    ]);
    expect(rows.map((r) => r.directory)).toEqual(['apple', 'mango', 'zebra']);
  });

  it('represents the repo root as the empty string', () => {
    const rows = aggregateBusFactorByDirectory([f('rootfile.ts')]);
    expect(rows[0].directory).toBe('');
  });

  it('computes share against the total file count', () => {
    const files: FileBusFactor[] = [];
    files.push(f('big/a.ts'), f('big/b.ts'), f('big/c.ts'));
    for (let i = 0; i < 6; i++) files.push(f(`dir${i}/x.ts`));
    const rows = aggregateBusFactorByDirectory(files);
    const big = rows.find((r) => r.directory === 'big')!;
    expect(big.share).toBeCloseTo(3 / 9);
  });
});
