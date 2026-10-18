import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import { hotspotReport } from '../../test/hotspotReport';
import { hotspotPoints } from '../hotspots/points';
import { ids, REPO_ID } from '../ids';
import { checkScene } from '../model';
import { PACKAGES_MAX_GROW, packagesScene } from './packages';

const viewport = { width: 1200, height: 800 };
import type { GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;

const monorepo = hotspotReport([
  { file: 'packages/shared/a.js', commits: 30, loc: 100, score: 90 },
  { file: 'packages/shared/b.js', commits: 28, loc: 100, score: 80 },
  { file: 'packages/shared/c.js', commits: 2, loc: 50, score: 5 },
  { file: 'compiler/x.ts', commits: 4, loc: 400, score: 20 },
  { file: 'compiler/y.ts', commits: 3, loc: 300, score: 12 },
  { file: 'compiler/z.ts', commits: 1, loc: 90, score: 3 },
  { file: 'package.json', commits: 5, loc: 40, score: 15 },
]);

describe('packagesScene', () => {
  it('builds a sound scene from the fixture', () => {
    expect(checkScene(packagesScene(hotspotPoints(report), viewport))).toEqual(
      [],
    );
  });

  it('draws one circle per package and every file inside its own', () => {
    const scene = packagesScene(hotspotPoints(monorepo), viewport);
    expect(checkScene(scene)).toEqual([]);
    const rings = scene.marks.filter(
      (m) => m.shape === 'dot' && !m.id.startsWith('file:'),
    );
    // Drawn under their files.
    for (const r of rings) expect(r.z ?? 0).toBe(0);
    expect(rings.map((m) => m.id).sort()).toEqual(
      [ids.dir('compiler'), ids.dir('packages/shared'), REPO_ID].sort(),
    );
    const ring = (id: string) => rings.find((m) => m.id === id)!;
    for (const [file, pkg] of [
      ['packages/shared/c.js', ids.dir('packages/shared')],
      ['compiler/x.ts', ids.dir('compiler')],
      ['package.json', REPO_ID],
    ]) {
      const dot = scene.marks.find((m) => m.id === ids.file(file))!;
      const c = ring(pkg);
      expect(Math.hypot(dot.x - c.x, dot.y - c.y)).toBeLessThan(c.r);
    }
  });

  it('puts the hottest file of a package at its centre', () => {
    const scene = packagesScene(hotspotPoints(monorepo), viewport);
    const c = scene.marks.find((m) => m.id === ids.dir('packages/shared'))!;
    const dist = (file: string) => {
      const d = scene.marks.find((m) => m.id === ids.file(file))!;
      return Math.hypot(d.x - c.x, d.y - c.y);
    };
    expect(dist('packages/shared/a.js')).toBeLessThan(
      dist('packages/shared/c.js'),
    );
  });

  it('names how many files run hot, and greys packages with none', () => {
    const scene = packagesScene(hotspotPoints(monorepo), viewport);
    const name = (pkg: string) =>
      scene.marks.find((m) => m.id === `package:${pkg}`)!;
    expect(name('packages/shared').label).toBe('shared · 2 of 3 at 25+');
    expect(name('compiler').label).toBe('compiler');
    expect(name('').label).toBe('(root files)');
    // The name sits above its disc, and the disc carries no label of its own.
    const disc = scene.marks.find((m) => m.id === ids.dir('compiler'))!;
    expect(name('compiler').y).toBeLessThan(disc.y - disc.r);
    expect(disc.label).toBeUndefined();
    expect(disc.paint).toBe('--ghost');
  });

  it('labels only the files scoring 25+', () => {
    const scene = packagesScene(hotspotPoints(monorepo), viewport);
    const label = (file: string) =>
      scene.marks.find((m) => m.id === ids.file(file))!.label;
    expect(label('packages/shared/a.js')).toBe('a.js');
    expect(label('packages/shared/c.js')).toBeUndefined();
  });

  it('never overlaps two circles', () => {
    const files = Array.from({ length: 120 }, (_, i) => ({
      file: `pkg${i % 15}/f${i}.ts`,
      commits: 1 + (i % 9),
      loc: 50 + i,
      score: i % 100,
    }));
    const scene = packagesScene(hotspotPoints(hotspotReport(files)), viewport);
    const rings = scene.marks.filter(
      (m) => m.shape === 'dot' && !m.id.startsWith('file:'),
    );
    for (let i = 0; i < rings.length; i++)
      for (let j = i + 1; j < rings.length; j++) {
        const a = rings[i];
        const b = rings[j];
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(
          a.r + b.r,
        );
      }
    expect(checkScene(scene)).toEqual([]);
  });

  it('is empty, but sound, with no files', () => {
    const scene = packagesScene([], viewport);
    expect(scene.marks).toEqual([]);
    expect(checkScene(scene)).toEqual([]);
  });

  it('spreads a small repo out to use the stage, within limits', () => {
    const small = packagesScene(hotspotPoints(monorepo), viewport);
    // A handful of files would pack into ~100 units; grown, it fills more
    // of the 1200 × 800 world, but never past the cap.
    const { w, h } = small.bounds;
    expect(Math.max(w / viewport.width, h / viewport.height)).toBeGreaterThan(
      0.25,
    );
    const base = packagesScene(hotspotPoints(monorepo), {
      width: 1,
      height: 1,
    });
    expect(small.bounds.w).toBeLessThanOrEqual(
      base.bounds.w * PACKAGES_MAX_GROW + 1,
    );
    // Dots grow by the square root, so they stay small next to the circles.
    const dot = (s: typeof small) =>
      s.marks.find((m) => m.id === ids.file('packages/shared/a.js'))!.r;
    expect(dot(small) / dot(base)).toBeCloseTo(
      Math.sqrt(small.bounds.w / base.bounds.w),
      0,
    );
    expect(checkScene(small)).toEqual([]);
  });

  it('leaves a big repo at its natural size (the stage zooms out)', () => {
    const files = Array.from({ length: 3000 }, (_, i) => ({
      file: `pkg${i % 40}/f${i}.ts`,
      commits: 1 + (i % 9),
      loc: 50 + i,
      score: i % 100,
    }));
    const points = hotspotPoints(hotspotReport(files));
    expect(packagesScene(points, viewport).bounds).toEqual(
      packagesScene(points, { width: 1, height: 1 }).bounds,
    );
  });

  it('packs a thousand packages quickly', () => {
    const files = Array.from({ length: 6000 }, (_, i) => ({
      file: `packages/p${i % 1000}/f${i}.ts`,
      commits: 1 + (i % 9),
      loc: 50 + i,
      score: i % 100,
    }));
    const points = hotspotPoints(hotspotReport(files));
    const t = Date.now();
    const scene = packagesScene(points, viewport);
    // The spiral this replaced took ~20 s here; generous for slow CI.
    expect(Date.now() - t).toBeLessThan(1000);
    expect(scene.marks.filter((m) => m.id.startsWith('package:'))).toHaveLength(
      1000,
    );
  });
});
