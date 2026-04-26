import { useMemo } from 'react';

import { sortCriticalByImpact } from '../../utils/sortBusFactor';
import Badge from '../shared/Badge';
import { type Column, SortableTable } from '../shared/SortableTable';
import { Tooltip } from '../shared/Tooltip';
import { fileName, filePath } from '../theme';

import type { FileBusFactor, GitrelicReport } from '@gitrelic/core';

interface BusFactorTabProps {
  report: GitrelicReport;
  onSelectFile: (file: string) => void;
}

export function BusFactorTab({ report, onSelectFile }: BusFactorTabProps) {
  const sortedCritical = useMemo(() => sortCriticalByImpact(report), [report]);

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
      width: '260px',
      render: (f) => (
        <span
          title={`${f.dominantAuthor} (${f.dominantAuthorPercent}%)`}
          style={{
            fontSize: 11,
            color: 'var(--text-secondary)',
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {f.dominantAuthor} ({f.dominantAuthorPercent}%)
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
                <span key={a}>{a}</span>
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
      data={sortedCritical}
      columns={columns}
      rowKey={(f) => f.file}
      onRowClick={(f) => onSelectFile(f.file)}
    />
  );
}
