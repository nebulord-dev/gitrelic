import { type Column, SortableTable } from '../shared/SortableTable';
import { fileName, filePath, fmt } from '../theme';

import type { FileRewriteRatio, GitrelicReport } from '@gitrelic/core';

interface RewriteRatioTabProps {
  report: GitrelicReport;
  onSelectFile: (file: string) => void;
}

export function RewriteRatioTab({ report, onSelectFile }: RewriteRatioTabProps) {
  const columns: Column<FileRewriteRatio>[] = [
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
      key: 'ratio',
      label: 'Ratio',
      width: '100px',
      align: 'right',
      sortValue: (f) => f.rewriteScore,
      render: (f) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
          <div
            style={{
              width: 50,
              height: 4,
              background: 'var(--surface-tertiary)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${f.rewriteScore}%`,
                height: '100%',
                borderRadius: 2,
                background: 'var(--severity-warning)',
              }}
            />
          </div>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-secondary)',
              width: 28,
              textAlign: 'right',
            }}
          >
            {f.rewriteScore}
          </span>
        </div>
      ),
    },
    {
      key: 'insertions',
      label: 'Insertions',
      width: '90px',
      align: 'right',
      sortValue: (f) => f.totalInsertions,
      render: (f) => (
        <span
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--severity-healthy)' }}
        >
          +{fmt(f.totalInsertions)}
        </span>
      ),
    },
    {
      key: 'deletions',
      label: 'Deletions',
      width: '90px',
      align: 'right',
      sortValue: (f) => f.totalDeletions,
      render: (f) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--severity-critical)',
          }}
        >
          -{fmt(f.totalDeletions)}
        </span>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.rewriteRatio.topRewriters}
      columns={columns}
      rowKey={(f) => f.file}
      onRowClick={(f) => onSelectFile(f.file)}
    />
  );
}
