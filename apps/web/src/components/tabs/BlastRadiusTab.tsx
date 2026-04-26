import { type Column, SortableTable } from '../shared/SortableTable';
import { fileName, filePath, fmt } from '../theme';

import type { FileBlastRadius, GitrelicReport } from '@gitrelic/core';

interface BlastRadiusTabProps {
  report: GitrelicReport;
  onSelectFile: (file: string) => void;
}

export function BlastRadiusTab({ report, onSelectFile }: BlastRadiusTabProps) {
  const columns: Column<FileBlastRadius>[] = [
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
      key: 'score',
      label: 'Score',
      width: '100px',
      align: 'right',
      sortValue: (f) => f.blastScore,
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
                width: `${f.blastScore}%`,
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
              width: 24,
              textAlign: 'right',
            }}
          >
            {f.blastScore}
          </span>
        </div>
      ),
    },
    {
      key: 'avg',
      label: 'Avg Co-change',
      width: '110px',
      align: 'right',
      sortValue: (f) => f.avgCoChangedFiles,
      render: (f) => (
        <span
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}
        >
          {f.avgCoChangedFiles.toFixed(1)} files
        </span>
      ),
    },
    {
      key: 'peak',
      label: 'Peak',
      width: '70px',
      align: 'right',
      sortValue: (f) => f.maxCoChangedFiles,
      render: (f) => (
        <span
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}
        >
          {fmt(f.maxCoChangedFiles)}
        </span>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.blastRadius.files}
      columns={columns}
      rowKey={(f) => f.file}
      onRowClick={(f) => onSelectFile(f.file)}
    />
  );
}
