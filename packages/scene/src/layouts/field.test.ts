import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import { hotspotReport } from '../../test/hotspotReport';
import { hotspotPoints, hotspotScale } from '../hotspots/points';
import { ids } from '../ids';
import { checkScene } from '../model';
import { FIELD_CALLOUTS, FIELD_DOT_CAP, fieldScene } from './field';
import type { GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;
const viewport = { width: 1200, height: 800 };
const points = hotspotPoints(report);
const scale = hotspotScale(report);

const build = (focus: string | null = null) =>
  fieldScene({ points, scale, focus }, viewport);

describe('fieldScene', () => {
  it('builds a sound scene', () => {
    expect(checkScene(build())).toEqual([]);
  });

  it('draws files scoring 25+ as dots and the rest as density', () => {
    const scene = build();
    const dots = scene.marks.filter((m) => m.id.startsWith('file:'));
    expect(dots.map((m) => m.id).sort()).toEqual(
      points
        .filter((p) => p.score >= 25)
        .map((p) => ids.file(p.file))
        .sort(),
    );
    const bins = scene.marks.filter((m) => m.id.startsWith('bin:'));
    expect(bins.length).toBeGreaterThan(0);
    // Density sits under the dots.
    for (const b of bins) expect(b.z).toBeLessThan(0);
  });

  it('maps every file without a dot to the density cell holding it', () => {
    const scene = build();
    const drawn = new Set(scene.marks.map((m) => m.id));
    for (const p of points) {
      const id = ids.file(p.file);
      if (drawn.has(id)) expect(scene.standIns?.has(id)).toBe(false);
      else expect(scene.standIns?.get(id)).toMatch(/^bin:\d+:\d+$/);
    }
    // Each cell holds as many files as its tooltip counts.
    const held = new Map<string, number>();
    for (const bin of scene.standIns!.values())
      held.set(bin, (held.get(bin) ?? 0) + 1);
    for (const [bin, n] of held) {
      const tip = scene.marks.find((m) => m.id === bin)!.tip![0];
      expect(tip.startsWith(`${n} file`)).toBe(true);
    }
  });

  it('places hotter files further up and to the right', () => {
    const scene = build();
    const at = (file: string) =>
      scene.marks.find((m) => m.id === ids.file(file))!;
    // helpers.ts: more commits and more lines than api.ts.
    expect(at('src/helpers.ts').x).toBeGreaterThan(at('src/api.ts').x);
    expect(at('src/helpers.ts').y).toBeLessThan(at('src/api.ts').y);
  });

  it('draws the selected file as a dot even under 25', () => {
    const low = points.find((p) => p.score < 25)!;
    const scene = build(ids.file(low.file));
    expect(scene.marks.some((m) => m.id === ids.file(low.file))).toBe(true);
    expect(checkScene(scene)).toEqual([]);
  });

  it('names the hottest files in a column, with leaders to their dots', () => {
    const scene = build();
    const callouts = scene.marks.filter((m) => m.id.startsWith('callout:'));
    const warm = points.filter((p) => p.score >= 25);
    expect(callouts).toHaveLength(Math.min(FIELD_CALLOUTS, warm.length));
    for (const c of callouts) {
      const file = c.id.slice('callout:'.length);
      expect(
        scene.links.some(
          (l) => l.source === c.id && l.target === ids.file(file),
        ),
      ).toBe(true);
      // The dot itself goes unlabelled: the column names it.
      expect(
        scene.marks.find((m) => m.id === ids.file(file))!.label,
      ).toBeUndefined();
      expect(c.shape).toBe('card');
    }
  });

  it('draws the 25 / 50 / 75 curves when the score can be scaled', () => {
    const guides = build().guides.filter((g) => g.id.startsWith('curve:'));
    expect(guides.length).toBeGreaterThan(0);
    const none = fieldScene({ points, scale: null }, viewport);
    expect(none.guides.some((g) => g.id.startsWith('curve:'))).toBe(false);
  });

  it('puts the 100-point file beyond the 75 curve', () => {
    const scene = build();
    const top = scene.marks.find((m) => m.id === ids.file('src/helpers.ts'))!;
    // Each 75-curve segment's x at the top file's height is left of it.
    const seg = scene.guides.find(
      (g) =>
        g.kind === 'line' &&
        g.id.startsWith('curve:75:') &&
        Math.min(g.y1, g.y2) <= top.y &&
        Math.max(g.y1, g.y2) >= top.y,
    );
    expect(seg?.kind).toBe('line');
    if (seg?.kind !== 'line') return;
    const t = (top.y - seg.y1) / (seg.y2 - seg.y1 || 1);
    expect(seg.x1 + t * (seg.x2 - seg.x1)).toBeLessThan(top.x);
  });

  it('caps the dots on a big repo, keeping the hottest', () => {
    const many = Array.from({ length: FIELD_DOT_CAP + 50 }, (_, i) => ({
      file: `f${i}.ts`,
      commits: 10 + (i % 7),
      loc: 200 + i,
      score: 30 + (i % 60),
    }));
    const r = hotspotReport(many);
    const scene = fieldScene(
      { points: hotspotPoints(r), scale: hotspotScale(r) },
      viewport,
    );
    expect(scene.marks.filter((m) => m.id.startsWith('file:'))).toHaveLength(
      FIELD_DOT_CAP,
    );
    expect(checkScene(scene)).toEqual([]);
    // The 50 warm files past the cap are density now, and their cells say
    // so instead of claiming everything in them scores under 25.
    const tips = scene.marks
      .filter((m) => m.id.startsWith('bin:'))
      .map((m) => m.tip![0]);
    const warm = tips.map((t) => Number(/, (\d+) at 25\+$/.exec(t)?.[1] ?? 0));
    expect(warm.reduce((a, b) => a + b, 0)).toBe(50);
    expect(tips.some((t) => /under 25/.test(t))).toBe(false);
  });

  it('copes with no files at all', () => {
    const scene = fieldScene({ points: [], scale: null }, viewport);
    expect(checkScene(scene)).toEqual([]);
    expect(scene.marks.some((m) => m.id.startsWith('file:'))).toBe(false);
  });

  it('names two hot files with one basename by their folders', () => {
    const r = hotspotReport([
      { file: 'client/index.ts', commits: 30, loc: 3000, score: 100 },
      { file: 'server/index.ts', commits: 28, loc: 2800, score: 90 },
    ]);
    const scene = fieldScene(
      { points: hotspotPoints(r), scale: hotspotScale(r) },
      viewport,
    );
    const callouts = scene.marks
      .filter((m) => m.id.startsWith('callout:'))
      .map((m) => m.label);
    expect(callouts.sort()).toEqual([
      '100  client/index.ts',
      '90  server/index.ts',
    ]);
  });

  it('gives every dot and density cell a tooltip', () => {
    const scene = build();
    const helpers = scene.marks.find(
      (m) => m.id === ids.file('src/helpers.ts'),
    )!;
    expect(helpers.tip).toEqual([
      'helpers.ts',
      'Score 100 · critical',
      expect.stringMatching(/^\d+ commits? · 24 lines$/),
      'src/',
    ]);
    for (const b of scene.marks.filter((m) => m.id.startsWith('bin:'))) {
      expect(b.tip?.[0]).toMatch(/^\d+ files? scoring under 25$/);
      expect(b.tip?.[1]).toMatch(/commits · .* lines$/);
    }
    // Scenery has nothing to say.
    expect(
      scene.marks.find((m) => m.id.startsWith('tick:'))!.tip,
    ).toBeUndefined();
  });
});
