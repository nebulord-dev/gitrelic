import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { KnowledgeSilosTab } from './KnowledgeSilosTab';

import type { GitrelicReport } from '@gitrelic/core';

function makeReport(): GitrelicReport {
  return {
    knowledgeConcentration: {
      concentrationIndex: 67,
      singleAuthorFiles: 1870,
      totalFiles: 2792,
      summary: '67% of files are single-author dominant (1870/2792)',
    },
  } as unknown as GitrelicReport;
}

describe('KnowledgeSilosTab', () => {
  afterEach(() => cleanup());

  it('renders the big percentage, Moderate Risk badge, and both see-also links', () => {
    render(<KnowledgeSilosTab report={makeReport()} onApplyPreset={vi.fn()} />);
    expect(screen.getByText('67%')).toBeTruthy();
    expect(screen.getByText('Moderate Risk')).toBeTruthy();
    expect(screen.getByText('Concentration Index')).toBeTruthy();
    expect(screen.getByText('Bus Factor')).toBeTruthy();
    expect(screen.getByText('Ghost Files')).toBeTruthy();
    expect(
      screen.getByText('of 2792 files have a single dominant author (80%+ commits)'),
    ).toBeTruthy();
  });

  it('routes Bus Factor click to onApplyPreset("bus-factor")', () => {
    const onApplyPreset = vi.fn();
    render(<KnowledgeSilosTab report={makeReport()} onApplyPreset={onApplyPreset} />);
    screen.getByText('Bus Factor').click();
    expect(onApplyPreset).toHaveBeenCalledWith('bus-factor');
  });

  it('routes Ghost Files click to onApplyPreset("ghost-files")', () => {
    const onApplyPreset = vi.fn();
    render(<KnowledgeSilosTab report={makeReport()} onApplyPreset={onApplyPreset} />);
    screen.getByText('Ghost Files').click();
    expect(onApplyPreset).toHaveBeenCalledWith('ghost-files');
  });
});
