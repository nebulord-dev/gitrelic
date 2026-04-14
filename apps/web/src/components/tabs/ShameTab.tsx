import Badge from '../shared/Badge';
import { type Column, SortableTable } from '../shared/SortableTable';
import { fileName, filePath } from '../theme';

import type { FileForensics, GitrelicReport } from '@gitrelic/core';

interface ShameTabProps {
  report: GitrelicReport;
  onSelectFile: (file: string) => void;
}

export function ShameTab({ report, onSelectFile }: ShameTabProps) {
  const columns: Column<FileForensics>[] = [
    {
      key: 'file',
      label: 'File',
      render: (f) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          {fileName(f.file)}
          <span
            style={{
              color: 'var(--text-tertiary)',
              marginLeft: 6,
              fontSize: 10,
            }}
          >
            {filePath(f.file)}
          </span>
        </span>
      ),
    },
    {
      key: 'keywords',
      label: 'Keywords',
      width: '200px',
      render: (f) => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {f.dominantKeywords.slice(0, 3).map((k) => (
            <Badge key={k} variant="shame">
              {k}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'score',
      label: 'Shame Score',
      width: '80px',
      align: 'right',
      sortValue: (f) => f.shameScore,
      render: (f) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--severity-critical)',
            fontWeight: 600,
          }}
        >
          {f.shameScore}
        </span>
      ),
    },
    {
      key: 'commits',
      label: 'Shame Commits',
      width: '100px',
      align: 'right',
      sortValue: (f) => f.shameCommitCount,
      render: (f) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-secondary)',
          }}
        >
          {f.shameCommitCount}
        </span>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.forensics.shameLeaderboard}
      columns={columns}
      rowKey={(f) => f.file}
      onRowClick={(f) => onSelectFile(f.file)}
    />
  );
}
