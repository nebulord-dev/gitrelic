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

  it('draws no one whose partners all fell outside the cut', () => {
    // A hub with many partners, and dan, whose only partner (zed) is too weak
    // to make the cut, though dan's own weight does.
    const pairs = [
      ...Array.from({ length: PAIR_PEOPLE - 1 }, (_, i) => ({
        a: 'hub@x',
        b: `p${String(i).padStart(2, '0')}@x`,
        weeks: 3,
        files: [],
      })),
      { a: 'dan@x', b: 'zed@x', weeks: 2, files: [] },
    ];
    const data = parallelPairs(parallelReport(pairs));
    const drawn = data.people.map((p) => p.email);
    expect(drawn).not.toContain('dan@x');
    expect(drawn).toHaveLength(PAIR_PEOPLE);
    for (const e of drawn)
      expect(data.pairs.some((p) => p.a === e || p.b === e)).toBe(true);
  });

  it('seats whole pairs when the cut would split every one', () => {
    // 30 separate pairs, everyone at one week: by name the cut takes 24
    // a-people and not one partner.
    const pairs = Array.from({ length: 30 }, (_, i) => ({
      a: `a${String(i).padStart(2, '0')}@x`,
      b: `z${String(i).padStart(2, '0')}@x`,
      weeks: 1,
      files: [],
    }));
    const data = parallelPairs(parallelReport(pairs));
    expect(data.pairs).toHaveLength(PAIR_PEOPLE / 2);
    expect(data.people).toHaveLength(PAIR_PEOPLE);
  });

  it('is memoised per report', () => {
    const report = parallelReport();
    expect(parallelPairsOf(report)).toBe(parallelPairsOf(report));
  });
});
