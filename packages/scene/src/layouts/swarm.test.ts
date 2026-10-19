import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import { churnSwarm, type SwarmRow } from '../churn/swarm';
import { checkScene } from '../model';
import { jitter, SWARM_ROWS, swarmScene } from './swarm';
import type { GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;
const viewport = { width: 1200, height: 800 };
const rows = churnSwarm(report);
const mark = (scene: ReturnType<typeof swarmScene>, id: string) =>
  scene.marks.find((m) => m.id === id);

function syntheticRows(count: number): SwarmRow[] {
  return Array.from({ length: count }, (_, k) => ({
    dir: `pkg${k}`,
    total: 100 - k,
    quiet: 0,
    files: [
      {
        file: `pkg${k}/a.ts`,
        commits: 10,
        insertions: 1,
        deletions: 1,
        character: 'tweaking' as const,
        tier: 2 as const,
      },
    ],
  }));
}

describe('swarmScene', () => {
  it('is a sound scene', () => {
    expect(checkScene(swarmScene(rows, viewport))).toEqual([]);
  });

  it('draws a row per package and a dot per file', () => {
    const scene = swarmScene(rows, viewport);
    expect(mark(scene, 'dir:src')).toMatchObject({ shape: 'bar' });
    // Root files share the repo's row, as in By package.
    expect(mark(scene, 'repo')).toMatchObject({ shape: 'bar' });
    const dots = scene.marks.filter((m) => m.id.startsWith('file:'));
    expect(dots).toHaveLength(9);
    expect(mark(scene, 'row-label:src')!.label).toBe('src/  25');
  });

  it('places files by commits, quiet ones grey inside the band', () => {
    const scene = swarmScene(rows, viewport);
    const helpers = mark(scene, 'file:src/helpers.ts')!;
    const types = mark(scene, 'file:src/types.ts')!;
    expect(helpers.x).toBeGreaterThan(types.x);
    expect(helpers.paint).toBe('--risk-3');
    expect(types.paint).toBe('--ghost');
    const edge = scene.guides.find((g) => g.id === 'band:edge');
    expect(edge?.kind === 'line' && types.x < edge.x1).toBe(true);
    expect(edge?.kind === 'line' && helpers.x > edge.x1).toBe(true);
  });

  it('keeps each dot inside its row', () => {
    const scene = swarmScene(rows, viewport);
    const row = mark(scene, 'dir:src')!;
    for (const m of scene.marks.filter((d) => d.id.startsWith('file:src/')))
      expect(Math.abs(m.y - row.y)).toBeLessThan(row.h / 2);
  });

  it('shades the biggest package strongest', () => {
    const scene = swarmScene(rows, viewport);
    const shade = (id: string) => {
      const p = mark(scene, id)!.paint;
      return typeof p === 'object' ? p.t : -1;
    };
    expect(shade('dir:src')).toBeGreaterThan(shade('dir:docs'));
  });

  it('names each row’s busiest file, not its quiet ones', () => {
    const scene = swarmScene(rows, viewport);
    expect(mark(scene, 'file:src/helpers.ts')!.label).toBe('helpers.ts');
    expect(mark(scene, 'file:src/index.ts')!.label).toBeUndefined();
    expect(mark(scene, 'file:docs/USAGE.md')!.label).toBeUndefined();
  });

  it('lands every file in the same place on every build', () => {
    const a = swarmScene(rows, viewport);
    const b = swarmScene(rows, viewport);
    expect(a.marks).toEqual(b.marks);
    const [u, v] = jitter('src/helpers.ts');
    expect(u).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
    expect(jitter('src/a.ts')).not.toEqual(jitter('src/b.ts'));
  });

  it('caps the rows and points to the table for the rest', () => {
    const scene = swarmScene(syntheticRows(SWARM_ROWS + 3), viewport);
    expect(checkScene(scene)).toEqual([]);
    expect(scene.marks.filter((m) => m.shape === 'bar')).toHaveLength(
      SWARM_ROWS,
    );
    expect(mark(scene, 'more')!.label).toBe(
      '+3 more packages in the table (T)',
    );
    expect(mark(swarmScene(rows, viewport), 'more')).toBeUndefined();
  });

  it('drops packages/ from row names', () => {
    const [row] = syntheticRows(1);
    const scene = swarmScene([{ ...row, dir: 'packages/shared' }], viewport);
    expect(mark(scene, 'row-label:packages/shared')!.label).toBe(
      'shared/  100',
    );
  });

  it('draws nothing but scenery for an empty report', () => {
    const scene = swarmScene([], viewport);
    expect(checkScene(scene)).toEqual([]);
    expect(scene.marks.some((m) => m.id.startsWith('file:'))).toBe(false);
  });
});
