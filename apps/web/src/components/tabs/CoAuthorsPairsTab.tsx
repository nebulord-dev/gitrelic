import { useMemo } from 'react';

import Badge from '../shared/Badge';
import { type Column, SortableTable } from '../shared/SortableTable';
import { fmt } from '../theme';
import type { PresetId } from '../../presets/types';
import type { CoAuthorPair, Contributor, GitrelicReport } from '@gitrelic/core';

interface CoAuthorsPairsTabProps {
  report: GitrelicReport;
  onApplyPreset: (id: PresetId) => void;
}

interface PairRow {
  pair: CoAuthorPair;
  displayA: string;
  displayB: string;
}

function resolveDisplayName(
  email: string,
  contributors: Contributor[],
): string {
  const match = contributors.find(
    (c) => c.email.toLowerCase() === email.toLowerCase(),
  );
  return match && match.name ? match.name : email;
}

export function CoAuthorsPairsTab({
  report,
  onApplyPreset,
}: CoAuthorsPairsTabProps) {
  const ca = report.coAuthors;
  const contributors = report.contributors.contributors;

  const rows = useMemo<PairRow[]>(
    () =>
      [...ca.pairs]
        .sort((a, b) => b.coAuthoredCommits - a.coAuthoredCommits)
        .map((p) => ({
          pair: p,
          displayA: resolveDisplayName(p.authorA, contributors),
          displayB: resolveDisplayName(p.authorB, contributors),
        })),
    [ca.pairs, contributors],
  );

  const columns: Column<PairRow>[] = [
    {
      key: 'pair',
      label: 'Pair',
      render: ({ displayA, displayB }) => (
        <span className="text-[11px] text-text-primary">
          <span className="truncate">{displayA}</span>
          <span className="text-text-tertiary mx-1.5">↔</span>
          <span className="truncate">{displayB}</span>
        </span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      width: '70px',
      render: ({ pair }) =>
        pair.classification === 'human-ai' ? (
          <Badge variant="coupling">AI</Badge>
        ) : (
          <Badge variant="stale">Human</Badge>
        ),
    },
    {
      key: 'commits',
      label: 'Co-Commits',
      width: '110px',
      align: 'right',
      sortValue: ({ pair }) => pair.coAuthoredCommits,
      render: ({ pair }) => (
        <span className="font-mono text-[11px] text-text-primary font-semibold">
          {fmt(pair.coAuthoredCommits)}
        </span>
      ),
    },
    {
      key: 'files',
      label: 'Shared Files',
      width: '110px',
      align: 'right',
      sortValue: ({ pair }) => pair.files.length,
      render: ({ pair }) => (
        <span className="font-mono text-[11px] text-text-secondary">
          {fmt(pair.files.length)}
        </span>
      ),
    },
  ];

  if (rows.length === 0) {
    return (
      <div className="flex flex-col min-h-full">
        <div className="flex-1 py-6 px-3 text-[11px] text-text-tertiary text-center">
          No co-authored commits in this analysis window.
        </div>
        {ca.filteredBotCommits > 0 && (
          <div className="sticky bottom-0 mt-auto bg-surface-primary border-t border-border-primary py-1.5 px-3 text-[10px] text-text-tertiary">
            <span className="font-mono">{ca.filteredBotCommits}</span>{' '}
            bot-authored commits filtered (semantic-release, dependabot, etc.)
          </div>
        )}
        <div className="sticky bottom-0 mt-auto bg-surface-primary border-t border-border-primary py-1.5 px-1 text-[10px] text-text-tertiary flex gap-2 items-center">
          See also:{' '}
          <button
            type="button"
            onClick={() => onApplyPreset('contributors')}
            className="bg-transparent border-none text-accent-primary text-[10px] cursor-pointer p-0 underline"
          >
            Contributors
          </button>
          ·
          <button
            type="button"
            onClick={() => onApplyPreset('parallel-dev')}
            className="bg-transparent border-none text-accent-primary text-[10px] cursor-pointer p-0 underline"
          >
            Parallel Dev
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1">
        <SortableTable
          data={rows}
          columns={columns}
          rowKey={(r) => `${r.pair.authorA}|${r.pair.authorB}`}
        />
      </div>
      {ca.filteredBotCommits > 0 && (
        <div className="bg-surface-primary border-t border-border-primary py-1.5 px-3 text-[10px] text-text-tertiary">
          <span className="font-mono">{ca.filteredBotCommits}</span>{' '}
          bot-authored commits filtered (semantic-release, dependabot, etc.)
        </div>
      )}
      <div className="sticky bottom-0 mt-auto bg-surface-primary border-t border-border-primary py-1.5 px-1 text-[10px] text-text-tertiary flex gap-2 items-center">
        See also:{' '}
        <button
          type="button"
          onClick={() => onApplyPreset('contributors')}
          className="bg-transparent border-none text-accent-primary text-[10px] cursor-pointer p-0 underline"
        >
          Contributors
        </button>
        ·
        <button
          type="button"
          onClick={() => onApplyPreset('parallel-dev')}
          className="bg-transparent border-none text-accent-primary text-[10px] cursor-pointer p-0 underline"
        >
          Parallel Dev
        </button>
      </div>
    </div>
  );
}
