import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgeMapTab } from './AgeMapTab';

import type { FileAge, GitrelicReport } from '@gitrelic/core';

function f(file: string, ageInDays: number, status: FileAge['status']): FileAge {
  return { file, lastCommitDate: '2025-01-01', ageInDays, status };
}

function makeReport(files: FileAge[]): GitrelicReport {
  return {
    meta: { ageInDays: 365 } as never,
    ageMap: {
      files,
      staleFiles: files.filter((x) => x.status === 'stale'),
      ancientFiles: files.filter((x) => x.status === 'ancient'),
      medianAgeDays: 0,
      thresholds: { freshLimit: 29, agingLimit: 120, staleLimit: 241 },
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('AgeMapTab', () => {
  afterEach(() => cleanup());

  it('renders the % cold big number with Healthy badge when no files are stale or ancient', () => {
    const files = [f('a/x.ts', 5, 'fresh'), f('a/y.ts', 30, 'aging')];
    render(<AgeMapTab report={makeReport(files)} onApplyPreset={vi.fn()} />);
    expect(screen.getByTestId('narrative-kpi-big-number').textContent).toBe('0%');
    expect(screen.getByText('Healthy')).toBeTruthy();
    expect(screen.getByText('% Cold')).toBeTruthy();
  });

  it('renders Moderate at 25–49% cold', () => {
    const files = [f('a.ts', 5, 'fresh'), f('b.ts', 5, 'fresh'), f('c.ts', 200, 'stale')];
    render(<AgeMapTab report={makeReport(files)} onApplyPreset={vi.fn()} />);
    // 1 of 3 = 33%
    expect(screen.getByTestId('narrative-kpi-big-number').textContent).toBe('33%');
    expect(screen.getByText('Moderate')).toBeTruthy();
  });

  it('renders High at 50–74% cold', () => {
    const files = [f('a.ts', 5, 'fresh'), f('b.ts', 200, 'stale'), f('c.ts', 300, 'ancient')];
    render(<AgeMapTab report={makeReport(files)} onApplyPreset={vi.fn()} />);
    // 2 of 3 = 67%
    expect(screen.getByTestId('narrative-kpi-big-number').textContent).toBe('67%');
    expect(screen.getByText('High')).toBeTruthy();
  });

  it('renders Critical at ≥75% cold', () => {
    const files = [
      f('a.ts', 5, 'fresh'),
      f('b.ts', 200, 'stale'),
      f('c.ts', 300, 'ancient'),
      f('d.ts', 350, 'ancient'),
    ];
    render(<AgeMapTab report={makeReport(files)} onApplyPreset={vi.fn()} />);
    // 3 of 4 = 75%
    expect(screen.getByTestId('narrative-kpi-big-number').textContent).toBe('75%');
    expect(screen.getByText('Critical')).toBeTruthy();
  });

  it('renders the tier mix subline', () => {
    const files = [
      f('a.ts', 5, 'fresh'),
      f('b.ts', 50, 'aging'),
      f('c.ts', 200, 'stale'),
      f('d.ts', 300, 'ancient'),
    ];
    render(<AgeMapTab report={makeReport(files)} onApplyPreset={vi.fn()} />);
    const subline = screen.getByText(/Tier mix:/).closest('div')!;
    expect(subline.textContent).toContain('1 fresh');
    expect(subline.textContent).toContain('1 aging');
    expect(subline.textContent).toContain('1 stale');
    expect(subline.textContent).toContain('1 ancient');
  });

  it('renders top-3 directories by median age in the finding', () => {
    const files = [
      f('hot/x.ts', 10, 'fresh'),
      f('hot/y.ts', 20, 'fresh'),
      f('warm/x.ts', 100, 'aging'),
      f('warm/y.ts', 110, 'aging'),
      f('cold/x.ts', 300, 'ancient'),
      f('cold/y.ts', 350, 'ancient'),
    ];
    render(<AgeMapTab report={makeReport(files)} onApplyPreset={vi.fn()} />);
    expect(screen.getByText('Top stale directories')).toBeTruthy();
    expect(screen.getByText('cold')).toBeTruthy();
    expect(screen.getByText('warm')).toBeTruthy();
  });

  it('renders the Where they live extras with top-5 directories by ancient count', () => {
    const files = [
      f('compiler/__tests__/fixtures/a.ts', 360, 'ancient'),
      f('compiler/__tests__/fixtures/b.ts', 360, 'ancient'),
      f('compiler/__tests__/fixtures/c.ts', 360, 'ancient'),
      f('src/x.ts', 300, 'ancient'),
      f('src/y.ts', 305, 'ancient'),
      f('scripts/q.ts', 280, 'ancient'),
      f('docs/d.ts', 260, 'ancient'),
      f('build/b.ts', 250, 'ancient'),
      f('hidden/h.ts', 245, 'ancient'),
    ];
    render(<AgeMapTab report={makeReport(files)} onApplyPreset={vi.fn()} />);
    expect(screen.getByText('Where they live')).toBeTruthy();
    expect(screen.getByText('compiler/__tests__/fixtures')).toBeTruthy();
  });

  it('routes Stale Files click to onApplyPreset("dead-code")', () => {
    const onApplyPreset = vi.fn();
    render(
      <AgeMapTab report={makeReport([f('a.ts', 300, 'ancient')])} onApplyPreset={onApplyPreset} />,
    );
    screen.getByText('Stale Files').click();
    expect(onApplyPreset).toHaveBeenCalledWith('dead-code');
  });

  it('routes Cursed Files click to onApplyPreset("cursed-files")', () => {
    const onApplyPreset = vi.fn();
    render(
      <AgeMapTab report={makeReport([f('a.ts', 300, 'ancient')])} onApplyPreset={onApplyPreset} />,
    );
    screen.getByText('Cursed Files').click();
    expect(onApplyPreset).toHaveBeenCalledWith('cursed-files');
  });

  it('renders empty-state copy when no files are tracked', () => {
    render(<AgeMapTab report={makeReport([])} onApplyPreset={vi.fn()} />);
    expect(screen.getByTestId('narrative-kpi-big-number').textContent).toBe('0%');
    expect(screen.getByText('No age signal in the analysis window.')).toBeTruthy();
  });
});
