import Badge from '../shared/Badge';
import { type Column, SortableTable } from '../shared/SortableTable';
import { ageColor, fileName, filePath, fmt } from '../theme';

import type { FileAge, GitrelicReport } from '@gitrelic/core';

interface AgeMapTabProps {
  report: GitrelicReport;
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
        <span className="font-mono text-[11px]">
          {fileName(f.file)}
          <span className="text-text-tertiary ml-1.5 text-[10px]">{filePath(f.file)}</span>
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
        <span className="font-mono text-[11px] text-text-secondary">{fmt(f.ageInDays)}</span>
      ),
    },
    {
      key: 'date',
      label: 'Last Commit',
      width: '100px',
      align: 'right',
      render: (f) => (
        <span className="text-[10px] text-text-tertiary">{f.lastCommitDate.slice(0, 10)}</span>
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
