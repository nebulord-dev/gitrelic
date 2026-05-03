import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CommitTimingTab } from './CommitTimingTab';
import type {
  AuthorStressProfile,
  FileTimingProfile,
  GitrelicReport,
} from '@gitrelic/core';

function makeAuthor(
  overrides: Partial<AuthorStressProfile> = {},
): AuthorStressProfile {
  return {
    email: 'alice@example.com',
    name: 'Alice Example',
    totalCommits: 100,
    lateNightCommits: 40,
    weekendCommits: 20,
    lateNightPercent: 40,
    weekendPercent: 20,
    stressScore: 32,
    ...overrides,
  };
}

function makeFile(file: string, stressScore = 75): FileTimingProfile {
  return {
    file,
    totalCommits: 10,
    lateNightPercent: 60,
    weekendPercent: 30,
    peakHour: 3,
    peakDay: 6,
    hourDistribution: new Array<number>(24).fill(0),
    stressScore,
  };
}

function makeReport(
  overrides: Partial<GitrelicReport['commitTiming']> = {},
): GitrelicReport {
  return {
    commitTiming: {
      files: [],
      stressFiles: [],
      repoLateNightPercent: 4,
      repoWeekendPercent: 7,
      summary: '4% of commits happen after hours, 7% on weekends',
      repoHourDayMatrix: Array.from({ length: 7 }, () =>
        new Array<number>(24).fill(0),
      ),
      highStress: 0,
      tierMix: { low: 0, medium: 0, high: 0, critical: 0 },
      byMonth: [],
      authorStress: [],
      ...overrides,
    },
  } as unknown as GitrelicReport;
}

describe('CommitTimingTab', () => {
  it('big number matches highStress', () => {
    render(
      <CommitTimingTab
        report={makeReport({ highStress: 7 })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByTestId('narrative-kpi-big-number').textContent).toBe(
      '7',
    );
  });

  it('renders top-3 stressed contributors with full names', () => {
    const authors = [
      makeAuthor({
        email: 'sm@x.com',
        name: 'Sebastian Markbåge',
        stressScore: 40,
      }),
      makeAuthor({
        email: 'ss@x.com',
        name: 'Sebastian Silbermann',
        stressScore: 35,
      }),
      makeAuthor({ email: 'js@x.com', name: 'Joseph Savona', stressScore: 22 }),
      makeAuthor({ email: 'l@x.com', name: 'Lauren', stressScore: 10 }),
    ];
    render(
      <CommitTimingTab
        report={makeReport({ authorStress: authors, highStress: 1 })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText(/Sebastian Markbåge/)).toBeTruthy();
    expect(screen.getByText(/Sebastian Silbermann/)).toBeTruthy();
    expect(screen.getByText(/Joseph Savona/)).toBeTruthy();
    expect(screen.queryByText(/^Lauren$/)).toBeNull();
  });

  it('disambiguator suffix appears in finding when names collide (analyzer-supplied)', () => {
    const authors = [
      makeAuthor({
        name: 'Alex Lee (alex)',
        email: 'alex@x.com',
        stressScore: 50,
      }),
      makeAuthor({
        name: 'Alex Lee (alee)',
        email: 'alee@x.com',
        stressScore: 40,
      }),
    ];
    render(
      <CommitTimingTab
        report={makeReport({ authorStress: authors, highStress: 1 })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText(/Alex Lee \(alex\)/)).toBeTruthy();
    expect(screen.getByText(/Alex Lee \(alee\)/)).toBeTruthy();
  });

  it('subline shows repo aggregate facts', () => {
    const { container } = render(
      <CommitTimingTab
        report={makeReport({
          repoLateNightPercent: 4,
          repoWeekendPercent: 7,
          authorStress: [makeAuthor()],
        })}
        onApplyPreset={vi.fn()}
      />,
    );
    // The subline interleaves text nodes with <strong> tags, so getByText
    // (which doesn't span element boundaries) won't match a regex spanning
    // both. Assert the concatenated textContent on the rendered tree instead.
    const text = container.textContent ?? '';
    expect(/4%\s+late-night/i.test(text)).toBe(true);
    expect(/7%\s+weekend/i.test(text)).toBe(true);
  });

  it('empty-state — highStress=0 and authorStress non-empty: still renders contributors', () => {
    render(
      <CommitTimingTab
        report={makeReport({
          highStress: 0,
          authorStress: [makeAuthor({ name: 'Alice Example' })],
        })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByTestId('narrative-kpi-big-number').textContent).toBe(
      '0',
    );
    expect(screen.getByText(/Alice Example/)).toBeTruthy();
  });

  it('no-eligible-authors — authorStress empty: shows fallback message', () => {
    render(
      <CommitTimingTab
        report={makeReport({ highStress: 0, authorStress: [] })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/no contributors with sufficient commit history/i),
    ).toBeTruthy();
  });

  it('directory rollup extras — populated when high-stress files exist', () => {
    const stressedFiles = [
      makeFile('src/a.ts'),
      makeFile('src/b.ts'),
      makeFile('docs/c.md'),
    ];
    render(
      <CommitTimingTab
        report={makeReport({
          highStress: 3,
          files: stressedFiles,
          authorStress: [makeAuthor()],
        })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText(/where they live/i)).toBeTruthy();
    expect(screen.getByText('src')).toBeTruthy();
  });

  it('see-also footer wires onApplyPreset for shame and hotspots', () => {
    const onApplyPreset = vi.fn();
    render(
      <CommitTimingTab
        report={makeReport({ authorStress: [makeAuthor()] })}
        onApplyPreset={onApplyPreset}
      />,
    );
    screen.getByRole('button', { name: 'Shame' }).click();
    expect(onApplyPreset).toHaveBeenCalledWith('shame');
    screen.getByRole('button', { name: 'Hotspots' }).click();
    expect(onApplyPreset).toHaveBeenCalledWith('hotspots');
  });
});
