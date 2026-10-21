import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import { PRESET_GROUPS } from '../catalog';
import { lensReadings, type LensReading } from './readings';
import {
  FAN_VIEWS,
  loudestView,
  VIEW_BLURBS,
  viewHeadline,
} from './viewHeadlines';
import type { GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;
const calm = lensReadings(report).map((r) => ({ ...r, grade: 0 as const }));
const grade = (
  readings: readonly LensReading[],
  grades: Record<string, LensReading['grade']>,
) => readings.map((r) => ({ ...r, grade: grades[r.preset] ?? r.grade }));

describe('FAN_VIEWS', () => {
  it('is every view but the Overview, in rail order', () => {
    expect(FAN_VIEWS).toEqual(
      PRESET_GROUPS.filter((g) => g.id !== 'overview').map((g) => g.id),
    );
    for (const v of FAN_VIEWS) expect(VIEW_BLURBS[v]).toBeTruthy();
  });
});

describe('viewHeadline', () => {
  it('is the loudest lens, ties going to lens-bar order', () => {
    const readings = grade(calm, {
      'fix-rate': 2,
      'cursed-files': 3,
      churn: 3,
    });
    // churn comes before cursed-files in the lens bar.
    expect(viewHeadline('code-health', readings)?.preset).toBe('churn');
  });

  it("is the view's first lens when every lens is calm", () => {
    const first = calm.find((r) => r.group === 'team-activity')!;
    expect(viewHeadline('team-activity', calm)?.preset).toBe(first.preset);
  });

  it('is undefined for a view with no lenses', () => {
    expect(viewHeadline('structure', [])).toBeUndefined();
  });
});

describe('loudestView', () => {
  it('opens the view with the highest top grade, ties going to rail order', () => {
    const readings = grade(calm, { 'bus-factor': 3, 'cursed-files': 3 });
    expect(loudestView(readings)).toBe('code-health');
    expect(loudestView(grade(calm, { 'test-coverage': 2 }))).toBe('structure');
  });

  it('opens the first view when everything is calm', () => {
    expect(loudestView(calm)).toBe('code-health');
  });
});
