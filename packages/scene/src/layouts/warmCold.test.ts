import { describe, expect, it } from 'vitest';

import { ageReport } from '../../test/ageReport';
import reportJson from '../../test/fixtures/report.small.json';
import { checkScene } from '../model';
import { AGE_TESTS_PANEL } from './strata';
import { warmColdScene } from './warmCold';
import type { Scene } from '../model';
import type { GitrelicReport } from '@gitrelic/core';

const viewport = { width: 1200, height: 800 };
const mark = (scene: Scene, id: string) =>
  scene.marks.find((m) => m.id === id)!;
const build = (report = ageReport(), open = new Set<string>()) =>
  warmColdScene({ report, commits: null, open }, viewport);
const leftEdge = (m: { x: number; w: number }) => m.x - m.w / 2;
const rightEdge = (m: { x: number; w: number }) => m.x + m.w / 2;

describe('warmColdScene', () => {
  it('is a sound scene, for an old repo and a young one', () => {
    expect(checkScene(build())).toEqual([]);
    expect(checkScene(build(reportJson as unknown as GitrelicReport))).toEqual(
      [],
    );
  });

  it('runs warm lines left of the axis and cold ones right', () => {
    const scene = build();
    const axis = scene.guides.find((g) => g.id === 'age-axis')!;
    const x0 = axis.kind === 'line' ? axis.x1 : NaN;
    const warm = mark(scene, 'age-part:scripts:0');
    const cold = mark(scene, 'age-part:scripts:3');
    expect(rightEdge(warm)).toBeCloseTo(x0);
    expect(leftEdge(cold)).toBeCloseTo(x0);
    // 1,000 warm lines against 400 cold, on one scale.
    expect(warm.w / cold.w).toBeCloseTo(2.5);
    expect(warm.selects).toBe('dir:scripts');
  });

  it('puts the oldest band outermost', () => {
    const scene = build();
    // src: 50 lines four years old, nothing between a year and four.
    expect(mark(scene, 'age-part:src:4')).toBeDefined();
    expect(scene.marks.find((m) => m.id === 'age-part:src:2')).toBeUndefined();
  });

  it('marks orphaned lines at the cold end in the accent', () => {
    const scene = build();
    const orphan = mark(scene, 'age-orphan:scripts');
    const cold = mark(scene, 'age-part:scripts:3');
    expect(orphan.paint).toBe('--accent');
    expect(rightEdge(orphan)).toBeCloseTo(rightEdge(cold));
    expect(orphan.selects).toBe('dir:scripts');
  });

  it('names a dormant package in the accent, others by their cold lines', () => {
    const scene = build();
    expect(mark(scene, 'age-total:packages/old')).toMatchObject({
      label: '500 cold · 200 orphaned',
      labelSub: 'dormant · 3.4 years',
      labelClass: 'atlas-label--hot',
    });
    expect(mark(scene, 'age-total:scripts').label).toBe(
      '400 cold · 400 orphaned',
    );
  });

  it('heads the picture with the cold share', () => {
    expect(mark(build(), 'age-head').label).toBe(
      '20% of source lines unchanged for a year or more',
    );
  });

  it('shares the Tests switch with Strata', () => {
    const open = build(ageReport(), new Set([AGE_TESTS_PANEL]));
    expect(mark(open, 'age-tests').label).toBe('Tests shown');
    // src/core.test.ts: 200 cold lines join src's 50.
    expect(mark(open, 'age-total:src').label).toBe('250 cold');
  });
});
