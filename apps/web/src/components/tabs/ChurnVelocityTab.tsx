import Badge from '../shared/Badge';
import { type Column, SortableTable } from '../shared/SortableTable';
import { fileName, filePath } from '../theme';

import type { FileChurnVelocity, GitrelicReport } from '@gitrelic/core';

interface ChurnVelocityTabProps {
  report: GitrelicReport;
  onSelectFile: (file: string) => void;
}

function trendVariant(trend: string): 'critical' | 'warning' | 'healthy' {
  switch (trend) {
    case 'accelerating':
      return 'critical';
    case 'stable':
      return 'warning';
    case 'decelerating':
      return 'healthy';
    default:
      return 'warning';
  }
}

export function ChurnVelocityTab({ report, onSelectFile }: ChurnVelocityTabProps) {
  const columns: Column<FileChurnVelocity>[] = [
    {
      key: 'file',
      label: 'File',
      render: (f) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          {fileName(f.file)}
          <span style={{ color: 'var(--text-tertiary)', marginLeft: 6, fontSize: 10 }}>
            {filePath(f.file)}
          </span>
        </span>
      ),
    },
    {
      key: 'trend',
      label: 'Trend',
      width: '110px',
      render: (f) => <Badge variant={trendVariant(f.trend)}>{f.trend}</Badge>,
    },
    {
      key: 'velocity',
      label: 'Velocity',
      width: '80px',
      align: 'right',
      sortValue: (f) => f.velocityScore,
      render: (f) => (
        <span
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}
        >
          {f.velocityScore}
        </span>
      ),
    },
    {
      key: 'recent',
      label: 'Recent',
      width: '70px',
      align: 'right',
      sortValue: (f) => f.recentCommits,
      render: (f) => (
        <span
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}
        >
          {f.recentCommits}
        </span>
      ),
    },
    {
      key: 'older',
      label: 'Older',
      width: '70px',
      align: 'right',
      sortValue: (f) => f.olderCommits,
      render: (f) => (
        <span
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}
        >
          {f.olderCommits}
        </span>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.churnVelocity.files}
      columns={columns}
      rowKey={(f) => f.file}
      onRowClick={(f) => onSelectFile(f.file)}
    />
  );
}
