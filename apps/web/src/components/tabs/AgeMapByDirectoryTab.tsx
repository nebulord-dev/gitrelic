import {
  aggregateAgeByDirectory,
  type AgeDirectoryRow,
} from '../../utils/ageByDirectory';
import { type Column, SortableTable } from '../shared/SortableTable';
import { fileName, filePath, fmt } from '../theme';
import type { GitrelicReport } from '@gitrelic/core';

interface AgeMapByDirectoryTabProps {
  report: GitrelicReport;
  onSelectFile: (file: string) => void;
}

export function AgeMapByDirectoryTab({
  report,
  onSelectFile,
}: AgeMapByDirectoryTabProps) {
  const rows = aggregateAgeByDirectory(report.ageMap.files);
  const staleLimit = report.ageMap.thresholds.staleLimit;
  const agingLimit = report.ageMap.thresholds.agingLimit;

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center text-text-tertiary text-xs h-full py-6">
        No directories with age data.
      </div>
    );
  }

  const medianTone = (medianAgeDays: number): string => {
    if (medianAgeDays > staleLimit) return 'text-severity-critical';
    if (medianAgeDays > agingLimit) return 'text-severity-warning';
    return 'text-text-secondary';
  };

  const columns: Column<AgeDirectoryRow>[] = [
    {
      key: 'directory',
      label: 'Directory',
      sortValue: (r) => r.directory,
      render: (r) => (
        <span className="font-mono text-text-secondary">
          {r.directory || '(root)'}
        </span>
      ),
    },
    {
      key: 'files',
      label: 'Files',
      width: '60px',
      align: 'right',
      sortValue: (r) => r.fileCount,
      render: (r) => (
        <span className="font-mono text-[11px] text-text-secondary">
          {fmt(r.fileCount)}
        </span>
      ),
    },
    {
      key: 'median',
      label: 'Median Age',
      width: '90px',
      align: 'right',
      sortValue: (r) => r.medianAgeDays,
      render: (r) => (
        <span
          className={`font-mono text-[11px] ${medianTone(r.medianAgeDays)}`}
        >
          {fmt(r.medianAgeDays)}
        </span>
      ),
    },
    {
      key: 'ancient',
      label: 'Ancient',
      width: '70px',
      align: 'right',
      sortValue: (r) => r.ancientCount,
      render: (r) => (
        <span
          className={
            r.ancientCount > 0
              ? 'font-mono text-[11px] text-severity-critical'
              : 'font-mono text-[11px] text-text-tertiary'
          }
        >
          {fmt(r.ancientCount)}
        </span>
      ),
    },
    {
      key: 'stale',
      label: 'Stale',
      width: '70px',
      align: 'right',
      sortValue: (r) => r.staleCount,
      render: (r) => (
        <span
          className={
            r.staleCount > 0
              ? 'font-mono text-[11px] text-severity-warning'
              : 'font-mono text-[11px] text-text-tertiary'
          }
        >
          {fmt(r.staleCount)}
        </span>
      ),
    },
    {
      key: 'fresh',
      label: 'Fresh',
      width: '70px',
      align: 'right',
      sortValue: (r) => r.freshCount,
      render: (r) => (
        <span className="font-mono text-[11px] text-text-secondary">
          {fmt(r.freshCount)}
        </span>
      ),
    },
    {
      key: 'oldest',
      label: 'Oldest File',
      sortValue: (r) => r.oldestFileAgeDays,
      render: (r) => (
        <span className="font-mono text-[11px]">
          {fileName(r.oldestFile)}
          <span className="text-text-tertiary ml-1.5 text-[10px]">
            {filePath(r.oldestFile)}
          </span>
        </span>
      ),
    },
  ];

  return (
    <SortableTable
      data={rows}
      columns={columns}
      rowKey={(r) => r.directory || '(root)'}
      onRowClick={(r) => onSelectFile(r.oldestFile)}
    />
  );
}
