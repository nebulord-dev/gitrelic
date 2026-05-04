import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GhostFilesTab } from './GhostFilesTab';
import type { Contributor, GhostFile, GitrelicReport } from '@gitrelic/core';

function makeFile(
  file: string,
  dominantAuthor: string,
  authorInactiveDays: number,
  loc = 100,
): GhostFile {
  return {
    file,
    dominantAuthor,
    dominantAuthorPercent: 90,
    lastAuthorCommitDate: '2024-01-01',
    authorInactiveDays,
    loc,
  };
}

function makeContrib(email: string, name: string): Contributor {
  return {
    email,
    name,
    commitCount: 1,
    firstCommit: '',
    lastCommit: '',
    filesOwned: 0,
    linesChanged: 0,
    activeDays: 0,
    focusAreas: [],
    isActive: false,
    isGhost: true,
  };
}

function makeReport(
  overrides: {
    files?: GhostFile[];
    ghostOwners?: number;
    totalGhostFiles?: number;
    ghostLoc?: number;
    tierMix?: { trueGhost: number; fading: number };
    contributors?: Contributor[];
  } = {},
): GitrelicReport {
  const files = overrides.files ?? [];
  return {
    ghostFiles: {
      files,
      totalGhostFiles: overrides.totalGhostFiles ?? files.length,
      ghostOwners:
        overrides.ghostOwners ??
        new Set(files.map((f) => f.dominantAuthor)).size,
      ghostLoc: overrides.ghostLoc ?? files.reduce((s, f) => s + f.loc, 0),
      tierMix: overrides.tierMix ?? { trueGhost: 0, fading: 0 },
      summary: '',
    },
    contributors: {
      contributors: overrides.contributors ?? [],
    },
  } as unknown as GitrelicReport;
}

describe('GhostFilesTab', () => {
  afterEach(() => cleanup());

  it('renders the ghost-owner count as the big number', () => {
    render(
      <GhostFilesTab
        report={makeReport({
          files: [
            makeFile('a.ts', 'g1@x.com', 200),
            makeFile('b.ts', 'g2@x.com', 200),
          ],
          contributors: [
            makeContrib('g1@x.com', 'G1'),
            makeContrib('g2@x.com', 'G2'),
          ],
        })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByTestId('narrative-kpi-big-number').textContent).toBe(
      '2',
    );
  });

  it('renders Healthy tier badge at 0 owners', () => {
    render(
      <GhostFilesTab
        report={makeReport({ ghostOwners: 0 })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText('Healthy')).toBeTruthy();
  });

  it('renders Moderate tier badge at 1..2 owners', () => {
    render(
      <GhostFilesTab
        report={makeReport({ ghostOwners: 2 })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText('Moderate')).toBeTruthy();
  });

  it('renders High Risk tier badge at 3+ owners', () => {
    render(
      <GhostFilesTab
        report={makeReport({ ghostOwners: 3 })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText('High Risk')).toBeTruthy();
  });

  it('renders top-3 ghost owner display names (not emails)', () => {
    render(
      <GhostFilesTab
        report={makeReport({
          files: [
            makeFile('a.ts', 'sebastian@calyptus.eu', 200),
            makeFile('b.ts', 'sebastian@calyptus.eu', 200),
            makeFile('c.ts', 'jkassens@meta.com', 200),
          ],
          contributors: [
            makeContrib('sebastian@calyptus.eu', 'Sebastian Markbåge'),
            makeContrib('jkassens@meta.com', 'Jan Kassens'),
          ],
        })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText(/Sebastian Markbåge/)).toBeTruthy();
    expect(screen.getByText(/Jan Kassens/)).toBeTruthy();
    expect(screen.queryByText('sebastian@calyptus.eu')).toBeNull();
  });

  it('renders subline with ghost-files / tier-mix / ghost-LOC counts', () => {
    render(
      <GhostFilesTab
        report={makeReport({
          totalGhostFiles: 25,
          tierMix: { trueGhost: 2, fading: 23 },
          ghostLoc: 4_500,
        })}
        onApplyPreset={vi.fn()}
      />,
    );
    const subline = screen.getByText(/ghost files/).closest('div')!;
    expect(subline.textContent).toContain('25');
    expect(subline.textContent).toContain('true ghost');
    expect(subline.textContent).toContain('fading');
    expect(subline.textContent).toContain('dormant');
  });

  it('fires onApplyPreset with bus-factor when first see-also link clicks', () => {
    const onApplyPreset = vi.fn();
    render(
      <GhostFilesTab
        report={makeReport({ ghostOwners: 0 })}
        onApplyPreset={onApplyPreset}
      />,
    );
    fireEvent.click(screen.getByText('Bus Factor'));
    expect(onApplyPreset).toHaveBeenCalledWith('bus-factor');
  });

  it('fires onApplyPreset with knowledge-silos when second see-also link clicks', () => {
    const onApplyPreset = vi.fn();
    render(
      <GhostFilesTab
        report={makeReport({ ghostOwners: 0 })}
        onApplyPreset={onApplyPreset}
      />,
    );
    fireEvent.click(screen.getByText('Knowledge Silos'));
    expect(onApplyPreset).toHaveBeenCalledWith('knowledge-silos');
  });

  it('renders directory rollup in extras slot when files exist', () => {
    render(
      <GhostFilesTab
        report={makeReport({
          files: [
            makeFile('src/auth/login.ts', 'g@x', 200),
            makeFile('src/auth/session.ts', 'g@x', 200),
            makeFile('docs/api.md', 'g@x', 200),
          ],
          contributors: [makeContrib('g@x', 'Ghost')],
        })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText(/Where they live/i)).toBeTruthy();
    expect(screen.getByText('src/auth')).toBeTruthy();
    expect(screen.getByText('docs')).toBeTruthy();
  });
});
