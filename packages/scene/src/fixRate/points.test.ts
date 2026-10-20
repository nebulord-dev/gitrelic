import { describe, expect, it } from 'vitest';

import {
  BUILD_HIR,
  FLAGS_WWW,
  FRAGMENT_TEST,
  fixRateReport,
  PIPELINE,
  REPO_RATE,
  RUNNER,
} from '../../test/fixRateReport';
import reportJson from '../../test/fixtures/report.small.json';
import {
  binomialUpperTail,
  chanceAllows,
  fixPointOf,
  fixRateOf,
  ratePct,
} from './points';
import type { GitrelicReport } from '@gitrelic/core';

describe('binomialUpperTail', () => {
  it('matches known binomial values', () => {
    // 1 − 0.5^10 − 10·0.5^10 = 1013/1024
    expect(binomialUpperTail(10, 2, 0.5)).toBeCloseTo(1013 / 1024, 10);
    // P(X ≥ 1) = 1 − (1 − p)^n
    expect(binomialUpperTail(8, 1, REPO_RATE)).toBeCloseTo(
      1 - (1 - REPO_RATE) ** 8,
      12,
    );
    expect(binomialUpperTail(5, 0, 0.3)).toBe(1);
    expect(binomialUpperTail(5, 6, 0.3)).toBe(0);
    expect(binomialUpperTail(5, 1, 0)).toBe(0);
  });

  it('stays finite where (1 − p)^n underflows', () => {
    // 0.7^5000 is below the smallest double; mean 1500, sd ≈ 32.4.
    expect(0.7 ** 5000).toBe(0);
    expect(binomialUpperTail(5000, 1500, 0.3)).toBeGreaterThan(0.45);
    expect(binomialUpperTail(5000, 1500, 0.3)).toBeLessThan(0.55);
    expect(binomialUpperTail(5000, 1700, 0.3)).toBeLessThan(1e-6);
    const allowed = chanceAllows(5000, 0.3);
    expect(allowed).toBeGreaterThan(1550);
    expect(allowed).toBeLessThan(1580);
  });
});

describe('chanceAllows', () => {
  it('is the largest count with at least a 2.5% chance', () => {
    // At 1.2%: one fix in 8 is 9%, two is 0.4%.
    expect(chanceAllows(8, REPO_RATE)).toBe(1);
    // Two in 25 is still 3.6%.
    expect(chanceAllows(25, REPO_RATE)).toBe(2);
    expect(chanceAllows(10, 0.5)).toBe(8);
    expect(chanceAllows(10, 0)).toBe(0);
  });
});

describe('fixRateOf', () => {
  const data = fixRateOf(fixRateReport());

  it("flags React's three, not its single fixes, as above chance", () => {
    expect(data.points.filter((p) => p.aboveChance).map((p) => p.file)).toEqual(
      [RUNNER, PIPELINE, BUILD_HIR],
    );
    const flags = data.points.find((p) => p.file === FLAGS_WWW)!;
    expect(flags).toMatchObject({ aboveChance: false, allowed: 2, tier: 1 });
    expect(data.points.find((p) => p.file === FRAGMENT_TEST)!.tier).toBe(1);
  });

  it('tiers files by fixes: above chance, several, one, none', () => {
    expect(data.points.map((p) => p.tier)).toEqual([3, 3, 3, 1, 1, 0, 0, 0, 0]);
  });

  it('sorts above chance first, then by rate', () => {
    expect(data.points.slice(3).map((p) => p.file)).toEqual([
      FRAGMENT_TEST,
      FLAGS_WWW,
      'packages/react/src/d.js',
      'packages/react/src/c.js',
      'packages/react/src/a.js',
      'packages/react/src/b.js',
    ]);
  });

  it('is memoised per report', () => {
    const r = fixRateReport();
    expect(fixRateOf(r)).toBe(fixRateOf(r));
    expect(fixPointOf(r, RUNNER)?.fixedAfter).toBe(3);
  });

  it('marks a report from before fix rate unavailable', () => {
    const old = fixRateOf(reportJson as unknown as GitrelicReport);
    expect(old.available).toBe(true); // the regenerated fixture has it
    const pre = fixRateOf(
      fixRateReport([], { windowDays: 0, minChanges: 0, rate: null }),
    );
    expect(pre.available).toBe(false);
    expect(pre.points).toEqual([]);
  });
});

describe('ratePct', () => {
  it('keeps one decimal under 10%', () => {
    expect(ratePct(0.0121)).toBe('1.2%');
    expect(ratePct(0.375)).toBe('38%');
    expect(ratePct(0)).toBe('0%');
    expect(ratePct(0.05)).toBe('5%');
  });
});
