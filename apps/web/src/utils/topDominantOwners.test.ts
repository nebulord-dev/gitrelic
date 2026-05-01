import { describe, expect, it } from 'vitest';

import { topDominantOwners } from './topDominantOwners';

import type { FileBusFactor } from '@gitrelic/core';

function file(path: string, dominantAuthor: string): FileBusFactor {
  return {
    file: path,
    uniqueAuthors: 1,
    authors: [dominantAuthor],
    dominantAuthor,
    dominantAuthorPercent: 100,
    risk: 'critical',
  };
}

describe('topDominantOwners', () => {
  it('returns an empty array for no files', () => {
    expect(topDominantOwners([])).toEqual([]);
  });

  it('groups files by dominantAuthor', () => {
    const rows = topDominantOwners([
      file('a.ts', 'alice@x.com'),
      file('b.ts', 'alice@x.com'),
      file('c.ts', 'bob@x.com'),
    ]);
    const alice = rows.find((r) => r.author === 'alice@x.com')!;
    expect(alice.count).toBe(2);
    expect(alice.share).toBeCloseTo(2 / 3);
    const bob = rows.find((r) => r.author === 'bob@x.com')!;
    expect(bob.count).toBe(1);
    expect(bob.share).toBeCloseTo(1 / 3);
  });

  it('sorts by count desc, breaking ties alphabetically', () => {
    const rows = topDominantOwners([
      file('a.ts', 'zoe@x.com'),
      file('b.ts', 'alice@x.com'),
      file('c.ts', 'alice@x.com'),
      file('d.ts', 'mark@x.com'),
      file('e.ts', 'mark@x.com'),
    ]);
    expect(rows.map((r) => r.author)).toEqual(['alice@x.com', 'mark@x.com', 'zoe@x.com']);
  });

  it('computes share against the input length, not a repo total', () => {
    const rows = topDominantOwners([
      file('a.ts', 'alice@x.com'),
      file('b.ts', 'alice@x.com'),
      file('c.ts', 'alice@x.com'),
      file('d.ts', 'bob@x.com'),
    ]);
    const alice = rows.find((r) => r.author === 'alice@x.com')!;
    expect(alice.share).toBeCloseTo(0.75);
  });
});
