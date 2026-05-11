import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RenamesTab } from './RenamesTab';
import type { FileRenameChain, GitrelicReport } from '@gitrelic/core';

function makeChain(
  currentPath: string,
  previousNames: string[],
  renameCount?: number,
): FileRenameChain {
  return {
    currentPath,
    previousNames,
    renameCount: renameCount ?? previousNames.length,
  };
}

function makeReport(overrides: {
  chains?: FileRenameChain[];
  totalRenames?: number;
  totalFiles?: number;
}): GitrelicReport {
  const chains = overrides.chains ?? [];
  return {
    renameTracking: {
      renames: [],
      chains,
      totalRenames:
        overrides.totalRenames ?? chains.reduce((s, c) => s + c.renameCount, 0),
      filesWithRenames: chains.length,
      summary: '',
    },
    loc: {
      totalFiles: overrides.totalFiles ?? 100,
      totalLines: 0,
      files: [],
      languages: [],
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('RenamesTab', () => {
  afterEach(() => cleanup());

  it('renders the No Renames tier on an empty repo', () => {
    render(
      <RenamesTab
        report={makeReport({ chains: [] })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByTestId('narrative-kpi-big-number').textContent).toBe(
      '0',
    );
    expect(screen.getByText('No Renames')).toBeTruthy();
    expect(
      screen.getByText('No renames detected in this analysis window.'),
    ).toBeTruthy();
  });

  it('renders the Renames Detected tier when all chains are length 1', () => {
    const chains = [
      makeChain('src/a.ts', ['old/a.ts'], 1),
      makeChain('src/b.ts', ['old/b.ts'], 1),
    ];
    render(
      <RenamesTab
        report={makeReport({ chains, totalFiles: 100 })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByTestId('narrative-kpi-big-number').textContent).toBe(
      '2',
    );
    expect(screen.getByText('Renames Detected')).toBeTruthy();
  });

  it('renders the Tracked Chains tier when any chain is length >= 2', () => {
    const chains = [
      makeChain('src/a.ts', ['old/a.ts'], 1),
      makeChain('src/b.ts', ['old/b.ts', 'mid/b.ts'], 2),
    ];
    render(
      <RenamesTab
        report={makeReport({ chains, totalFiles: 100 })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText('Tracked Chains')).toBeTruthy();
  });

  it('lists the top-3 most-renamed chains in the finding', () => {
    const chains = [
      makeChain('a.ts', ['x'], 1),
      makeChain('big.ts', ['x', 'y', 'z'], 3),
      makeChain('mid.ts', ['x', 'y'], 2),
      makeChain('low.ts', ['x'], 1),
    ];
    render(
      <RenamesTab
        report={makeReport({ chains, totalFiles: 100 })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText('big.ts')).toBeTruthy();
    expect(screen.getByText('mid.ts')).toBeTruthy();
    // 4th-ranked falls outside top-3 — `low.ts` is excluded.
    expect(screen.queryByText('low.ts')).toBeNull();
  });

  it('tiebreaks tied-count chains by full path so the strip and panel agree', () => {
    // All length-1 chains — the degenerate case where renameCount carries
    // no signal. Sort fallback should be `a.currentPath.localeCompare(b)`
    // so the bottom-panel top-3 matches the metrics strip's `Most Renamed`.
    const chains = [
      makeChain('zebra/late.ts', ['z-old.ts'], 1),
      makeChain('compiler/.claude/settings.json', ['settings.local.json'], 1),
      makeChain('mango/middle.ts', ['m-old.ts'], 1),
      makeChain('apple/early.ts', ['a-old.ts'], 1),
    ];
    render(
      <RenamesTab
        report={makeReport({ chains, totalFiles: 100 })}
        onApplyPreset={vi.fn()}
      />,
    );
    // `apple/...` < `compiler/...` < `mango/...` < `zebra/...`
    expect(screen.getByText('early.ts')).toBeTruthy();
    expect(screen.getByText('settings.json')).toBeTruthy();
    expect(screen.getByText('middle.ts')).toBeTruthy();
    expect(screen.queryByText('late.ts')).toBeNull();
  });

  it('renders the directory portion of paths alongside basenames', () => {
    const chains = [makeChain('packages/web/Foo.ts', ['legacy/Foo.ts'], 1)];
    render(
      <RenamesTab
        report={makeReport({ chains, totalFiles: 100 })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText('Foo.ts')).toBeTruthy();
    expect(screen.getByText('packages/web')).toBeTruthy();
  });

  it('renders the subline with totals + longest chain + tracked-files percent', () => {
    const chains = [
      makeChain('a.ts', ['x'], 1),
      makeChain('b.ts', ['y', 'z'], 2),
    ];
    render(
      <RenamesTab
        report={makeReport({ chains, totalFiles: 100 })}
        onApplyPreset={vi.fn()}
      />,
    );
    const subline = screen.getByText(/longest chain/).closest('div')!;
    expect(subline.textContent).toContain('3');
    expect(subline.textContent).toContain('rename events');
    expect(subline.textContent).toContain('longest chain:');
    expect(subline.textContent).toContain('2');
    expect(subline.textContent).toContain('steps');
    expect(subline.textContent).toContain('2%');
    expect(subline.textContent).toContain('of tracked files');
  });

  it('handles a 0-totalFiles repo without a NaN percent', () => {
    const chains = [makeChain('a.ts', ['x'], 1)];
    render(
      <RenamesTab
        report={makeReport({ chains, totalFiles: 0 })}
        onApplyPreset={vi.fn()}
      />,
    );
    const subline = screen.getByText(/longest chain/).closest('div')!;
    expect(subline.textContent).toContain('0%');
  });

  it('fires onApplyPreset when see-also footer links are clicked', () => {
    const onApplyPreset = vi.fn();
    render(
      <RenamesTab
        report={makeReport({ chains: [] })}
        onApplyPreset={onApplyPreset}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Hotspots' }));
    fireEvent.click(screen.getByRole('button', { name: 'Churn' }));
    expect(onApplyPreset).toHaveBeenCalledWith('hotspots');
    expect(onApplyPreset).toHaveBeenCalledWith('churn');
  });
});
