import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import { buildEntityIndex } from '../entities';
import { ids, REPO_ID } from '../ids';
import { checkScene } from '../model';
import { lensReadings, type LensReading } from '../overview/readings';
import { lensTopEntities } from '../overview/topEntities';
import { FAN_VIEWS } from '../overview/viewHeadlines';
import { fanScene } from './fan';
import type { Link, Mark } from '../model';
import type { GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;
const index = buildEntityIndex(report);
const viewport = { width: 1200, height: 800 };
const repo = { label: 'repo', sub: '3 files' };
// Risk loud, Fix rate badging, Bus Factor loudest in its view.
const readings: LensReading[] = lensReadings(report).map((r) => ({
  ...r,
  grade:
    ({ 'cursed-files': 3, 'fix-rate': 2, 'bus-factor': 3 } as const)[
      r.preset as 'cursed-files'
    ] ?? 0,
}));
const closed = { view: 'code-health' as const, lens: null };
const markOf = (scene: ReturnType<typeof fanScene>, id: string) =>
  scene.marks.find((m) => m.id === id)!;

// The sample repo is too small for most fans: use a lens it has entities for.
const preset = ['hotspots', 'churn', 'cursed-files', 'age-map'].find(
  (p) => lensTopEntities(p, report, index).length > 0,
)!;
const previewing = {
  view: 'code-health' as const,
  lens: { preset, entities: lensTopEntities(preset, report, index) },
};

describe('fanScene', () => {
  it('draws the repo, every view, and only the open view’s lenses, soundly', () => {
    const scene = fanScene(repo, readings, closed, viewport);
    expect(checkScene(scene)).toEqual([]);
    expect(scene.marks[0]).toMatchObject({
      id: REPO_ID,
      shape: 'outline',
      label: 'repo',
      labelSub: '3 files',
    });
    expect(
      scene.marks.filter((m) => m.id.startsWith('view:')).map((m) => m.id),
    ).toEqual(FAN_VIEWS.map((v) => ids.view(v)));
    expect(
      scene.marks.filter((m) => m.id.startsWith('analyzer:')).map((m) => m.id),
    ).toEqual(
      readings
        .filter((r) => r.group === 'code-health')
        .map((r) => ids.analyzer(r.preset)),
    );
    // A trunk to each view, a branch to each open lens.
    expect(scene.links.filter((l) => l.source === REPO_ID)).toHaveLength(4);
    expect(
      scene.links.filter((l) => l.source === ids.view('code-health')),
    ).toHaveLength(readings.filter((r) => r.group === 'code-health').length);
  });

  it('heads each view with its loudest lens, heated by its grade', () => {
    const scene = fanScene(repo, readings, closed, viewport);
    const health = markOf(scene, ids.view('code-health'));
    const cursed = readings.find((r) => r.preset === 'cursed-files')!;
    expect(health).toMatchObject({
      label: 'Code Health',
      labelSub: cursed.value,
      paint: '--risk-3',
      labelClass: 'atlas-label--hot',
    });
    const team = markOf(scene, ids.view('team-activity'));
    expect(team.paint).toBe('--risk-0');
    expect(team.labelClass).toBeUndefined();
    expect(health.r).toBeGreaterThan(team.r);
  });

  it('opens the view it is given, its lenses growing out of it', () => {
    const scene = fanScene(
      repo,
      readings,
      { view: 'ownership-risk', lens: null },
      viewport,
    );
    const lenses = scene.marks.filter((m) => m.id.startsWith('analyzer:'));
    expect(lenses.length).toBeGreaterThan(0);
    for (const m of lenses) {
      expect(m.parent).toBe(ids.view('ownership-risk'));
      expect(m.foldOnExit).toBe(true);
    }
  });

  it('previews a lens: slides left, dims the rest, fans its entities out of it', () => {
    const before = fanScene(repo, readings, closed, viewport);
    const scene = fanScene(repo, readings, previewing, viewport);
    expect(checkScene(scene)).toEqual([]);
    expect(markOf(scene, REPO_ID).x).toBeLessThan(markOf(before, REPO_ID).x);
    const lens = markOf(scene, ids.analyzer(preset));
    expect(lens.x).toBeLessThan(markOf(before, ids.analyzer(preset)).x);
    expect(lens.alpha).toBe(1);
    const other = scene.marks.find(
      (m) => m.id.startsWith('analyzer:') && m.id !== lens.id,
    )!;
    expect(other.alpha).toBeLessThan(0.5);
    const fanned = scene.marks.filter((m) => m.parent === lens.id);
    // Same ids as the ring's fan and the lens's own view.
    expect(fanned.map((m) => m.id)).toEqual(
      previewing.lens.entities.map((e) => e.id),
    );
    // Outward, away from the open view.
    const view = markOf(scene, ids.view('code-health'));
    const far = (m: { x: number; y: number }) =>
      Math.hypot(m.x - view.x, m.y - view.y);
    for (const m of fanned) expect(far(m)).toBeGreaterThan(far(lens));
  });

  it('ignores a previewed lens outside the open view', () => {
    const scene = fanScene(
      repo,
      readings,
      { view: 'structure', lens: previewing.lens },
      viewport,
    );
    expect(scene.marks.some((m) => m.parent === ids.analyzer(preset))).toBe(
      false,
    );
  });

  it('gives views, lenses and fanned entities tooltips', () => {
    const scene = fanScene(repo, readings, previewing, viewport);
    expect(markOf(scene, ids.view('code-health')).tip?.[0]).toBe('Code Health');
    expect(markOf(scene, ids.analyzer(preset)).tip?.length).toBeGreaterThan(1);
    for (const e of previewing.lens.entities)
      expect(markOf(scene, e.id).tip).toEqual([e.label, e.value]);
  });

  it('is deterministic', () => {
    expect(fanScene(repo, readings, previewing, viewport)).toEqual(
      fanScene(repo, readings, previewing, viewport),
    );
  });

  // Geometry on the largest view: Code Health's nine lenses, each fanning
  // eight entities (the sample repo has fewer).
  const health = readings.filter((r) => r.group === 'code-health');
  const eight = Array.from({ length: 8 }, (_, i) => ({
    id: ids.file(`f${i}`),
    label: `src/some/file${i}.ts`,
    value: `${i}`,
  }));
  const preview = (p: string) =>
    fanScene(
      repo,
      readings,
      { view: 'code-health', lens: { preset: p, entities: eight } },
      viewport,
    );

  it('ranks the previewed lens’s label above the views’ and the tucked repo’s', () => {
    expect(health).toHaveLength(9);
    for (const lens of health) {
      const scene = preview(lens.preset);
      const own = markOf(scene, ids.analyzer(lens.preset)).labelPriority ?? 0;
      const repoPriority = markOf(scene, REPO_ID).labelPriority ?? 0;
      const views = scene.marks.filter((m) => m.id.startsWith('view:'));
      for (const v of views) {
        expect(own).toBeGreaterThan(v.labelPriority ?? 0);
        // Tucked, the repo gives way to the views beside it…
        expect(repoPriority).toBeLessThan(v.labelPriority ?? 0);
        // …and the dimmed views stay above the labels' alpha cutoff.
        expect(v.alpha).toBeGreaterThan(0.5);
      }
      expect(own).toBeGreaterThan(repoPriority);
    }
  });

  it('spaces the nine lenses at least a two-line label apart', () => {
    const ys = fanScene(repo, readings, closed, viewport)
      .marks.filter((m) => m.id.startsWith('analyzer:'))
      .map((m) => m.y);
    expect(ys).toHaveLength(9);
    for (let i = 1; i < ys.length; i++)
      expect(Math.abs(ys[i] - ys[i - 1])).toBeGreaterThanOrEqual(60);
  });

  /** Points along a link as the engine draws it (linkGeometry.ts). */
  function curveOf(link: Link, a: Mark, b: Mark, steps = 64) {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const bow = link.curve === 'straight' ? 0 : (link.bow ?? 0.2) * len;
    const cx = (a.x + b.x) / 2 + (-(b.y - a.y) / len) * bow;
    const cy = (a.y + b.y) / 2 + ((b.x - a.x) / len) * bow;
    return Array.from({ length: steps + 1 }, (_, k) => {
      const u = k / steps;
      const v = 1 - u;
      return {
        x: v * v * a.x + 2 * v * u * cx + u * u * b.x,
        y: v * v * a.y + 2 * v * u * cy + u * u * b.y,
      };
    });
  }

  it('keeps every branch clear of the other views, whichever is open', () => {
    for (const view of FAN_VIEWS) {
      const scene = fanScene(repo, readings, { view, lens: null }, viewport);
      const others = scene.marks.filter(
        (m) => m.id.startsWith('view:') && m.id !== ids.view(view),
      );
      const branches = scene.links.filter((l) => l.id.startsWith('branch:'));
      expect(branches.length).toBeGreaterThan(0);
      for (const l of branches) {
        const pts = curveOf(
          l,
          markOf(scene, l.source),
          markOf(scene, l.target),
        );
        for (const o of others)
          for (const p of pts)
            expect(
              Math.hypot(p.x - o.x, p.y - o.y),
              `${view} ${l.id} near ${o.id}`,
            ).toBeGreaterThan(o.r + 10);
      }
    }
  });

  it('keeps every lens’s fan in the world and off the other lenses', () => {
    for (const lens of health) {
      const scene = preview(lens.preset);
      const own = ids.analyzer(lens.preset);
      const fanned = scene.marks.filter((m) => m.parent === own);
      expect(fanned).toHaveLength(8);
      const lensMark = markOf(scene, own);
      const view = markOf(scene, ids.view('code-health'));
      const far = (m: Mark) => Math.hypot(m.x - view.x, m.y - view.y);
      const others = scene.marks.filter(
        (m) => m.id.startsWith('analyzer:') && m.id !== own,
      );
      for (const m of fanned) {
        expect(far(m)).toBeGreaterThan(far(lensMark));
        expect(m.x).toBeGreaterThanOrEqual(0);
        expect(m.x).toBeLessThanOrEqual(viewport.width);
        expect(m.y, `${lens.preset} ${m.id}`).toBeGreaterThanOrEqual(0);
        expect(m.y, `${lens.preset} ${m.id}`).toBeLessThanOrEqual(
          viewport.height,
        );
        for (const o of others)
          expect(
            Math.hypot(m.x - o.x, m.y - o.y),
            `${lens.preset} ${m.id} near ${o.id}`,
          ).toBeGreaterThan(30);
      }
    }
  });
});
