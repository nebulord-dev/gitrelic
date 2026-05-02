import { type Column, SortableTable } from '../shared/SortableTable';
import { fileName, filePath, fmt } from '../theme';

import type { FileRenameChain, GitrelicReport } from '@gitrelic/core';

interface RenamesTabProps {
  report: GitrelicReport;
  onSelectFile: (file: string) => void;
}

export function RenamesTab({ report, onSelectFile }: RenamesTabProps) {
  const columns: Column<FileRenameChain>[] = [
    {
      key: 'file',
      label: 'Current Name',
      render: (r) => (
        <span className="font-mono text-[11px]">
          {fileName(r.currentPath)}
          <span className="text-text-tertiary ml-1.5 text-[10px]">{filePath(r.currentPath)}</span>
        </span>
      ),
    },
    {
      key: 'previous',
      label: 'Previous Names',
      width: '280px',
      render: (r) => (
        <div className="flex gap-1 flex-wrap">
          {r.previousNames.map((name) => (
            <span
              key={name}
              className="text-[10px] py-px px-1.5 rounded bg-surface-tertiary text-text-tertiary font-mono"
            >
              {fileName(name)}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'count',
      label: 'Renames',
      width: '80px',
      align: 'right',
      sortValue: (r) => r.renameCount,
      render: (r) => (
        <span className="font-mono text-[11px] text-text-secondary">{fmt(r.renameCount)}</span>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.renameTracking.chains}
      columns={columns}
      rowKey={(r) => r.currentPath}
      onRowClick={(r) => onSelectFile(r.currentPath)}
    />
  );
}
