import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { PerAuthorAiMix } from './PerAuthorAiMix';
import type { PerAuthorMixEntry } from '@gitrelic/core';

function row(overrides: Partial<PerAuthorMixEntry>): PerAuthorMixEntry {
  return {
    author: 'a@b.com',
    displayName: 'A',
    aiCommits: 0,
    soloCommits: 0,
    totalCommits: 0,
    personalRatio: 0,
    ...overrides,
  };
}

describe('PerAuthorAiMix', () => {
  it('renders one row per author with display name (not email)', () => {
    render(
      <PerAuthorAiMix
        rows={[
          row({
            author: 'alice@co.com',
            displayName: 'Alice',
            totalCommits: 10,
            aiCommits: 5,
            soloCommits: 5,
            personalRatio: 50,
          }),
          row({
            author: 'bob@co.com',
            displayName: 'Bob',
            totalCommits: 8,
            aiCommits: 0,
            soloCommits: 8,
            personalRatio: 0,
          }),
        ]}
      />,
    );
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.queryByText('alice@co.com')).toBeNull();
  });

  it('shows the personalRatio percentage on each row', () => {
    render(
      <PerAuthorAiMix
        rows={[row({ totalCommits: 10, aiCommits: 7, personalRatio: 70 })]}
      />,
    );
    expect(screen.getByText('70%')).toBeTruthy();
  });

  it('renders empty-state placeholder when rows is empty', () => {
    render(<PerAuthorAiMix rows={[]} />);
    expect(screen.getByText(/no human authors/i)).toBeTruthy();
  });

  it('renders the hero caption', () => {
    render(
      <PerAuthorAiMix rows={[row({ totalCommits: 5, soloCommits: 5 })]} />,
    );
    expect(
      screen.getByText(/horizontal bars · one row per human/i),
    ).toBeTruthy();
  });
});
