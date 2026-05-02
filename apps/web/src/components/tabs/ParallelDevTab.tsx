import Badge from '../shared/Badge';
import { type Column, SortableTable } from '../shared/SortableTable';
import { fileName, filePath } from '../theme';

import type { FileParallelDev, GitrelicReport } from '@gitrelic/core';

interface ParallelDevTabProps {
  report: GitrelicReport;
  onSelectFile: (file: string) => void;
}

export function ParallelDevTab({ report, onSelectFile }: ParallelDevTabProps) {
  const columns: Column<FileParallelDev>[] = [
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
      key: 'score',
      label: 'Score',
      width: '80px',
      align: 'right',
      sortValue: (f) => f.parallelScore,
      render: (f) => (
        <span className="font-mono text-[11px] text-severity-warning font-semibold">
          {f.parallelScore}
        </span>
      ),
    },
    {
      key: 'weeks',
      label: 'Parallel Weeks',
      width: '100px',
      align: 'right',
      sortValue: (f) => f.parallelWeeks,
      render: (f) => (
        <span className="font-mono text-[11px] text-text-secondary">
          {f.parallelWeeks}/{f.totalActiveWeeks}
        </span>
      ),
    },
    {
      key: 'peak',
      label: 'Peak Authors',
      width: '90px',
      align: 'right',
      sortValue: (f) => f.peakAuthors,
      render: (f) => (
        <Badge
          variant="parallel"
          title={f.peakWindow.authors.map((a) => a.split('@')[0]).join(', ')}
        >
          {f.peakAuthors} authors
        </Badge>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.parallelDev.files}
      columns={columns}
      rowKey={(f) => f.file}
      onRowClick={(f) => onSelectFile(f.file)}
    />
  );
}
