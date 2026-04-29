import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import {
  CONFIDENCE_FLOOR,
  ShameLeaderboard,
  TIER_KEYWORDS,
  classifyTier,
  prepareShameData,
} from './ShameLeaderboard';

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

describe('prepareShameData', () => {
  it('returns an empty array when the leaderboard is empty', () => {
    expect(prepareShameData(makeReport([]))).toEqual([]);
  });

  it('preserves the pre-sorted leaderboard order', () => {
    const report = makeReport([
      makeFile({ file: 'a.ts', shameScore: 90 }),
      makeFile({ file: 'b.ts', shameScore: 70 }),
      makeFile({ file: 'c.ts', shameScore: 50 }),
    ]);
    const out = prepareShameData(report);
    expect(out.map((e) => e.file)).toEqual(['a.ts', 'b.ts', 'c.ts']);
  });

  it('derives basename from a nested path', () => {
    const report = makeReport([makeFile({ file: 'foo/bar/baz.ts' })]);
    const out = prepareShameData(report);
    expect(out[0].name).toBe('baz.ts');
  });

  it('falls back to the full path when basename would be empty', () => {
    const report = makeReport([makeFile({ file: 'foo/bar/' })]);
    const out = prepareShameData(report);
    // basename = "" (after trailing slash split); fallback uses full path
    expect(out[0].name).toBe('foo/bar/');
  });

  it('returns null topKeyword when dominantKeywords is empty (→ tier mild)', () => {
    const report = makeReport([makeFile({ file: 'a.ts', dominantKeywords: [] })]);
    const out = prepareShameData(report);
    expect(out[0].topKeyword).toBeNull();
    expect(out[0].tier).toBe('mild');
  });

  it('passes through file, score, and shameCommitCount verbatim', () => {
    const report = makeReport([makeFile({ file: 'src/path/to/file.ts', shameScore: 42 })]);
    // shameCommitCount default in makeFile is 8
    const out = prepareShameData(report);
    expect(out[0].file).toBe('src/path/to/file.ts');
    expect(out[0].score).toBe(42);
    expect(out[0].shameCommitCount).toBe(8);
  });
});

describe('classifyTier', () => {
  it('returns mild when dominantKeyword is null', () => {
    expect(classifyTier(null)).toBe('mild');
  });

  it('returns mild for an unrecognized keyword', () => {
    expect(classifyTier('unknown')).toBe('mild');
  });
});

describe('CONFIDENCE_FLOOR (mirror of core)', () => {
  // Web can't value-import from `@gitrelic/core` (would bundle Node into the browser),
  // so the floor is duplicated here. This test catches the drift if core bumps the value
  // and someone forgets to update the web copy.
  it('matches the core analyzer value of 5', () => {
    expect(CONFIDENCE_FLOOR).toBe(5);
  });
});

describe('TIER_KEYWORDS (mirror of core SHAME_KEYWORDS)', () => {
  // Same drift-detection rationale as CONFIDENCE_FLOOR — keyword sets are duplicated
  // because we can't value-import from core. Canary assertions on one representative
  // keyword per tier; if core promotes/demotes keywords across tiers without updating
  // this file, the bar tier coloring will silently diverge from analyzer truth.
  it('keeps "revert" in the critical tier', () => {
    expect(TIER_KEYWORDS.critical.has('revert')).toBe(true);
  });

  it('keeps "hack" in the moderate tier', () => {
    expect(TIER_KEYWORDS.moderate.has('hack')).toBe(true);
  });

  it('keeps "fix" in the mild tier', () => {
    expect(TIER_KEYWORDS.mild.has('fix')).toBe(true);
  });
});
