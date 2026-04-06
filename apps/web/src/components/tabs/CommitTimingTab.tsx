import Badge from '../shared/Badge';
import { type Column, SortableTable } from '../shared/SortableTable';
import { fileName, filePath } from '../theme';

import type { FileTimingProfile, GitloreReport } from '@gitlore/core';

interface CommitTimingTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatHour(h: number): string {
  if (h === 0) return '12am';
  if (h < 12) return `${h}am`;
  if (h === 12) return '12pm';
  return `${h - 12}pm`;
}

export function CommitTimingTab({ report, onSelectFile }: CommitTimingTabProps) {
  const columns: Column<FileTimingProfile>[] = [
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
      key: 'lateNight',
      label: 'Late Night %',
      width: '100px',
      align: 'right',
      sortValue: (f) => f.lateNightPercent,
      render: (f) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: f.lateNightPercent > 30 ? 'var(--severity-warning)' : 'var(--text-secondary)',
          }}
        >
          {f.lateNightPercent.toFixed(0)}%
        </span>
      ),
    },
    {
      key: 'weekend',
      label: 'Weekend %',
      width: '100px',
      align: 'right',
      sortValue: (f) => f.weekendPercent,
      render: (f) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: f.weekendPercent > 30 ? 'var(--severity-warning)' : 'var(--text-secondary)',
          }}
        >
          {f.weekendPercent.toFixed(0)}%
        </span>
      ),
    },
    {
      key: 'peak',
      label: 'Peak Time',
      width: '110px',
      render: (f) => (
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          {DAYS[f.peakDay]} {formatHour(f.peakHour)}
        </span>
      ),
    },
    {
      key: 'stress',
      label: 'Stress',
      width: '80px',
      align: 'right',
      sortValue: (f) => f.stressScore,
      render: (f) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
          {f.stressScore > 50 && <Badge variant="warning">stress</Badge>}
          <span
            style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}
          >
            {f.stressScore.toFixed(0)}
          </span>
        </div>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.commitTiming.stressFiles}
      columns={columns}
      rowKey={(f) => f.file}
      onRowClick={(f) => onSelectFile(f.file)}
    />
  );
}
