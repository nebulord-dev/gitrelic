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
    // A trunk to each view, a branch to each open lens, S-curves between
    // ports on the cards' edges.
    const trunks = scene.links.filter((l) => l.id.startsWith('trunk:'));
    expect(trunks.map((l) => [l.source, l.target])).toEqual(
      FAN_VIEWS.map((v) => ['port:repo:out', `port:${v}:in`]),
    );
    const branches = scene.links.filter((l) => l.id.startsWith('branch:'));
    expect(branches).toHaveLength(
      readings.filter((r) => r.group === 'code-health').length,
    );
    for (const l of [...trunks, ...branches]) expect(l.curve).toBe('s-curve');
    for (const l of branches) expect(l.source).toBe('port:code-health:out');
  });

  it('puts ports, invisible and unhittable, on the cards’ and the repo’s edges', () => {
    const scene = fanScene(repo, readings, closed, viewport);
    const repoMark = markOf(scene, REPO_ID);
    expect(markOf(scene, 'port:repo:out')).toMatchObject({
      x: repoMark.x + repoMark.r,
      y: repoMark.y,
      r: 0,
      alpha: 0,
      parent: REPO_ID,
    });
    for (const v of FAN_VIEWS) {
      const card = markOf(scene, ids.view(v));
      expect(markOf(scene, `port:${v}:in`)).toMatchObject({
        x: card.x - card.w / 2,
        y: card.y,
        r: 0,
        alpha: 0,
        parent: card.id,
      });
    }
    // Only the open view's lenses branch, so only it has a port out.
    const open = markOf(scene, ids.view('code-health'));
    expect(markOf(scene, 'port:code-health:out')).toMatchObject({
      x: open.x + open.w / 2,
      y: open.y,
    });
    expect(scene.marks.some((m) => m.id === 'port:structure:out')).toBe(false);
    for (const m of scene.marks.filter((m) => m.id.startsWith('port:')))
      expect(m.label).toBeUndefined();
  });

  it('rings the repo with a faint dashed orbit that follows it when tucked', () => {
    for (const focus of [closed, previewing]) {
      const scene = fanScene(repo, readings, focus, viewport);
      const repoMark = markOf(scene, REPO_ID);
      const orbit = scene.guides.find((g) => g.id === 'orbit:repo');
      expect(orbit).toMatchObject({
        kind: 'circle',
        x: repoMark.x,
        y: repoMark.y,
        paint: '--muted',
      });
      if (orbit?.kind !== 'circle') throw new Error('not a circle');
      expect(orbit.r / repoMark.r).toBeGreaterThanOrEqual(1.6);
      expect(orbit.r / repoMark.r).toBeLessThanOrEqual(1.8);
      expect(orbit.dash).toBeGreaterThan(0);
      expect(orbit.alpha).toBeLessThan(0.6);
    }
  });

  it('draws each view as a card headed by its loudest lens', () => {
    const scene = fanScene(repo, readings, closed, viewport);
    const health = markOf(scene, ids.view('code-health'));
    const cursed = readings.find((r) => r.preset === 'cursed-files')!;
    const [lead, ...rest] = cursed.value.split(' ');
    expect(health).toMatchObject({
      shape: 'card',
      labelAnchor: 'center',
      // The number large, the view's name over the rest of the reading.
      labelLead: lead,
      label: 'Code Health',
      labelSub: rest.join(' '),
    });
    expect(health.w).toBeGreaterThan(2 * health.h);
    expect(health.r).toBe(0);
    const team = markOf(scene, ids.view('team-activity'));
    expect(team.w).toBe(health.w);
    expect(team.h).toBe(health.h);
  });

  it('fills the open view’s card, touches loud ones with accent, leaves calm ones', () => {
    const scene = fanScene(repo, readings, closed, viewport);
    // Code Health is open (and loud); Ownership & Risk loud; Team calm.
    expect(markOf(scene, ids.view('code-health')).labelClass).toBe(
      'atlas-label--open',
    );
    expect(markOf(scene, ids.view('ownership-risk')).labelClass).toBe(
      'atlas-label--hot',
    );
    expect(markOf(scene, ids.view('team-activity')).labelClass).toBeUndefined();
    const other = fanScene(
      repo,
      readings,
      { view: 'team-activity', lens: null },
      viewport,
    );
    expect(markOf(other, ids.view('team-activity')).labelClass).toBe(
      'atlas-label--open',
    );
    expect(markOf(other, ids.view('code-health')).labelClass).toBe(
      'atlas-label--hot',
    );
  });

  it('stacks the cards in a column, clear of each other and of the lenses', () => {
    for (const view of FAN_VIEWS) {
      const scene = fanScene(repo, readings, { view, lens: null }, viewport);
      const cards = scene.marks.filter((m) => m.id.startsWith('view:'));
      for (let i = 1; i < cards.length; i++) {
        expect(cards[i].x).toBe(cards[0].x);
        expect(cards[i].y - cards[i - 1].y).toBeGreaterThan(cards[i].h + 24);
      }
      // Lens dots and their right-hand labels (two lines, 20 characters, at
      // the ~0.65 zoom the world fits at: about 220 by 50 units).
      for (const l of scene.marks.filter((m) => m.id.startsWith('analyzer:')))
        for (const c of cards) {
          const label = { x0: l.x - l.r, x1: l.x + l.r + 220 };
          const apart =
            label.x0 > c.x + c.w / 2 + 10 ||
            Math.abs(l.y - c.y) > c.h / 2 + 25 + 10;
          expect(apart, `${view} ${l.id} on ${c.id}`).toBe(true);
        }
    }
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
    // Outward, away from the arc's centre: the open card's port out.
    const view = markOf(scene, 'port:code-health:out');
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

  /** Points along an S-curve link as the engine draws it (linkGeometry.ts). */
  function curveOf(link: Link, a: Mark, b: Mark, steps = 64) {
    expect(link.curve).toBe('s-curve');
    const mx = (a.x + b.x) / 2;
    return Array.from({ length: steps + 1 }, (_, k) => {
      const u = k / steps;
      const v = 1 - u;
      return {
        x:
          v * v * v * a.x +
          3 * v * v * u * mx +
          3 * v * u * u * mx +
          u * u * u * b.x,
        y:
          v * v * v * a.y +
          3 * v * v * u * a.y +
          3 * v * u * u * b.y +
          u * u * u * b.y,
      };
    });
  }

  /** How far a point is outside a card (negative: inside). */
  const outside = (p: { x: number; y: number }, c: Mark) =>
    Math.max(Math.abs(p.x - c.x) - c.w / 2, Math.abs(p.y - c.y) - c.h / 2);

  it('keeps every link clear of the cards it doesn’t end at, whichever is open', () => {
    for (const view of FAN_VIEWS) {
      const scene = fanScene(repo, readings, { view, lens: null }, viewport);
      const cards = scene.marks.filter((m) => m.id.startsWith('view:'));
      const links = scene.links.filter(
        (l) => l.id.startsWith('branch:') || l.id.startsWith('trunk:'),
      );
      expect(links.length).toBeGreaterThan(4);
      for (const l of links) {
        const pts = curveOf(
          l,
          markOf(scene, l.source),
          markOf(scene, l.target),
        );
        for (const c of cards) {
          // A link may touch its own card at its port, nothing more.
          const own =
            l.target === `port:${c.id.slice(5)}:in` ||
            l.source === `port:${c.id.slice(5)}:out`;
          for (const p of pts)
            expect(
              outside(p, c),
              `${view} ${l.id} through ${c.id}`,
            ).toBeGreaterThan(own ? -0.01 : 10);
        }
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
      const view = markOf(scene, 'port:code-health:out');
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
