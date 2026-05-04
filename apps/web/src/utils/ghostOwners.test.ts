import { describe, expect, it } from 'vitest';

import { topGhostOwners } from './ghostOwners';
import type { Contributor, GhostFile } from '@gitrelic/core';

function makeFile(file: string, dominantAuthor: string, loc = 100): GhostFile {
  return {
    file,
    dominantAuthor,
    dominantAuthorPercent: 90,
    lastAuthorCommitDate: '2024-01-01',
    authorInactiveDays: 200,
    loc,
  };
}

function makeContrib(email: string, name: string): Contributor {
  return {
    email,
    name,
    commitCount: 1,
    firstCommit: '',
    lastCommit: '',
    filesOwned: 0,
    linesChanged: 0,
    activeDays: 0,
    focusAreas: [],
    isActive: false,
    isGhost: true,
  };
}

describe('topGhostOwners', () => {
  it('returns [] for empty input', () => {
    expect(topGhostOwners([], [], 3)).toEqual([]);
  });

  it('groups files by dominantAuthor and sums LOC', () => {
    const files = [
      makeFile('a.ts', 'g1@x.com', 100),
      makeFile('b.ts', 'g1@x.com', 50),
      makeFile('c.ts', 'g2@x.com', 200),
    ];
    const contribs = [
      makeContrib('g1@x.com', 'Ghost One'),
      makeContrib('g2@x.com', 'Ghost Two'),
    ];
    const result = topGhostOwners(files, contribs, 3);
    expect(result).toEqual([
      { email: 'g1@x.com', name: 'Ghost One', fileCount: 2, ghostLoc: 150 },
      { email: 'g2@x.com', name: 'Ghost Two', fileCount: 1, ghostLoc: 200 },
    ]);
  });

  it('ranks by file count descending', () => {
    const files = [
      makeFile('a.ts', 'g1@x.com', 1000),
      makeFile('b.ts', 'g2@x.com', 50),
      makeFile('c.ts', 'g2@x.com', 50),
      makeFile('d.ts', 'g2@x.com', 50),
    ];
    const contribs = [
      makeContrib('g1@x.com', 'G1'),
      makeContrib('g2@x.com', 'G2'),
    ];
    const result = topGhostOwners(files, contribs, 3);
    // g2 wins despite g1 having higher LOC — primary sort is fileCount
    expect(result[0].email).toBe('g2@x.com');
    expect(result[0].fileCount).toBe(3);
    expect(result[1].email).toBe('g1@x.com');
  });

  it('breaks ties by alphabetical email', () => {
    const files = [
      makeFile('a.ts', 'b@x.com', 100),
      makeFile('b.ts', 'a@x.com', 100),
    ];
    const contribs = [makeContrib('a@x.com', 'A'), makeContrib('b@x.com', 'B')];
    const result = topGhostOwners(files, contribs, 3);
    expect(result[0].email).toBe('a@x.com');
    expect(result[1].email).toBe('b@x.com');
  });

  it('respects topN cap', () => {
    const files = [
      makeFile('a.ts', 'g1@x.com'),
      makeFile('b.ts', 'g2@x.com'),
      makeFile('c.ts', 'g3@x.com'),
      makeFile('d.ts', 'g4@x.com'),
    ];
    const contribs = [
      makeContrib('g1@x.com', 'G1'),
      makeContrib('g2@x.com', 'G2'),
      makeContrib('g3@x.com', 'G3'),
      makeContrib('g4@x.com', 'G4'),
    ];
    expect(topGhostOwners(files, contribs, 3)).toHaveLength(3);
  });

  it('falls back to email when contributor name is empty', () => {
    const files = [makeFile('a.ts', 'unknown@x.com')];
    const contribs = [makeContrib('unknown@x.com', '')];
    const result = topGhostOwners(files, contribs, 3);
    expect(result[0].name).toBe('unknown@x.com');
  });

  it('falls back to email when contributor is not in the contributors map', () => {
    const files = [makeFile('a.ts', 'orphan@x.com')];
    const result = topGhostOwners(files, [], 3);
    expect(result[0].name).toBe('orphan@x.com');
  });
});
