import { describe, expect, it } from 'vitest';

import { countUniqueFiles, COUPLING_THRESHOLD } from './CouplingGraph';

import type { CoupledPair } from '@gitlore/core';

describe('countUniqueFiles', () => {
  it('counts unique files across pairs', () => {
    const pairs: CoupledPair[] = [
      {
        fileA: 'a.ts',
        fileB: 'b.ts',
        coCommits: 5,
        totalCommitsA: 10,
        totalCommitsB: 8,
        couplingStrength: 0.5,
      },
      {
        fileA: 'a.ts',
        fileB: 'c.ts',
        coCommits: 3,
        totalCommitsA: 10,
        totalCommitsB: 6,
        couplingStrength: 0.3,
      },
    ];
    expect(countUniqueFiles(pairs)).toBe(3);
  });

  it('returns 0 for empty array', () => {
    expect(countUniqueFiles([])).toBe(0);
  });
});

describe('COUPLING_THRESHOLD', () => {
  it('is 50', () => {
    expect(COUPLING_THRESHOLD).toBe(50);
  });
});
