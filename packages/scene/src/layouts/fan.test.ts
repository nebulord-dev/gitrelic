import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import { buildEntityIndex } from '../entities';
import { ids, REPO_ID } from '../ids';
import { checkScene } from '../model';
import { lensReadings, type LensReading } from '../overview/readings';
import { lensTopEntities } from '../overview/topEntities';
import { FAN_VIEWS } from '../overview/viewHeadlines';
import { fanScene } from './fan';
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
    for (const m of fanned) expect(m.x).toBeGreaterThan(lens.x);
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
});
