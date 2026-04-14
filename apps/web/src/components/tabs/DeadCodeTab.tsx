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
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          {fileName(d.file)}
          <span style={{ color: 'var(--text-tertiary)', marginLeft: 6, fontSize: 10 }}>
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
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{d.language}</span>
      ),
    },
    {
      key: 'loc',
      label: 'LOC',
      width: '70px',
      align: 'right',
      sortValue: (d) => d.loc,
      render: (d) => (
        <span
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}
        >
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
          <Badge variant={d.ageInDays > 365 ? 'critical' : d.ageInDays > 180 ? 'warning' : 'stale'}>
            {d.ageInDays > 365 ? 'ancient' : d.ageInDays > 180 ? 'stale' : 'dormant'}
          </Badge>
          <span
            style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}
          >
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
