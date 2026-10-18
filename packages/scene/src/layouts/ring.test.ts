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

describe('ringScene', () => {
  it('draws the repo and every lens, soundly', () => {
    const scene = ringScene('sample-repo', readings, null, viewport);
    expect(checkScene(scene)).toEqual([]);
    expect(scene.marks[0].id).toBe(REPO_ID);
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
    const scene = ringScene('repo', graded, null, viewport);
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

  it('fans a focused lens out beyond the ring, from the lens, dimming the rest', () => {
    const entities = lensTopEntities('hotspots', report, index, 5);
    const scene = ringScene(
      'repo',
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
      'repo',
      readings,
      { preset: 'hotspots', entities },
      viewport,
    );
    for (const e of entities) expect(e.id.startsWith('file:')).toBe(true);
    expect(scene.marks.filter((m) => m.id.startsWith('file:'))).toHaveLength(3);
  });

  it('ignores a focus on a lens it does not draw', () => {
    const scene = ringScene(
      'repo',
      readings,
      { preset: 'nope', entities: lensTopEntities('hotspots', report, index) },
      viewport,
    );
    expect(scene.marks.some((m) => m.id.startsWith('file:'))).toBe(false);
  });

  it('is deterministic', () => {
    expect(ringScene('repo', readings, null, viewport)).toEqual(
      ringScene('repo', readings, null, viewport),
    );
  });

  it('gives lenses and fanned entities tooltips', () => {
    const entities = lensTopEntities('hotspots', report, index, 3);
    const scene = ringScene(
      'repo',
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
});
