import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import { buildEntityIndex } from '../entities';
import { ids } from '../ids';
import { checkScene, type Scene } from '../model';
import { lensReadings, type LensReading } from '../overview/readings';
import { lensTopEntities } from '../overview/topEntities';
import { repoVitals } from '../overview/vitals';
import { dashboardLayout } from '../views/overview';
import {
  chipWidth,
  dashboardScene,
  loudestLens,
  readingWeight,
} from './dashboard';
import type { FannedEntity } from '../overview/topEntities';
import type { GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;
const index = buildEntityIndex(report);
const vitals = repoVitals(report);
const topOf = (preset: string) => lensTopEntities(preset, report, index);

/** The fixture's lenses, two of them loud (Risk at 3, Bus Factor at 2). */
const readings: LensReading[] = lensReadings(report).map((r) => ({
  ...r,
  grade: r.preset === 'cursed-files' ? 3 : r.preset === 'bus-factor' ? 2 : 0,
  reason:
    r.preset === 'cursed-files'
      ? '8 files with a curse score of 50+'
      : r.preset === 'bus-factor'
        ? '63% of files rest on one author'
        : undefined,
}));
const fanned: FannedEntity[] = [
  { id: ids.file('src/a.ts'), label: 'a.ts', value: 'score 90' },
  { id: ids.file('src/b.ts'), label: 'b.ts', value: 'score 45' },
];
const mark = (scene: Scene, id: string) => scene.marks.find((m) => m.id === id);

describe('readingWeight', () => {
  it('reads a share, else the last number', () => {
    expect(readingWeight('3 of 8 fixed')).toBeCloseTo(0.375, 9);
    expect(readingWeight('3 of 0 fixed')).toBe(0);
    expect(readingWeight('+3,695 lines a month')).toBe(3695);
    expect(readingWeight('1.00 deleted per line added')).toBe(1);
    expect(readingWeight('vmx, gone 182 days')).toBe(182);
    expect(readingWeight('gone quiet')).toBe(0);
  });
});

describe('loudestLens', () => {
  it('is the highest grade, ties going to lens-bar order', () => {
    expect(loudestLens(readings)?.preset).toBe('cursed-files');
    const calm = readings.map((r) => ({ ...r, grade: 0 as const }));
    expect(loudestLens(calm)).toBe(calm[0]);
    expect(loudestLens([])).toBeUndefined();
  });
});

describe('dashboardScene', () => {
  it('draws the vitals, then every lens once, soundly', () => {
    const scene = dashboardScene(vitals, readings, topOf, null);
    expect(checkScene(scene)).toEqual([]);
    const shown = scene.marks.filter((m) => m.id.startsWith('vital:'));
    expect(shown.map((m) => m.label)).toEqual([
      'Files',
      'Lines',
      'Commits',
      'Contributors',
      'AI-assisted',
      'Language',
    ]);
    // Context, not findings: plain cards, never the accent fill.
    for (const v of shown) expect(v.labelClass).toBeUndefined();
    const lenses = scene.marks.filter((m) => m.id.startsWith('analyzer:'));
    expect(lenses.map((m) => m.id).sort()).toEqual(
      readings.map((r) => ids.analyzer(r.preset)).sort(),
    );
  });

  it('leads with the loudest lens: its reason, and the rows of what it points at', () => {
    const scene = dashboardScene(vitals, readings, () => fanned, null);
    const lead = mark(scene, ids.analyzer('cursed-files'))!;
    expect(lead).toMatchObject({
      labelClass: 'atlas-label--lead-hot',
      labelSub: '8 files with a curse score of 50+',
    });
    const rows = fanned.map((e) => mark(scene, e.id)!);
    rows.forEach((row, j) => {
      expect(row).toMatchObject({
        shape: 'card',
        label: fanned[j].label,
        labelSub: fanned[j].value,
        labelClass: 'atlas-label--row',
        parent: lead.id,
        slot: `fan:${j}`,
        w: lead.w,
      });
      expect(row.y).toBeGreaterThan(lead.y + lead.h / 2);
    });
    expect(rows[1].y).toBeGreaterThan(rows[0].y);
    // A bar under each row, the heaviest full width, picking its entity.
    const bars = [0, 1].map((j) => mark(scene, `weight:${j}`)!);
    expect(bars[0].w).toBeCloseTo(lead.w, 9);
    expect(bars[1].w).toBeCloseTo(lead.w / 2, 9);
    expect(bars[0].selects).toBe(fanned[0].id);
    // The lead's frame holds its card and rows, under them.
    const frame = mark(scene, 'frame:lead')!;
    expect(frame.z).toBe(0);
    expect(frame.y + frame.h / 2).toBeGreaterThan(rows[1].y + rows[1].h / 2);
  });

  it('puts the other outliers in a column beside the lead, the calm lenses in chips below', () => {
    const scene = dashboardScene(vitals, readings, topOf, null);
    const lead = mark(scene, ids.analyzer('cursed-files'))!;
    const bus = mark(scene, ids.analyzer('bus-factor'))!;
    expect(bus.x - bus.w / 2).toBeGreaterThan(lead.x + lead.w / 2);
    expect(bus).toMatchObject({
      labelClass: 'atlas-label--hot',
      labelSub: '63% of files rest on one author',
    });
    const chip = mark(scene, ids.analyzer('churn'))!;
    expect(chip).toMatchObject({
      labelClass: 'atlas-label--row',
      label: 'Churn',
      h: 30,
    });
    expect(chip.y).toBeGreaterThan(mark(scene, 'frame:lead')!.y);
    expect(mark(scene, 'heading:calm')?.labelSub).toBe(
      `${readings.length - 2} lenses`,
    );
  });

  it('wraps the chips within the width', () => {
    const scene = dashboardScene(vitals, readings, topOf, null);
    const chips = scene.marks.filter(
      (m) => m.id.startsWith('analyzer:') && m.h === 30,
    );
    const rows = new Set(chips.map((c) => c.y));
    expect(rows.size).toBeGreaterThan(1);
    const right = Math.max(...scene.marks.map((m) => m.x + m.w / 2));
    for (const c of chips) expect(c.x + c.w / 2).toBeLessThanOrEqual(right);
    expect(chipWidth(readings[0])).toBeGreaterThan(readings[0].label.length);
  });

  it('puts a picked lens in the lead and returns the old lead to its column', () => {
    const scene = dashboardScene(vitals, readings, () => fanned, 'churn');
    expect(checkScene(scene)).toEqual([]);
    const lead = mark(scene, ids.analyzer('churn'))!;
    // A calm lead: no accent, and its reading where a reason would be.
    expect(lead.labelClass).toBe('atlas-label--lead');
    expect(mark(scene, fanned[0].id)?.parent).toBe(lead.id);
    const risk = mark(scene, ids.analyzer('cursed-files'))!;
    expect(risk.labelClass).toBe('atlas-label--hot');
    expect(risk.x).toBeGreaterThan(lead.x + lead.w / 2);
  });
});

describe('dashboardLayout', () => {
  it('leads with the lens in focus, the loudest for a view or nothing', () => {
    const preset = lensReadings(report).find(
      (r) => topOf(r.preset).length > 0,
    )!.preset;
    const build = (focus: string | null) =>
      dashboardLayout.build(
        { report, commits: null, focus, index },
        { width: 1200, height: 800 },
      );
    const picked = build(ids.analyzer(preset));
    expect(mark(picked, ids.analyzer(preset))?.labelClass).toMatch(
      /^atlas-label--lead/,
    );
    expect(mark(picked, topOf(preset)[0].id)).toBeDefined();
    const loudest = loudestLens(lensReadings(report))!;
    for (const focus of [null, ids.view('code-health')])
      expect(
        mark(build(focus), ids.analyzer(loudest.preset))?.labelClass,
      ).toMatch(/^atlas-label--lead/);
    expect(dashboardLayout.focusKinds).not.toContain('view');
  });
});
