import Badge from '../shared/Badge';
import { type Column, SortableTable } from '../shared/SortableTable';
import { fileName, filePath, fmt } from '../theme';

import type { DeadCodeCandidate, GitrelicReport } from '@gitrelic/core';

interface DeadCodeTabProps {
  report: GitrelicReport;
  onSelectFile: (file: string) => void;
}

export function DeadCodeTab({ report, onSelectFile }: DeadCodeTabProps) {
  const columns: Column<DeadCodeCandidate>[] = [
    {
      key: 'file',
      label: 'File',
      render: (d) => (
        <span className="font-mono text-[11px]">
          {fileName(d.file)}
          <span className="text-text-tertiary ml-1.5 text-[10px]">
            {filePath(d.file)}
          </span>
        </span>
      ),
    },
    {
      key: 'language',
      label: 'Language',
      width: '100px',
      render: (d) => (
        <span className="text-[11px] text-text-secondary">{d.language}</span>
      ),
    },
    {
      key: 'loc',
      label: 'LOC',
      width: '70px',
      align: 'right',
      sortValue: (d) => d.loc,
      render: (d) => (
        <span className="font-mono text-[11px] text-text-secondary">
          {fmt(d.loc)}
        </span>
      ),
    },
    {
      key: 'age',
      label: 'Days Untouched',
      width: '120px',
      align: 'right',
      sortValue: (d) => d.ageInDays,
      render: (d) => (
        <div className="flex items-center gap-1.5 justify-end">
          <Badge
            variant={
              d.ageInDays > 365
                ? 'critical'
                : d.ageInDays > 180
                  ? 'warning'
                  : 'stale'
            }
          >
            {d.ageInDays > 365
              ? 'ancient'
              : d.ageInDays > 180
                ? 'stale'
                : 'dormant'}
          </Badge>
          <span className="font-mono text-[11px] text-text-secondary">
            {fmt(d.ageInDays)}d
          </span>
        </div>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.deadCode.candidates}
      columns={columns}
      rowKey={(d) => d.file}
      onRowClick={(d) => onSelectFile(d.file)}
    />
  );
}
