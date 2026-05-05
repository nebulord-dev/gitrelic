import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { CoAuthorsPairsTab } from './CoAuthorsPairsTab';
import type { GitrelicReport } from '@gitrelic/core';

function makeReport(
  pairs: GitrelicReport['coAuthors']['pairs'],
  filteredBotCommits = 0,
): GitrelicReport {
  return {
    coAuthors: {
      pairs,
      authorStats: [],
      totalCoAuthoredCommits: pairs.reduce(
        (s, p) => s + p.coAuthoredCommits,
        0,
      ),
      summary: '',
      aiAssistedCommits: 0,
      humanAuthoredCommits: 0,
      aiAdoptionPercent: 0,
      aiAdoptionTier: 'none',
      aiAuthors: [],
      humanPairs: pairs.filter((p) => p.classification === 'human-pair'),
      filteredBotCommits,
      byMonth: [],
      perAuthorMix: [],
    },
    contributors: { contributors: [] },
  } as unknown as GitrelicReport;
}

describe('CoAuthorsPairsTab', () => {
  it('renders rows with classification badges (AI and Human)', () => {
    const report = makeReport([
      {
        authorA: 'alice@co.com',
        authorB: 'noreply@anthropic.com',
        coAuthoredCommits: 10,
        files: ['a.ts'],
        classification: 'human-ai',
      },
      {
        authorA: 'bob@co.com',
        authorB: 'carol@co.com',
        coAuthoredCommits: 3,
        files: ['b.ts'],
        classification: 'human-pair',
      },
    ]);
    render(<CoAuthorsPairsTab report={report} onApplyPreset={vi.fn()} />);
    expect(screen.getByText('AI')).toBeTruthy();
    expect(screen.getByText('Human')).toBeTruthy();
  });

  it('renders empty placeholder when pairs is empty', () => {
    const report = makeReport([]);
    render(<CoAuthorsPairsTab report={report} onApplyPreset={vi.fn()} />);
    expect(screen.getByText(/no co-authored commits/i)).toBeTruthy();
  });

  it('renders bot-filter footnote when filteredBotCommits > 0', () => {
    const report = makeReport([], 5);
    render(<CoAuthorsPairsTab report={report} onApplyPreset={vi.fn()} />);
    expect(screen.getByText(/bot-authored commits filtered/i)).toBeTruthy();
  });

  it('renders pair rows sorted desc by coAuthoredCommits by default', () => {
    const report = makeReport([
      {
        authorA: 'a1@x.com',
        authorB: 'a2@x.com',
        coAuthoredCommits: 5,
        files: [],
        classification: 'human-pair',
      },
      {
        authorA: 'b1@x.com',
        authorB: 'b2@x.com',
        coAuthoredCommits: 50,
        files: [],
        classification: 'human-pair',
      },
      {
        authorA: 'c1@x.com',
        authorB: 'c2@x.com',
        coAuthoredCommits: 15,
        files: [],
        classification: 'human-pair',
      },
    ]);
    const { container } = render(
      <CoAuthorsPairsTab report={report} onApplyPreset={vi.fn()} />,
    );
    const text = container.textContent ?? '';
    const idxB = text.indexOf('b1@x.com');
    const idxC = text.indexOf('c1@x.com');
    const idxA = text.indexOf('a1@x.com');
    // b (50) should appear before c (15) which is before a (5)
    expect(idxB).toBeGreaterThanOrEqual(0);
    expect(idxB).toBeLessThan(idxC);
    expect(idxC).toBeLessThan(idxA);
  });
});
