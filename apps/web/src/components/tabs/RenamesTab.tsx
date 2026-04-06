import { type Column, SortableTable } from '../shared/SortableTable';
import { fileName, filePath, fmt } from '../theme';

import type { FileRenameChain, GitloreReport } from '@gitlore/core';

interface RenamesTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

export function RenamesTab({ report, onSelectFile }: RenamesTabProps) {
  const columns: Column<FileRenameChain>[] = [
    {
      key: 'file',
      label: 'Current Name',
      render: (r) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          {fileName(r.currentPath)}
          <span style={{ color: 'var(--text-tertiary)', marginLeft: 6, fontSize: 10 }}>
            {filePath(r.currentPath)}
          </span>
        </span>
      ),
    },
    {
      key: 'previous',
      label: 'Previous Names',
      width: '280px',
      render: (r) => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {r.previousNames.map((name) => (
            <span
              key={name}
              style={{
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 4,
                background: 'var(--surface-tertiary)',
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-mono)',
              }}
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
        <span
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}
        >
          {fmt(r.renameCount)}
        </span>
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
