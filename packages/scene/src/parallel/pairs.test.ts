import { describe, expect, it } from 'vitest';

import { parallelReport } from '../../test/parallelReport';
import { PAIR_PEOPLE, parallelPairs, parallelPairsOf } from './pairs';

describe('parallelPairs', () => {
  it('weighs people by their pairs and seats partners next to each other', () => {
    const data = parallelPairs(parallelReport());
    // bob (3 + 2) first, then ann (tied to bob by 3), then cy, then dee;
    // eve collided with nobody and isn't drawn.
    expect(data.people.map((p) => p.email)).toEqual([
      'bob@x',
      'ann@x',
      'cy@x',
      'dee@x',
    ]);
    expect(data.people[0]).toMatchObject({
      name: 'bob',
      status: 'ghost',
      weeks: 5,
      partners: 2,
    });
    expect(data.pairs).toHaveLength(3);
    expect(data.leftOut).toEqual({ sweepingCommits: 3, botCommits: 1 });
  });

  it('draws at most PAIR_PEOPLE people, and only pairs between them', () => {
    const pairs = Array.from({ length: PAIR_PEOPLE + 2 }, (_, i) => ({
      a: `p${String(i).padStart(2, '0')}@x`,
      b: `q${String(i).padStart(2, '0')}@x`,
      weeks: 100 - i,
      files: [],
    }));
    const data = parallelPairs(parallelReport(pairs));
    expect(data.people).toHaveLength(PAIR_PEOPLE);
    const drawn = new Set(data.people.map((p) => p.email));
    for (const p of data.pairs) {
      expect(drawn.has(p.a) && drawn.has(p.b)).toBe(true);
    }
    expect(data.allPairs).toHaveLength(PAIR_PEOPLE + 2);
  });

  it('is memoised per report', () => {
    const report = parallelReport();
    expect(parallelPairsOf(report)).toBe(parallelPairsOf(report));
  });
});
