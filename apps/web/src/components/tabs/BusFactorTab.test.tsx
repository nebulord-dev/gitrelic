import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BusFactorTab } from './BusFactorTab';

import type { FileBusFactor, GitrelicReport } from '@gitrelic/core';

function file(
  path: string,
  dominantAuthor: string,
  dominantAuthorPercent: number,
  uniqueAuthors: number,
  risk: FileBusFactor['risk'],
): FileBusFactor {
  return {
    file: path,
    uniqueAuthors,
    authors: [dominantAuthor],
    dominantAuthor,
    dominantAuthorPercent,
    risk,
  };
}

const makeReport = (overrides: Partial<GitrelicReport['busFactors']> = {}): GitrelicReport =>
  ({
    busFactors: {
      files: [],
      criticalFiles: [],
      overallBusFactor: 0,
      summary: '',
      ...overrides,
    },
  }) as unknown as GitrelicReport;

describe('BusFactorTab', () => {
  afterEach(() => cleanup());

  it('renders the No Data tier when overallBusFactor is 0', () => {
    render(<BusFactorTab report={makeReport()} onApplyPreset={vi.fn()} />);
    expect(screen.getByText('No Data')).toBeTruthy();
    expect(screen.getByTestId('narrative-kpi-big-number').textContent).toBe('0');
  });

  it('renders the Critical tier when overallBusFactor is 1', () => {
    const files = [file('a.ts', 'solo@x.com', 100, 1, 'critical')];
    render(
      <BusFactorTab
        report={makeReport({ files, criticalFiles: files, overallBusFactor: 1 })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText('Critical')).toBeTruthy();
    expect(screen.getByTestId('narrative-kpi-big-number').textContent).toBe('1');
  });

  it('renders the High Risk tier when overallBusFactor is 2 or 3', () => {
    render(<BusFactorTab report={makeReport({ overallBusFactor: 2 })} onApplyPreset={vi.fn()} />);
    expect(screen.getByText('High Risk')).toBeTruthy();
  });

  it('renders the Resilient tier when overallBusFactor is 4 or above', () => {
    render(<BusFactorTab report={makeReport({ overallBusFactor: 5 })} onApplyPreset={vi.fn()} />);
    expect(screen.getByText('Resilient')).toBeTruthy();
  });

  it('renders the top 3 dominant owners in the finding slot', () => {
    const criticalFiles = [
      // alice owns 3 files, bob owns 2, carol owns 1, dan owns 1
      file('a1.ts', 'alice@x.com', 100, 1, 'critical'),
      file('a2.ts', 'alice@x.com', 100, 1, 'critical'),
      file('a3.ts', 'alice@x.com', 100, 1, 'critical'),
      file('b1.ts', 'bob@x.com', 95, 2, 'critical'),
      file('b2.ts', 'bob@x.com', 95, 2, 'critical'),
      file('c1.ts', 'carol@x.com', 92, 3, 'critical'),
      file('d1.ts', 'dan@x.com', 90, 4, 'critical'),
    ];
    render(
      <BusFactorTab
        report={makeReport({
          files: criticalFiles,
          criticalFiles,
          overallBusFactor: 1,
        })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText('Top dominant owners')).toBeTruthy();
    expect(screen.getByText('alice@x.com')).toBeTruthy();
    expect(screen.getByText('bob@x.com')).toBeTruthy();
    // Tied at 1 file each — sort breaks alphabetically, carol wins the third slot
    expect(screen.getByText('carol@x.com')).toBeTruthy();
    expect(screen.queryByText('dan@x.com')).toBeNull();
  });

  it('renders the tier mix subline with the analyzer risk counts', () => {
    const files = [
      file('a.ts', 'a@x.com', 100, 1, 'critical'),
      file('b.ts', 'b@x.com', 80, 2, 'high'),
      file('c.ts', 'c@x.com', 60, 3, 'medium'),
      file('d.ts', 'd@x.com', 30, 4, 'low'),
      file('e.ts', 'e@x.com', 25, 5, 'low'),
    ];
    render(
      <BusFactorTab report={makeReport({ files, overallBusFactor: 1 })} onApplyPreset={vi.fn()} />,
    );
    expect(screen.getByText(/Tier mix/i)).toBeTruthy();
    // Counts: 1 critical, 1 high, 1 medium, 2 low
    expect(screen.getByText('2', { selector: 'strong' })).toBeTruthy();
    expect(screen.getAllByText('1', { selector: 'strong' })).toHaveLength(3);
  });

  it('renders the directory rollup ("Where they live")', () => {
    const criticalFiles = [
      file('packages/react-reconciler/src/a.ts', 'alice@x.com', 100, 1, 'critical'),
      file('packages/react-reconciler/src/b.ts', 'bob@x.com', 95, 2, 'critical'),
      file('compiler/babel/x.ts', 'carol@x.com', 92, 3, 'critical'),
    ];
    render(
      <BusFactorTab
        report={makeReport({ files: criticalFiles, criticalFiles, overallBusFactor: 1 })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText('Where they live')).toBeTruthy();
    expect(screen.getByText('packages/react-reconciler/src')).toBeTruthy();
  });

  it('fires onApplyPreset when see-also links are clicked', () => {
    const onApplyPreset = vi.fn();
    render(<BusFactorTab report={makeReport()} onApplyPreset={onApplyPreset} />);
    screen.getByText('Knowledge Silos').click();
    screen.getByText('Ghost Files').click();
    expect(onApplyPreset).toHaveBeenCalledWith('knowledge-silos');
    expect(onApplyPreset).toHaveBeenCalledWith('ghost-files');
  });
});
