import Badge from '../shared/Badge';
import { type Column, SortableTable } from '../shared/SortableTable';
import { ageColor, fileName, filePath, fmt } from '../theme';

import type { FileAge, GitloreReport } from '@gitlore/core';

interface AgeMapTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

export function AgeMapTab({ report, onSelectFile }: AgeMapTabProps) {
  const columns: Column<FileAge>[] = [
    {
      key: 'status',
      label: 'Status',
      width: '70px',
      render: (f) => <Badge variant={ageColor(f.status)}>{f.status}</Badge>,
    },
    {
      key: 'file',
      label: 'File',
      render: (f) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          {fileName(f.file)}
          <span
            style={{
              color: 'var(--text-tertiary)',
              marginLeft: 6,
              fontSize: 10,
            }}
          >
            {filePath(f.file)}
          </span>
        </span>
      ),
    },
    {
      key: 'age',
      label: 'Age (days)',
      width: '80px',
      align: 'right',
      sortValue: (f) => f.ageInDays,
      render: (f) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-secondary)',
          }}
        >
          {fmt(f.ageInDays)}
        </span>
      ),
    },
    {
      key: 'date',
      label: 'Last Commit',
      width: '100px',
      align: 'right',
      render: (f) => (
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
          {f.lastCommitDate.slice(0, 10)}
        </span>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.ageMap.files}
      columns={columns}
      rowKey={(f) => f.file}
      onRowClick={(f) => onSelectFile(f.file)}
    />
  );
}
