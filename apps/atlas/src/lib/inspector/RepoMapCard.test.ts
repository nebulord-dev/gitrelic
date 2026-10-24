import { lensReadings, PRESET_GROUPS } from '@gitrelic/scene';
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

import reportJson from '../../../../../packages/scene/test/fixtures/report.small.json';
import RepoMapCard from './RepoMapCard.svelte';
import type { GitrelicReport } from '@gitrelic/core';

// Code Health has two grade-2 lenses (summed: 4); Ownership & Knowledge has one
// grade-3 lens (summed: 3). The loudest view is the one with the top grade.
vi.mock('@gitrelic/scene', async (importOriginal) => {
  const real = await importOriginal<typeof import('@gitrelic/scene')>();
  const grades: Record<string, 0 | 2 | 3> = {
    hotspots: 2,
    churn: 2,
    'bus-factor': 3,
  };
  return {
    ...real,
    lensReadings: (r: GitrelicReport) =>
      real.lensReadings(r).map((x) => ({ ...x, grade: grades[x.preset] ?? 0 })),
  };
});

const report = reportJson as unknown as GitrelicReport;
const label = (id: string) => PRESET_GROUPS.find((g) => g.id === id)?.label;

describe('RepoMapCard', () => {
  it('names the view with the top grade, not the one with the biggest sum', () => {
    expect(lensReadings(report).filter((r) => r.grade >= 2)).toHaveLength(3);
    render(RepoMapCard, { report });
    const named = screen.getByText(label('ownership-risk')!);
    expect(named.className).toContain('text-accent');
    expect(screen.queryByText(label('code-health')!)).toBeNull();
  });
});
