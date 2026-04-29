import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { ShameLeaderboard } from './ShameLeaderboard';

import type { GitrelicReport, FileForensics } from '@gitrelic/core';

const makeFile = (overrides: Partial<FileForensics> = {}): FileForensics => ({
  file: overrides.file ?? 'a.ts',
  shameScore: overrides.shameScore ?? 80,
  rawShamePoints: 16,
  shameCommitCount: 8,
  topShameCommits: [],
  dominantKeywords: overrides.dominantKeywords ?? ['fix'],
});

const makeReport = (leaderboard: FileForensics[]): GitrelicReport =>
  ({
    forensics: {
      files: leaderboard,
      shameLeaderboard: leaderboard,
      totalShameCommits: leaderboard.reduce((s, f) => s + f.shameCommitCount, 0),
      keywordTiers: { critical: 0, moderate: 0, mild: 0 },
      byMonth: [],
      summary: '',
    },
  }) as unknown as GitrelicReport;

describe('ShameLeaderboard', () => {
  it('renders the hero caption', () => {
    const onSelect = vi.fn();
    render(
      <ShameLeaderboard
        report={makeReport([makeFile()])}
        selectedFile={null}
        onSelectFile={onSelect}
      />,
    );
    expect(screen.getByText(/One row per file/)).toBeTruthy();
  });

  it('renders an empty state when the leaderboard is empty', () => {
    const onSelect = vi.fn();
    render(
      <ShameLeaderboard report={makeReport([])} selectedFile={null} onSelectFile={onSelect} />,
    );
    expect(screen.getByText(/No shame signals/i)).toBeTruthy();
  });

  it('encodes dominant-keyword tier in bar fill', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <ShameLeaderboard
        report={makeReport([
          makeFile({ file: 'a.ts', dominantKeywords: ['revert'] }), // critical
          makeFile({ file: 'b.ts', dominantKeywords: ['hack'] }), // moderate
          makeFile({ file: 'c.ts', dominantKeywords: ['fix'] }), // mild
        ])}
        selectedFile={null}
        onSelectFile={onSelect}
      />,
    );
    const bars = container.querySelectorAll('rect[data-tier]');
    const tiers = Array.from(bars).map((b) => b.getAttribute('data-tier'));
    expect(tiers).toEqual(['critical', 'moderate', 'mild']);
  });
});
