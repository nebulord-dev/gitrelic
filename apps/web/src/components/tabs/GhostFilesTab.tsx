import Badge from '../shared/Badge';
import { type Column, SortableTable } from '../shared/SortableTable';
import { fileName, filePath, fmt } from '../theme';
import type { GhostFile, GitrelicReport } from '@gitrelic/core';

interface GhostFilesTabProps {
  report: GitrelicReport;
  onSelectFile: (file: string) => void;
}

export function GhostFilesTab({ report, onSelectFile }: GhostFilesTabProps) {
  const columns: Column<GhostFile>[] = [
    {
      key: 'file',
      label: 'File',
      render: (f) => (
        <span className="font-mono text-[11px]">
          {fileName(f.file)}
          <span className="text-text-tertiary ml-1.5 text-[10px]">
            {filePath(f.file)}
          </span>
        </span>
      ),
    },
    {
      key: 'owner',
      label: 'Owner',
      width: '140px',
      render: (f) => (
        <span className="text-[11px] text-text-secondary">
          {f.dominantAuthor.split(' <')[0]}
        </span>
      ),
    },
    {
      key: 'ownership',
      label: 'Ownership',
      width: '90px',
      align: 'right',
      sortValue: (f) => f.dominantAuthorPercent,
      render: (f) => (
        <span className="font-mono text-[11px] text-accent-ownership">
          {f.dominantAuthorPercent}%
        </span>
      ),
    },
    {
      key: 'inactive',
      label: 'Days Inactive',
      width: '110px',
      align: 'right',
      sortValue: (f) => f.authorInactiveDays,
      render: (f) => (
        <div className="flex items-center gap-1.5 justify-end">
          <Badge variant={f.authorInactiveDays > 180 ? 'critical' : 'warning'}>
            {f.authorInactiveDays > 365 ? 'ghost' : 'fading'}
          </Badge>
          <span className="font-mono text-[11px] text-text-secondary">
            {fmt(f.authorInactiveDays)}d
          </span>
        </div>
      ),
    },
    {
      key: 'loc',
      label: 'LOC',
      width: '60px',
      align: 'right',
      sortValue: (f) => f.loc,
      render: (f) => (
        <span className="font-mono text-[11px] text-text-secondary">
          {fmt(f.loc)}
        </span>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.ghostFiles.files}
      columns={columns}
      rowKey={(f) => f.file}
      onRowClick={(f) => onSelectFile(f.file)}
    />
  );
}
