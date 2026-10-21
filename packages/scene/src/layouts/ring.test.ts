import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import { buildEntityIndex } from '../entities';
import { ids, REPO_ID } from '../ids';
import { checkScene } from '../model';
import { lensReadings, type LensReading } from '../overview/readings';
import { lensTopEntities } from '../overview/topEntities';
import { ringScene } from './ring';
import type { GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;
const index = buildEntityIndex(report);
const viewport = { width: 1200, height: 800 };
const readings = lensReadings(report);
const repo = { label: 'repo', sub: '3 files' };

describe('ringScene', () => {
  it('draws the repo and every lens, soundly', () => {
    const scene = ringScene(repo, readings, null, viewport);
    expect(checkScene(scene)).toEqual([]);
    expect(scene.marks[0].id).toBe(REPO_ID);
    // The centre: a thin outline holding the repo's name over its size.
    expect(scene.marks[0]).toMatchObject({
      shape: 'outline',
      label: repo.label,
      labelSub: repo.sub,
      labelClass: 'atlas-label--repo',
      labelAnchor: 'center',
    });
    const lensIds = scene.marks.filter((m) => m.id.startsWith('analyzer:'));
    expect(lensIds.map((m) => m.id)).toEqual(
      readings.map((r) => ids.analyzer(r.preset)),
    );
    // A spoke from the repo to each lens.
    expect(scene.links).toHaveLength(readings.length);
  });

  it('sizes, heats and ranks labels by grade', () => {
    const graded: LensReading[] = readings.map((r, i) => ({
      ...r,
      grade: i === 0 ? 3 : 0,
    }));
    const scene = ringScene(repo, graded, null, viewport);
    const loud = scene.marks.find(
      (m) => m.id === ids.analyzer(graded[0].preset),
    )!;
    const quiet = scene.marks.find(
      (m) => m.id === ids.analyzer(graded[1].preset),
    )!;
    expect(loud.r).toBeGreaterThan(quiet.r);
    expect(loud.paint).toBe('--risk-3');
    expect(loud.labelPriority).toBeGreaterThan(quiet.labelPriority ?? 0);
  });

  it('leans side labels apart toward the top and bottom, not across the middle', () => {
    const scene = ringScene(repo, readings, null, viewport);
    const lenses = scene.marks.filter((m) => m.id.startsWith('analyzer:'));
    const cy = viewport.height / 2;
    for (const m of lenses) {
      if (m.labelAnchor === 'above' || m.labelAnchor === 'below')
        expect(m.labelLean).toBeUndefined();
      else expect(Math.sign(m.labelLean ?? 0)).toBe(Math.sign(m.y - cy));
    }
    expect(lenses.some((m) => (m.labelLean ?? 0) < -0.4)).toBe(true);
  });

  it("turns a fanned lens's label inward, away from its fan", () => {
    // The fixture rates no file, so Fix rate fans the hotspots' files: the
    // test is about where the lens sits, not what it fans.
    const entities = lensTopEntities('hotspots', report, index, 5);
    const lensOf = (focus: Parameters<typeof ringScene>[2]) =>
      ringScene(repo, readings, focus, viewport).marks.find(
        (m) => m.id === ids.analyzer('fix-rate'),
      )!;
    const resting = lensOf(null);
    const fanned = lensOf({ preset: 'fix-rate', entities });
    expect(resting.labelAnchor).toBe('right');
    expect(fanned.labelAnchor).toBe('left');
    // Lifted off its spoke, which heads down to the centre from above it.
    expect(resting.y).toBeLessThan(viewport.height / 2);
    expect(fanned.labelLean).toBeLessThan(-0.5);
    // Focused with nothing to fan, it keeps its outward label.
    expect(lensOf({ preset: 'fix-rate', entities: [] }).labelAnchor).toBe(
      'right',
    );
  });

  it('keeps a fanned label off a vertical spoke at the top or bottom', () => {
    const lenses = ringScene(repo, readings, null, viewport).marks.filter((m) =>
      m.id.startsWith('analyzer:'),
    );
    const top = lenses.reduce((a, b) => (b.y < a.y ? b : a));
    const preset = top.id.slice('analyzer:'.length);
    const entities = lensTopEntities('hotspots', report, index, 3);
    const fanned = ringScene(
      repo,
      readings,
      { preset, entities },
      viewport,
    ).marks.find((m) => m.id === top.id)!;
    expect(['left', 'right']).toContain(fanned.labelAnchor);
    // Dropped toward the centre: below its fan, which spreads upward.
    expect(fanned.labelLean).toBeGreaterThan(0.5);
  });

  it('puts the lens name over its reading, with a hot class when it badges', () => {
    const graded: LensReading[] = readings.map((r, i) => ({
      ...r,
      grade: i === 0 ? 2 : 1,
    }));
    const scene = ringScene(repo, graded, null, viewport);
    const [hot, mild] = [0, 1].map((i) =>
      scene.marks.find((m) => m.id === ids.analyzer(graded[i].preset))!,
    );
    expect(hot.label).toBe(graded[0].label);
    expect(hot.labelSub).toBe(graded[0].value);
    expect(hot.labelClass).toBe('atlas-label--hot');
    expect(mild.labelClass).toBeUndefined();
  });

  it('fans a focused lens out beyond the ring, from the lens, dimming the rest', () => {
    const entities = lensTopEntities('hotspots', report, index, 5);
    const scene = ringScene(
      repo,
      readings,
      { preset: 'hotspots', entities },
      viewport,
    );
    expect(checkScene(scene)).toEqual([]);
    const lens = scene.marks.find((m) => m.id === ids.analyzer('hotspots'))!;
    const other = scene.marks.find((m) => m.id === ids.analyzer('churn'))!;
    expect(lens.alpha).toBe(1);
    expect(other.alpha).toBeLessThan(1);
    const centre = { x: viewport.width / 2, y: viewport.height / 2 };
    const dist = (m: { x: number; y: number }) =>
      Math.hypot(m.x - centre.x, m.y - centre.y);
    for (const e of entities) {
      const mark = scene.marks.find((m) => m.id === e.id)!;
      // Enters from the lens dot, and lands further out than it.
      expect(mark.parent).toBe(ids.analyzer('hotspots'));
      expect(dist(mark)).toBeGreaterThan(dist(lens));
      expect(scene.links.some((l) => l.id === `fan:${e.id}`)).toBe(true);
    }
  });

  it('keeps entity ids, so a fanned file is the same mark in the lens view', () => {
    const entities = lensTopEntities('hotspots', report, index, 3);
    const scene = ringScene(
      repo,
      readings,
      { preset: 'hotspots', entities },
      viewport,
    );
    for (const e of entities) expect(e.id.startsWith('file:')).toBe(true);
    expect(scene.marks.filter((m) => m.id.startsWith('file:'))).toHaveLength(3);
  });

  it('ignores a focus on a lens it does not draw', () => {
    const scene = ringScene(
      repo,
      readings,
      { preset: 'nope', entities: lensTopEntities('hotspots', report, index) },
      viewport,
    );
    expect(scene.marks.some((m) => m.id.startsWith('file:'))).toBe(false);
  });

  it('is deterministic', () => {
    expect(ringScene(repo, readings, null, viewport)).toEqual(
      ringScene(repo, readings, null, viewport),
    );
  });

  it('gives lenses and fanned entities tooltips', () => {
    const entities = lensTopEntities('hotspots', report, index, 3);
    const scene = ringScene(
      repo,
      readings,
      { preset: 'hotspots', entities },
      viewport,
    );
    const lens = scene.marks.find((m) => m.id === ids.analyzer('hotspots'))!;
    const reading = readings.find((r) => r.preset === 'hotspots')!;
    expect(lens.tip?.slice(0, 2)).toEqual([reading.label, reading.value]);
    const first = scene.marks.find((m) => m.id === entities[0].id)!;
    expect(first.tip).toEqual([entities[0].label, entities[0].value]);
  });

  it("names each view with its view id, a label that can't be hit", () => {
    const scene = ringScene(repo, readings, null, viewport);
    const views = scene.marks.filter((m) => m.id.startsWith('view:'));
    expect(views.map((m) => m.id)).toEqual(
      [...new Set(readings.map((r) => r.group))].map((g) => ids.view(g)),
    );
    for (const m of views)
      expect([m.shape, m.r, m.w, m.h]).toEqual(['card', 0, 0, 0]);
  });

  it('grows each lens out of its view, so the fan’s lenses travel to it', () => {
    const scene = ringScene(repo, readings, null, viewport);
    for (const r of readings) {
      const lens = scene.marks.find((m) => m.id === ids.analyzer(r.preset))!;
      expect(lens.parent).toBe(ids.view(r.group));
      expect(scene.marks.some((m) => m.id === lens.parent)).toBe(true);
    }
  });
});
