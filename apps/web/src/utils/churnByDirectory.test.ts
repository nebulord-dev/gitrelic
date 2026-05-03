import { describe, expect, it } from 'vitest';

import { aggregateChurnByDirectory } from './churnByDirectory';

import type { FileChurn } from '@gitrelic/core';

function file(path: string, commitCount: number): FileChurn {
  return { file: path, commitCount, churnScore: 0, category: 'cold' };
}

describe('aggregateChurnByDirectory', () => {
  it('returns an empty array when given no files', () => {
    expect(aggregateChurnByDirectory([])).toEqual([]);
  });

  it('groups files by their immediate parent directory', () => {
    const rows = aggregateChurnByDirectory([
      file('src/components/Header.tsx', 10),
      file('src/components/Footer.tsx', 5),
      file('src/utils/format.ts', 3),
    ]);
    expect(rows.map((r) => r.directory).sort()).toEqual([
      'src/components',
      'src/utils',
    ]);
  });

  it('sums commit counts per directory', () => {
    const rows = aggregateChurnByDirectory([
      file('a/x.ts', 7),
      file('a/y.ts', 13),
      file('b/z.ts', 4),
    ]);
    expect(rows.find((r) => r.directory === 'a')?.commits).toBe(20);
    expect(rows.find((r) => r.directory === 'b')?.commits).toBe(4);
  });

  it('counts files per directory', () => {
    const rows = aggregateChurnByDirectory([
      file('pkg/a.ts', 1),
      file('pkg/b.ts', 1),
      file('pkg/c.ts', 1),
    ]);
    expect(rows[0]?.files).toBe(3);
  });

  it('computes share as the directory commit-sum over the total commit-sum', () => {
    const rows = aggregateChurnByDirectory([
      file('a/x.ts', 30),
      file('b/y.ts', 70),
    ]);
    expect(rows.find((r) => r.directory === 'a')?.share).toBeCloseTo(0.3, 5);
    expect(rows.find((r) => r.directory === 'b')?.share).toBeCloseTo(0.7, 5);
  });

  it('picks the most-churned file in each directory and returns its basename', () => {
    const rows = aggregateChurnByDirectory([
      file('src/components/Big.tsx', 100),
      file('src/components/small.tsx', 5),
    ]);
    expect(rows[0]?.topFile).toBe('Big.tsx');
  });

  it('sorts directories by total commit count descending', () => {
    const rows = aggregateChurnByDirectory([
      file('a/x.ts', 5),
      file('b/y.ts', 100),
      file('c/z.ts', 20),
    ]);
    expect(rows.map((r) => r.directory)).toEqual(['b', 'c', 'a']);
  });

  it('limits the result to top 10 directories by default', () => {
    const files = Array.from({ length: 15 }, (_, i) =>
      file(`dir${i}/file.ts`, i + 1),
    );
    expect(aggregateChurnByDirectory(files)).toHaveLength(10);
  });

  it('honors a custom limit option', () => {
    const files = Array.from({ length: 15 }, (_, i) =>
      file(`dir${i}/file.ts`, i + 1),
    );
    expect(aggregateChurnByDirectory(files, { limit: 5 })).toHaveLength(5);
  });

  it('uses an empty-string directory for files at the repo root', () => {
    const rows = aggregateChurnByDirectory([file('README.md', 12)]);
    expect(rows[0]?.directory).toBe('');
    expect(rows[0]?.topFile).toBe('README.md');
  });
});
