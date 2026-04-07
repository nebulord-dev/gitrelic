import Badge from '../shared/Badge';
import { type Column, SortableTable } from '../shared/SortableTable';
import { Tooltip } from '../shared/Tooltip';
import { fileName, filePath } from '../theme';

import type { FileBusFactor, GitloreReport } from '@gitlore/core';

interface BusFactorTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

export function BusFactorTab({ report, onSelectFile }: BusFactorTabProps) {
  const columns: Column<FileBusFactor>[] = [
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
      key: 'dominant',
      label: 'Dominant Author',
      width: '180px',
      render: (f) => (
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          {f.dominantAuthor.split('@')[0]} ({f.dominantAuthorPercent}%)
        </span>
      ),
    },
    {
      key: 'authors',
      label: 'Authors',
      width: '60px',
      align: 'right',
      sortValue: (f) => f.uniqueAuthors,
      render: (f) => (
        <Tooltip
          content={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {f.authors.map((a) => (
                <span key={a}>{a.split('@')[0]}</span>
              ))}
            </div>
          }
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-secondary)',
            }}
          >
            {f.uniqueAuthors}
          </span>
        </Tooltip>
      ),
    },
    {
      key: 'risk',
      label: 'Risk',
      width: '70px',
      align: 'center',
      sortValue: (f) => f.dominantAuthorPercent,
      render: (f) => (
        <Badge
          variant={f.risk === 'critical' ? 'critical' : f.risk === 'high' ? 'warning' : 'moderate'}
        >
          {f.risk}
        </Badge>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.busFactors.criticalFiles}
      columns={columns}
      rowKey={(f) => f.file}
      onRowClick={(f) => onSelectFile(f.file)}
    />
  );
}
