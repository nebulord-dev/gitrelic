import { type Column, SortableTable } from '../shared/SortableTable';
import { fileName } from '../theme';

import type { CoupledPair, GitloreReport } from '@gitlore/core';

interface CouplingTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

export function CouplingTab({ report, onSelectFile }: CouplingTabProps) {
  const columns: Column<CoupledPair>[] = [
    {
      key: 'fileA',
      label: 'File A',
      render: (p) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
          onClick={(e) => {
            e.stopPropagation();
            onSelectFile(p.fileA);
          }}
        >
          {fileName(p.fileA)}
        </span>
      ),
    },
    {
      key: 'arrow',
      label: '',
      width: '30px',
      align: 'center',
      render: () => <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>↔</span>,
    },
    {
      key: 'fileB',
      label: 'File B',
      render: (p) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
          onClick={(e) => {
            e.stopPropagation();
            onSelectFile(p.fileB);
          }}
        >
          {fileName(p.fileB)}
        </span>
      ),
    },
    {
      key: 'strength',
      label: 'Strength',
      width: '120px',
      align: 'right',
      sortValue: (p) => p.couplingStrength,
      render: (p) => (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            justifyContent: 'flex-end',
          }}
        >
          <div
            style={{
              width: 50,
              height: 4,
              background: 'var(--surface-tertiary)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${p.couplingStrength}%`,
                height: '100%',
                borderRadius: 2,
                background: 'var(--accent-coupling)',
              }}
            />
          </div>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--accent-coupling)',
              fontWeight: 600,
            }}
          >
            {Math.round(p.couplingStrength)}%
          </span>
        </div>
      ),
    },
    {
      key: 'coCommits',
      label: 'Shared',
      width: '60px',
      align: 'right',
      sortValue: (p) => p.coCommits,
      render: (p) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-secondary)',
          }}
        >
          {p.coCommits}
        </span>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.coupling.topPairs}
      columns={columns}
      rowKey={(p) => `${p.fileA}::${p.fileB}`}
    />
  );
}
