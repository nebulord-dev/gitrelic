// Parallel Dev's Pairs (docs/atlas-views.md › Parallel Dev): the people who
// committed to the same file in the same week, and with whom. Read straight
// from core's `parallelDev.pairs`, which already leaves out sweeping
// commits, bots and non-source files and counts a pair's distinct weeks.
//
// People are ordered around the circle so partners sit near each other:
// the most-colliding person first, then each time the unplaced person tied
// most strongly to the ones already placed. Chords then run short where the
// ties are strong, and the circle reads as neighbourhoods.

import { personStatus, type PersonStatus } from '../contributors/flow';
import type { GitrelicReport } from '@gitrelic/core';

/** People drawn around the circle; the table lists the rest. */
export const PAIR_PEOPLE = 24;

export interface PairPerson {
  email: string;
  name: string;
  status: PersonStatus;
  /**
   * The weeks of all their pairs, summed: how much they collide, for sizing.
   * Not a count of weeks (a week shared with two partners counts twice).
   */
  weeks: number;
  /** People they collided with. */
  partners: number;
}

export interface Pair {
  a: string;
  b: string;
  weeks: number;
  files: string[];
}

export interface PairsData {
  /** In circle order. */
  people: PairPerson[];
  /** Pairs between drawn people, most weeks first. */
  pairs: Pair[];
  /** Every pair in the report, for findings and the table. */
  allPairs: Pair[];
  leftOut: { sweepingCommits: number; botCommits: number };
}

export function parallelPairs(report: GitrelicReport): PairsData {
  const { pairs: raw, leftOut } = report.parallelDev;
  const byEmail = new Map(
    report.contributors.contributors.map((c) => [c.email, c]),
  );
  const weight = new Map<string, number>();
  const partners = new Map<string, number>();
  for (const p of raw) {
    for (const e of [p.a, p.b]) {
      weight.set(e, (weight.get(e) ?? 0) + p.weeks);
      partners.set(e, (partners.get(e) ?? 0) + 1);
    }
  }
  // The people who collide most, then only pairs between them; anyone left
  // without a pair there (their partners all fell outside the cut) goes too,
  // so no dot is drawn without a chord.
  const strongest = [...weight]
    .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
    .slice(0, PAIR_PEOPLE)
    .map(([e]) => e);
  let drawn = new Set(strongest);
  let pairs = raw.filter((p) => drawn.has(p.a) && drawn.has(p.b));
  // Many separate pairs can all be split by that cut. Then seat whole pairs
  // instead, most weeks first, so the circle is never empty while pairs
  // exist.
  if (pairs.length === 0 && raw.length > 0) {
    drawn = new Set();
    for (const p of raw) {
      const add = [p.a, p.b].filter((e) => !drawn.has(e));
      if (drawn.size + add.length <= PAIR_PEOPLE)
        for (const e of add) drawn.add(e);
    }
    pairs = raw.filter((p) => drawn.has(p.a) && drawn.has(p.b));
  }
  const paired = new Set(pairs.flatMap((p) => [p.a, p.b]));
  const top = strongest.filter((e) => paired.has(e));
  for (const e of drawn) if (paired.has(e) && !top.includes(e)) top.push(e);

  // Circle order: greedy by ties to those already placed.
  const tie = new Map<string, Map<string, number>>();
  for (const p of pairs) {
    for (const [x, y] of [
      [p.a, p.b],
      [p.b, p.a],
    ]) {
      let m = tie.get(x);
      if (!m) tie.set(x, (m = new Map()));
      m.set(y, p.weeks);
    }
  }
  const order: string[] = [];
  const left = new Set(top);
  const pull = new Map(top.map((e) => [e, 0]));
  while (left.size > 0) {
    let best: string | null = null;
    for (const e of top) {
      if (!left.has(e)) continue;
      // Strongest tie to the placed people, then most collisions overall.
      if (
        best === null ||
        pull.get(e)! > pull.get(best)! ||
        (pull.get(e) === pull.get(best) && weight.get(e)! > weight.get(best)!)
      )
        best = e;
    }
    order.push(best!);
    left.delete(best!);
    for (const [other, w] of tie.get(best!) ?? [])
      if (left.has(other)) pull.set(other, pull.get(other)! + w);
  }

  return {
    people: order.map((email) => {
      const c = byEmail.get(email);
      return {
        email,
        name: c?.name ?? email,
        // Someone the contributors report doesn't list counts as quiet.
        status: c ? personStatus(c) : 'quiet',
        weeks: weight.get(email)!,
        partners: partners.get(email)!,
      };
    }),
    pairs,
    allPairs: raw,
    leftOut,
  };
}

const cache = new WeakMap<GitrelicReport, PairsData>();
/** `parallelPairs`, computed once per report. */
export function parallelPairsOf(report: GitrelicReport): PairsData {
  let data = cache.get(report);
  if (!data) {
    data = parallelPairs(report);
    cache.set(report, data);
  }
  return data;
}
