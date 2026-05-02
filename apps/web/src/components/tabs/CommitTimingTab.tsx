import Badge from '../shared/Badge';
import { type Column, SortableTable } from '../shared/SortableTable';
import { fileName, filePath } from '../theme';

import type { FileTimingProfile, GitrelicReport } from '@gitrelic/core';

interface CommitTimingTabProps {
  report: GitrelicReport;
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
        <span className="font-mono text-[11px]">
          {fileName(f.file)}
          <span className="text-text-tertiary ml-1.5 text-[10px]">{filePath(f.file)}</span>
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
          className={
            f.lateNightPercent > 30
              ? 'font-mono text-[11px] text-severity-warning'
              : 'font-mono text-[11px] text-text-secondary'
          }
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
          className={
            f.weekendPercent > 30
              ? 'font-mono text-[11px] text-severity-warning'
              : 'font-mono text-[11px] text-text-secondary'
          }
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
        <span className="text-[11px] text-text-secondary">
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
        <div className="flex items-center gap-1.5 justify-end">
          {f.stressScore > 50 && <Badge variant="warning">stress</Badge>}
          <span className="font-mono text-[11px] text-text-secondary">
            {f.stressScore.toFixed(0)}
          </span>
        </div>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.commitTiming.files}
      columns={columns}
      rowKey={(f) => f.file}
      onRowClick={(f) => onSelectFile(f.file)}
    />
  );
}
