import { type Column, SortableTable } from '../shared/SortableTable';
import { fmt } from '../theme';

import type { CoAuthorPair, GitrelicReport } from '@gitrelic/core';

interface CoAuthorsTabProps {
  report: GitrelicReport;
}

export function CoAuthorsTab({ report }: CoAuthorsTabProps) {
  const columns: Column<CoAuthorPair>[] = [
    {
      key: 'pair',
      label: 'Pair',
      render: (p) => (
        <span style={{ fontSize: 11, color: 'var(--text-primary)' }}>
          {p.authorA.split(' <')[0]}
          <span style={{ color: 'var(--text-tertiary)', margin: '0 6px' }}>&amp;</span>
          {p.authorB.split(' <')[0]}
        </span>
      ),
    },
    {
      key: 'commits',
      label: 'Co-commits',
      width: '100px',
      align: 'right',
      sortValue: (p) => p.coAuthoredCommits,
      render: (p) => (
        <span
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}
        >
          {fmt(p.coAuthoredCommits)}
        </span>
      ),
    },
    {
      key: 'files',
      label: 'Shared Files',
      width: '100px',
      align: 'right',
      sortValue: (p) => p.files.length,
      render: (p) => (
        <span
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}
        >
          {p.files.length}
        </span>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.coAuthors.pairs}
      columns={columns}
      rowKey={(p) => `${p.authorA}|${p.authorB}`}
    />
  );
}
