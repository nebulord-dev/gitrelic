import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RewriteRatioTab } from './RewriteRatioTab';

import type { GitrelicReport } from '@gitrelic/core';

const rewriteFile = (
  file: string,
  rewriteScore: number,
  ins = 100,
  del = 100,
) => ({
  file,
  rewriteScore,
  totalInsertions: ins,
  totalDeletions: del,
  ratio: del === 0 ? 0 : Math.min(ins, del) / Math.max(ins, del),
});

const makeReport = (
  overrides: Partial<GitrelicReport['rewriteRatio']> = {},
): GitrelicReport =>
  ({
    rewriteRatio: {
      files: [],
      topRewriters: [],
      totalInsertions: 0,
      totalDeletions: 0,
      highRewrite: 0,
      summary: '',
      ...overrides,
    },
  }) as unknown as GitrelicReport;

describe('RewriteRatioTab', () => {
  afterEach(() => cleanup());

  it('renders Healthy state when no high-rewrite files', () => {
    render(<RewriteRatioTab report={makeReport()} onApplyPreset={vi.fn()} />);
    expect(screen.getByText(/Healthy/)).toBeTruthy();
  });

  it('renders Moderate badge when 1–4 files cross threshold', () => {
    const files = Array.from({ length: 3 }, (_, i) =>
      rewriteFile(`f${i}.ts`, 80),
    );
    render(
      <RewriteRatioTab
        report={makeReport({ files, highRewrite: 3 })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByTestId('narrative-kpi-big-number').textContent).toBe(
      '3',
    );
    expect(screen.getByText('Moderate')).toBeTruthy();
  });

  it('renders High Rewrite badge when 5+ files cross threshold', () => {
    const files = Array.from({ length: 8 }, (_, i) =>
      rewriteFile(`f${i}.ts`, 80),
    );
    render(
      <RewriteRatioTab
        report={makeReport({ files, highRewrite: 8 })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByTestId('narrative-kpi-big-number').textContent).toBe(
      '8',
    );
    expect(screen.getByText('High Rewrite')).toBeTruthy();
  });

  it('renders top 3 high-rewrite files in the finding slot', () => {
    const files = [
      rewriteFile('a.ts', 95, 1840, 1790),
      rewriteFile('b.ts', 92, 920, 910),
      rewriteFile('c.ts', 90, 710, 680),
      rewriteFile('low.ts', 40),
    ];
    render(
      <RewriteRatioTab
        report={makeReport({ files, highRewrite: 3 })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText('a.ts')).toBeTruthy();
    expect(screen.getByText('b.ts')).toBeTruthy();
    expect(screen.getByText('c.ts')).toBeTruthy();
    expect(screen.queryByText('low.ts')).toBeNull();
  });

  it('renders the repo balance subline with formatted totals', () => {
    const files = [rewriteFile('a.ts', 90), rewriteFile('b.ts', 30, 100, 10)];
    render(
      <RewriteRatioTab
        report={makeReport({
          files,
          totalInsertions: 842310,
          totalDeletions: 518440,
          highRewrite: 1,
        })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText(/Repo balance/i)).toBeTruthy();
    // toLocaleString outputs "842,310" with comma separators
    expect(screen.getByText(/842,310/)).toBeTruthy();
    expect(screen.getByText(/518,440/)).toBeTruthy();
  });

  it('renders the directory rollup ("Where they live")', () => {
    const files = [
      rewriteFile('packages/react-reconciler/src/a.ts', 95),
      rewriteFile('packages/react-reconciler/src/b.ts', 90),
      rewriteFile('packages/react-reconciler/src/c.ts', 85),
      rewriteFile('compiler/babel/x.ts', 80),
      rewriteFile('compiler/babel/y.ts', 75),
      rewriteFile('low.ts', 30), // sub-threshold, ignored
    ];
    render(
      <RewriteRatioTab
        report={makeReport({ files, highRewrite: 5 })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText('Where they live')).toBeTruthy();
    expect(screen.getByText('packages/react-reconciler/src')).toBeTruthy();
  });

  it('fires onApplyPreset when see-also links are clicked', () => {
    const onApplyPreset = vi.fn();
    render(
      <RewriteRatioTab report={makeReport()} onApplyPreset={onApplyPreset} />,
    );
    screen.getByText('Churn').click();
    screen.getByText('Hotspots').click();
    expect(onApplyPreset).toHaveBeenCalledWith('churn');
    expect(onApplyPreset).toHaveBeenCalledWith('hotspots');
  });
});
