import { describe, expect, it } from 'vitest';

import { ageReport } from '../../test/ageReport';
import reportJson from '../../test/fixtures/report.small.json';
import { checkScene } from '../model';
import { AGE_TESTS_PANEL, STRATA_ROWS, strataScene } from './strata';
import type { Scene } from '../model';
import type { GitrelicReport } from '@gitrelic/core';

const viewport = { width: 1200, height: 800 };
const mark = (scene: Scene, id: string) => scene.marks.find((m) => m.id === id);
const build = (report = ageReport(), open = new Set<string>()) =>
  strataScene({ report, commits: null, open }, viewport);

describe('strataScene', () => {
  it('is a sound scene, for an old repo and a young one', () => {
    expect(checkScene(build())).toEqual([]);
    expect(checkScene(build(reportJson as unknown as GitrelicReport))).toEqual(
      [],
    );
  });

  it('draws a row per package and a dot per source file', () => {
    const scene = build();
    expect(mark(scene, 'dir:packages/old')).toMatchObject({ shape: 'bar' });
    expect(mark(scene, 'repo')).toMatchObject({ shape: 'bar' });
    const dots = scene.marks.filter((m) => m.id.startsWith('file:'));
    expect(dots).toHaveLength(11);
    expect(mark(scene, 'file:fixtures/snap.txt')).toBeUndefined();
  });

  it('places older files further right, inside their row', () => {
    const scene = build();
    const legacy = mark(scene, 'file:src/legacy.ts')!;
    const core = mark(scene, 'file:src/core.ts')!;
    expect(legacy.x).toBeGreaterThan(core.x);
    const row = mark(scene, 'dir:src')!;
    for (const m of [legacy, core])
      expect(Math.abs(m.y - row.y)).toBeLessThan(row.h / 2);
  });

  it('sizes dots by lines', () => {
    const scene = build();
    expect(mark(scene, 'file:src/core.ts')!.r).toBeGreaterThan(
      mark(scene, 'file:src/flags.ts')!.r,
    );
  });

  it('rings orphaned files in the accent, selecting the file', () => {
    const scene = build();
    expect(mark(scene, 'orphan:scripts/release.js')).toMatchObject({
      shape: 'ring',
      paint: '--accent',
      selects: 'file:scripts/release.js',
    });
    expect(mark(scene, 'orphan:scripts/build.js')).toBeUndefined();
  });

  it('names a dormant package in the accent', () => {
    const label = mark(build(), 'row-label:packages/old')!;
    expect(label.labelSub).toBe('dormant · 3.4 years');
    expect(label.labelClass).toBe('atlas-label--hot');
    expect(mark(build(), 'row-label:scripts')!.labelClass).toBeUndefined();
  });

  it('adds tests only when the switch is on', () => {
    expect(mark(build(), 'file:src/core.test.ts')).toBeUndefined();
    expect(mark(build(), 'age-tests')).toMatchObject({
      toggles: AGE_TESTS_PANEL,
      label: 'Tests hidden',
    });
    const open = build(ageReport(), new Set([AGE_TESTS_PANEL]));
    expect(mark(open, 'file:src/core.test.ts')).toBeDefined();
    expect(mark(open, 'age-tests')!.label).toBe('Tests shown');
  });

  it('counts the packages past the cap', () => {
    const many = ageReport({
      files: Array.from({ length: STRATA_ROWS + 3 }, (_, k) => ({
        file: `p${k}/a.ts`,
        lastCommitDate: '2020-01-01T00:00:00Z',
        ageInDays: 400 + k,
        status: 'ancient' as const,
      })),
      dormantPackages: [],
    });
    const scene = build(many);
    expect(mark(scene, 'more')!.label).toBe(
      '+3 more packages in the table (T)',
    );
    expect(checkScene(scene)).toEqual([]);
  });
});
