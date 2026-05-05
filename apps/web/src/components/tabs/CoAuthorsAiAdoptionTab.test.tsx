import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { CoAuthorsAiAdoptionTab } from './CoAuthorsAiAdoptionTab';
import type { GitrelicReport } from '@gitrelic/core';

function makeReport(
  overrides: Partial<GitrelicReport['coAuthors']> = {},
  contributors: Array<{ email: string; name: string }> = [],
): GitrelicReport {
  return {
    coAuthors: {
      pairs: [],
      authorStats: [],
      totalCoAuthoredCommits: 0,
      summary: '',
      aiAssistedCommits: 0,
      humanAuthoredCommits: 0,
      aiAdoptionPercent: 0,
      aiAdoptionTier: 'none',
      aiAuthors: [],
      humanPairs: [],
      filteredBotCommits: 0,
      byMonth: [],
      perAuthorMix: [],
      ...overrides,
    },
    contributors: { contributors },
  } as unknown as GitrelicReport;
}

describe('CoAuthorsAiAdoptionTab', () => {
  it('Scenario 1: zero co-authors → renders em-dash and "No Co-Author Data"', () => {
    const report = makeReport({ totalCoAuthoredCommits: 0 });
    render(<CoAuthorsAiAdoptionTab report={report} onApplyPreset={vi.fn()} />);
    expect(
      screen.getByTestId('narrative-kpi-big-number').textContent,
    ).toContain('—');
    expect(screen.getByText(/no co-author data/i)).toBeTruthy();
  });

  it('Scenario 2: trailers but no AI → renders 0% with "No Adoption Yet"', () => {
    const report = makeReport({
      totalCoAuthoredCommits: 5,
      humanAuthoredCommits: 100,
      aiAssistedCommits: 0,
      aiAdoptionPercent: 0,
      aiAdoptionTier: 'none',
      humanPairs: [
        {
          authorA: 'a@b.com',
          authorB: 'c@d.com',
          coAuthoredCommits: 5,
          files: [],
          classification: 'human-pair',
        },
      ],
    });
    render(<CoAuthorsAiAdoptionTab report={report} onApplyPreset={vi.fn()} />);
    expect(
      screen.getByTestId('narrative-kpi-big-number').textContent,
    ).toContain('0%');
    expect(screen.getByText(/no adoption yet/i)).toBeTruthy();
  });

  it('Scenario 3: AI-assisted → renders adoption % and top-3 finding', () => {
    const report = makeReport(
      {
        totalCoAuthoredCommits: 100,
        humanAuthoredCommits: 200,
        aiAssistedCommits: 100,
        aiAdoptionPercent: 50,
        aiAdoptionTier: 'high',
        aiAuthors: [
          {
            author: 'dan@x.com',
            displayName: 'Dan',
            aiCommits: 60,
            totalCommits: 70,
            personalRatio: 86,
          },
          {
            author: 'lc@x.com',
            displayName: 'Lasercobra',
            aiCommits: 40,
            totalCommits: 50,
            personalRatio: 80,
          },
        ],
      },
      [
        { email: 'dan@x.com', name: 'Dan' },
        { email: 'lc@x.com', name: 'Lasercobra' },
      ],
    );
    render(<CoAuthorsAiAdoptionTab report={report} onApplyPreset={vi.fn()} />);
    expect(
      screen.getByTestId('narrative-kpi-big-number').textContent,
    ).toContain('50%');
    expect(screen.getByText(/high adoption/i)).toBeTruthy();
    expect(screen.getByText('Dan')).toBeTruthy();
    expect(screen.getByText('Lasercobra')).toBeTruthy();
  });

  it('renders bot-filter footnote when filteredBotCommits > 0', () => {
    const report = makeReport({
      totalCoAuthoredCommits: 5,
      filteredBotCommits: 3,
    });
    const { container } = render(
      <CoAuthorsAiAdoptionTab report={report} onApplyPreset={vi.fn()} />,
    );
    expect(screen.getByText(/bot-authored commits filtered/i)).toBeTruthy();
    expect(container.textContent).toMatch(/3\s*bot-authored commits filtered/i);
  });

  it('does not render bot footnote when filteredBotCommits === 0', () => {
    const report = makeReport({
      totalCoAuthoredCommits: 5,
      filteredBotCommits: 0,
    });
    render(<CoAuthorsAiAdoptionTab report={report} onApplyPreset={vi.fn()} />);
    expect(screen.queryByText(/bot-authored commits filtered/i)).toBeNull();
  });

  it('see-also footer fires onApplyPreset for contributors and parallel-dev', () => {
    const onApplyPreset = vi.fn();
    const report = makeReport({ totalCoAuthoredCommits: 5 });
    render(
      <CoAuthorsAiAdoptionTab report={report} onApplyPreset={onApplyPreset} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /contributors/i }));
    expect(onApplyPreset).toHaveBeenCalledWith('contributors');
    fireEvent.click(screen.getByRole('button', { name: /parallel dev/i }));
    expect(onApplyPreset).toHaveBeenCalledWith('parallel-dev');
  });
});
