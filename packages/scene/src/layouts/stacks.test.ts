import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import { checkScene, type Mark } from '../model';
import { riskStacks, type RiskStacks, type StackRow } from '../risk/stacks';
import { REASON_PAINT, stacksScene } from './stacks';
import type { GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;
const viewport = { width: 1200, height: 800 };
const scene = stacksScene(riskStacks(report), viewport);
const byId = new Map(scene.marks.map((m) => [m.id, m]));
const mark = (id: string): Mark => {
  const m = byId.get(id);
  if (!m) throw new Error(`no mark ${id}`);
  return m;
};

const row = (file: string, over: Partial<StackRow> = {}): StackRow => ({
  file,
  score: 55,
  sum: 55,
  breakdown: [
    { kind: 'churn', label: 'c', points: 35 },
    { kind: 'authors', label: 'a', points: 10 },
    { kind: 'parallel', label: 'p', points: 10 },
  ],
  cursed: true,
  short: 0,
  hotspot: null,
  accelerating: false,
  churn: 10,
  authors: 8,
  tier: 2,
  ...over,
});
const stacks = (rows: StackRow[]): RiskStacks => ({ rows, threshold: 50 });

describe('stacksScene', () => {
  it('is a sound scene', () => {
    expect(checkScene(scene)).toEqual([]);
  });

  it('draws each file as its row, selectable, with its tooltip', () => {
    const helpers = mark('file:src/helpers.ts');
    expect(helpers.shape).toBe('bar');
    expect(helpers.tip?.[0]).toBe('helpers.ts');
    // Cursed rows sit above near misses.
    expect(helpers.y).toBeLessThan(mark('file:src/index.ts').y);
  });

  it('splits a bar into segments that add up to its score, left to right', () => {
    const segs = ['churn', 'ownership', 'fixes'].map((k) =>
      mark(`seg:src/helpers.ts:${k}`),
    );
    for (let i = 1; i < segs.length; i++)
      expect(segs[i].x).toBeGreaterThan(segs[i - 1].x);
    // Widths are in proportion to points (35 : 30 : 20), less a gap each.
    expect(segs[0].w / segs[2].w).toBeCloseTo(35 / 20, 1);
    expect(segs[0].tip).toEqual([
      'Churn · 35 pts',
      expect.stringContaining('commits'),
    ]);
  });

  it('paints reasons with their roles, and a segment selects its file', () => {
    const seg = mark('seg:src/helpers.ts:ownership');
    expect(seg.paint).toBe(REASON_PAINT.ownership.paint);
    expect(seg.selects).toBe('file:src/helpers.ts');
    expect(seg.parent).toBe('file:src/helpers.ts');
  });

  it('thins near misses and parts them from the cursed with a separator', () => {
    const cursedSeg = mark('seg:src/helpers.ts:churn');
    const nearSeg = mark('seg:src/index.ts:churn');
    expect(nearSeg.h).toBeLessThan(cursedSeg.h);
    expect(nearSeg.alpha).toBeLessThan(cursedSeg.alpha);
    // Still well clear of many authors' faint person colour, so a near
    // miss's ownership never reads as many authors.
    const nearOwner = mark('seg:src/index.ts:ownership');
    expect(nearOwner.alpha - REASON_PAINT.authors.alpha).toBeGreaterThan(0.2);
    const sep = mark('near-label');
    expect(sep.label).toBe('near misses, under 50');
    expect(sep.y).toBeGreaterThan(mark('file:src/auth.ts').y);
    expect(sep.y).toBeLessThan(mark('file:src/index.ts').y);
  });

  it('draws the cursed line at the threshold and writes signals beside the bar', () => {
    const line = scene.guides.find((g) => g.id === 'threshold');
    expect(line).toBeDefined();
    expect(mark('threshold-label').label).toBe('cursed at 50');
    expect(mark('risk-score:src/helpers.ts').label).toBe(
      '85   hotspot 100 · accelerating',
    );
    expect(mark('risk-score:src/config.ts').label).toBe('65');
  });

  it('names every reason in the legend', () => {
    for (const k of Object.keys(REASON_PAINT))
      expect(byId.has(`legend:${k}`)).toBe(true);
  });

  it('runs the axis past 100 when a file’s reasons add up to more', () => {
    const over = stacksScene(
      stacks([row('a.ts', { score: 100, sum: 115 })]),
      viewport,
    );
    const ticks = over.marks.filter((m) => m.id.startsWith('tick:x:'));
    expect(ticks.map((m) => m.label)).toContain('100');
    const at100 = over.marks.find((m) => m.id === 'tick:x:100')!;
    const end = over.marks.find((m) => m.id === 'risk-score:a.ts')!;
    // The bar ends past the 100 tick.
    expect(end.x).toBeGreaterThan(at100.x);
    expect(checkScene(over)).toEqual([]);
  });

  it('leaves the separator out when there are no near misses', () => {
    const s = stacksScene(stacks([row('a.ts')]), viewport);
    expect(s.marks.some((m) => m.id === 'near-label')).toBe(false);
  });

  it('draws a bar without a split as one ghost segment of its score', () => {
    const s = stacksScene(stacks([row('a.ts', { breakdown: [] })]), viewport);
    const segs = s.marks.filter((m) => m.id.startsWith('seg:a.ts:'));
    expect(segs.map((m) => [m.id, m.paint])).toEqual([
      ['seg:a.ts:unknown', '--ghost'],
    ]);
    expect(segs[0].tip?.[1]).toBe('The split by reason isn’t in this report');
    expect(checkScene(s)).toEqual([]);
  });

  it('says so when no file scores 40 or more', () => {
    const s = stacksScene(stacks([]), viewport);
    expect(s.marks.map((m) => m.label)).toEqual(['No file scores 40 or more']);
    expect(checkScene(s)).toEqual([]);
  });

  it('fits many rows inside the viewport', () => {
    const many = Array.from({ length: 28 }, (_, i) =>
      row(`f${i}.ts`, { cursed: i < 8 }),
    );
    expect(checkScene(stacksScene(stacks(many), viewport))).toEqual([]);
  });
});
