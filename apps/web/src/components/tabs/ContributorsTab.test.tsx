import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ContributorsTab } from './ContributorsTab';
import type { Contributor, GitrelicReport } from '@gitrelic/core';

function makeContributor(overrides: Partial<Contributor> = {}): Contributor {
  return {
    email: 'sebastian@calyptus.eu',
    name: 'Sebastian Markbåge',
    commitCount: 334,
    firstCommit: '2024-09-15T00:00:00Z',
    lastCommit: '2026-04-20T00:00:00Z',
    filesOwned: 316,
    linesChanged: 12000,
    activeDays: 180,
    focusAreas: [
      'packages/react-devtools-shared',
      'packages/react-server',
      'packages/react-dom',
    ],
    isActive: true,
    isGhost: false,
    ...overrides,
  };
}

function makeReport(contributors: Contributor[] = []): GitrelicReport {
  return {
    contributors: {
      contributors,
      activeContributors: contributors.filter((c) => c.isActive),
      ghostContributors: contributors.filter((c) => c.isGhost),
      topContributor: contributors[0] ?? makeContributor(),
      summary: '',
      top3CommitShare: 0,
      newcomers90d: 0,
    },
  } as unknown as GitrelicReport;
}

describe('ContributorsTab', () => {
  afterEach(() => cleanup());

  it('renders the 6 column headers', () => {
    render(
      <ContributorsTab
        report={makeReport([makeContributor()])}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText('Contributor')).toBeTruthy();
    expect(screen.getByText('Commits')).toBeTruthy();
    expect(screen.getByText('Files')).toBeTruthy();
    expect(screen.getByText('Lines')).toBeTruthy();
    expect(screen.getByText('Last Active')).toBeTruthy();
    expect(screen.getByText('Focus Areas')).toBeTruthy();
  });

  it('renders the display name as primary text and email lighter below', () => {
    render(
      <ContributorsTab
        report={makeReport([makeContributor()])}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText('Sebastian Markbåge')).toBeTruthy();
    expect(screen.getByText('sebastian@calyptus.eu')).toBeTruthy();
  });

  it('renders the ghost badge inline with the contributor cell when isGhost=true', () => {
    render(
      <ContributorsTab
        report={makeReport([
          makeContributor({
            email: 'gone@x',
            name: 'Gone Author',
            isActive: false,
            isGhost: true,
          }),
        ])}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText('ghost')).toBeTruthy();
  });

  it('does NOT render the ghost badge for intermediate-zone contributors (isActive=false, isGhost=false)', () => {
    render(
      <ContributorsTab
        report={makeReport([
          makeContributor({
            email: 'middle@x',
            name: 'Middle Zone',
            isActive: false,
            isGhost: false,
          }),
        ])}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.queryByText('ghost')).toBeNull();
  });

  it('renders top-3 focus areas (not top-2)', () => {
    render(
      <ContributorsTab
        report={makeReport([makeContributor()])}
        onApplyPreset={vi.fn()}
      />,
    );
    const focus = screen.getByText(/packages\/react-devtools-shared/);
    expect(focus.textContent).toContain('packages/react-devtools-shared');
    expect(focus.textContent).toContain('packages/react-server');
    expect(focus.textContent).toContain('packages/react-dom');
  });

  it('renders an empty-state message when the contributor list is empty', () => {
    render(<ContributorsTab report={makeReport([])} onApplyPreset={vi.fn()} />);
    expect(screen.getByText(/No contributors found/)).toBeTruthy();
  });

  describe('see-also footer', () => {
    it('routes a Bus Factor click to onApplyPreset', () => {
      const onApplyPreset = vi.fn();
      render(
        <ContributorsTab
          report={makeReport([makeContributor()])}
          onApplyPreset={onApplyPreset}
        />,
      );
      screen.getByText('Bus Factor').click();
      expect(onApplyPreset).toHaveBeenCalledWith('bus-factor');
    });

    it('routes a Ghost Files click to onApplyPreset', () => {
      const onApplyPreset = vi.fn();
      render(
        <ContributorsTab
          report={makeReport([makeContributor()])}
          onApplyPreset={onApplyPreset}
        />,
      );
      screen.getByText('Ghost Files').click();
      expect(onApplyPreset).toHaveBeenCalledWith('ghost-files');
    });
  });
});
