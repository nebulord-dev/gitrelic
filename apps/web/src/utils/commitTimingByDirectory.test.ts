import { describe, it, expect } from 'vitest';

import { aggregateCommitTimingByDirectory } from './commitTimingByDirectory';
import type { FileTimingProfile } from '@gitrelic/core';

function makeFile(file: string, stressScore = 75): FileTimingProfile {
  return {
    file,
    totalCommits: 10,
    lateNightPercent: 60,
    weekendPercent: 30,
    peakHour: 3,
    peakDay: 6,
    hourDistribution: new Array(24).fill(0),
    stressScore,
  };
}

describe('aggregateCommitTimingByDirectory', () => {
  it('returns empty array on empty input', () => {
    expect(aggregateCommitTimingByDirectory([])).toEqual([]);
  });

  it('groups files by parent directory; share is fraction of total', () => {
    const rows = aggregateCommitTimingByDirectory([
      makeFile('src/a.ts'),
      makeFile('src/b.ts'),
      makeFile('docs/c.md'),
    ]);
    expect(rows).toHaveLength(2);
    const src = rows.find((r) => r.directory === 'src')!;
    expect(src.count).toBe(2);
    expect(src.share).toBeCloseTo(2 / 3);
    const docs = rows.find((r) => r.directory === 'docs')!;
    expect(docs.count).toBe(1);
    expect(docs.share).toBeCloseTo(1 / 3);
  });

  it('files at the repo root use empty-string directory', () => {
    const rows = aggregateCommitTimingByDirectory([makeFile('README.md')]);
    expect(rows).toHaveLength(1);
    expect(rows[0].directory).toBe('');
  });

  it('sorts by count desc, alphabetical directory tiebreaker', () => {
    const rows = aggregateCommitTimingByDirectory([
      makeFile('z/a.ts'),
      makeFile('a/a.ts'),
      makeFile('a/b.ts'),
    ]);
    expect(rows[0].directory).toBe('a');
    expect(rows[1].directory).toBe('z');
  });
});
