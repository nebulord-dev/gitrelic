import { cn } from '../../utils/cn';
import Badge from '../shared/Badge';
import { type Column, SortableTable } from '../shared/SortableTable';
import { fileName, filePath, fmt } from '../theme';

import type { FileComplexityTrend, GitrelicReport } from '@gitrelic/core';

interface ComplexityTrendTabProps {
  report: GitrelicReport;
  onSelectFile: (file: string) => void;
}

function trendVariant(trend: string): 'critical' | 'warning' | 'healthy' | 'stale' {
  switch (trend) {
    case 'growing':
      return 'critical';
    case 'stable':
      return 'healthy';
    case 'shrinking':
      return 'healthy';
    default:
      return 'stale';
  }
}

export function ComplexityTrendTab({ report, onSelectFile }: ComplexityTrendTabProps) {
  const columns: Column<FileComplexityTrend>[] = [
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
      key: 'trend',
      label: 'Trend',
      width: '100px',
      render: (f) => <Badge variant={trendVariant(f.trend)}>{f.trend}</Badge>,
    },
    {
      key: 'growthRate',
      label: 'Growth Rate',
      width: '100px',
      align: 'right',
      sortValue: (f) => f.recentGrowthRate,
      render: (f) => (
        <span
          className={cn(
            'font-mono text-[11px]',
            f.recentGrowthRate > 0 ? 'text-severity-critical' : 'text-severity-healthy',
          )}
        >
          {f.recentGrowthRate > 0 ? '+' : ''}
          {f.recentGrowthRate.toFixed(1)}%
        </span>
      ),
    },
    {
      key: 'netLines',
      label: 'Net Lines',
      width: '90px',
      align: 'right',
      sortValue: (f) => f.totalNetLines,
      render: (f) => (
        <span
          className={cn(
            'font-mono text-[11px]',
            f.totalNetLines > 0 ? 'text-severity-warning' : 'text-text-secondary',
          )}
        >
          {f.totalNetLines > 0 ? '+' : ''}
          {fmt(f.totalNetLines)}
        </span>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.complexityTrend.files}
      columns={columns}
      rowKey={(f) => f.file}
      onRowClick={(f) => onSelectFile(f.file)}
    />
  );
}
