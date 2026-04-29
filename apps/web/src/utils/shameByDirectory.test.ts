import { describe, it, expect } from 'vitest';

import { aggregateShameByDirectory } from './shameByDirectory';

import type { FileForensics } from '@gitrelic/core';

const makeFile = (file: string): FileForensics => ({
  file,
  shameScore: 80,
  rawShamePoints: 8,
  shameCommitCount: 4,
  topShameCommits: [],
  dominantKeywords: ['fix'],
});

describe('aggregateShameByDirectory', () => {
  it('returns empty array on empty input', () => {
    expect(aggregateShameByDirectory([])).toEqual([]);
  });

  it('groups files by parent directory', () => {
    const files = [
      makeFile('packages/core/foo.ts'),
      makeFile('packages/core/bar.ts'),
      makeFile('packages/web/baz.ts'),
    ];
    const rows = aggregateShameByDirectory(files);
    expect(rows[0]).toMatchObject({ directory: 'packages/core', count: 2 });
    expect(rows[1]).toMatchObject({ directory: 'packages/web', count: 1 });
  });

  it('computes share as fraction of total', () => {
    const files = [makeFile('a/x.ts'), makeFile('a/y.ts'), makeFile('a/z.ts'), makeFile('b/q.ts')];
    const rows = aggregateShameByDirectory(files);
    expect(rows[0].share).toBeCloseTo(0.75);
    expect(rows[1].share).toBeCloseTo(0.25);
  });

  it('sorts by count desc with secondary alpha', () => {
    const files = [makeFile('z/1.ts'), makeFile('a/1.ts'), makeFile('a/2.ts'), makeFile('z/2.ts')];
    const rows = aggregateShameByDirectory(files);
    // both directories tied at count=2 → alpha
    expect(rows.map((r) => r.directory)).toEqual(['a', 'z']);
  });

  it('handles root files (no slash)', () => {
    const rows = aggregateShameByDirectory([makeFile('README.md')]);
    expect(rows[0].directory).toBe('');
  });
});
