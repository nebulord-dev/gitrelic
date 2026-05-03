import { type Column, SortableTable } from '../shared/SortableTable';
import { fileName } from '../theme';

import type { CoupledPair, GitrelicReport } from '@gitrelic/core';

interface CouplingTabProps {
  report: GitrelicReport;
  onSelectFile: (file: string) => void;
}

export function CouplingTab({ report, onSelectFile }: CouplingTabProps) {
  const columns: Column<CoupledPair>[] = [
    {
      key: 'fileA',
      label: 'File A',
      render: (p) => (
        <span
          className="font-mono text-[11px] text-text-primary cursor-pointer"
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
      render: () => <span className="text-text-tertiary text-[10px]">↔</span>,
    },
    {
      key: 'fileB',
      label: 'File B',
      render: (p) => (
        <span
          className="font-mono text-[11px] text-text-primary cursor-pointer"
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
        <div className="flex items-center gap-2 justify-end">
          <div className="w-[50px] h-1 bg-surface-tertiary rounded-xs overflow-hidden">
            <div
              className="h-full rounded-xs bg-accent-coupling"
              style={{ width: `${p.couplingStrength}%` }}
            />
          </div>
          <span className="font-mono text-[11px] text-accent-coupling font-semibold">
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
        <span className="font-mono text-[11px] text-text-secondary">
          {p.coCommits}
        </span>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.coupling.pairs}
      columns={columns}
      rowKey={(p) => `${p.fileA}::${p.fileB}`}
    />
  );
}
