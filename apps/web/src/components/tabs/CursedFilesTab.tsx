import Badge from '../shared/Badge';
import { type Column, SortableTable } from '../shared/SortableTable';
import { Tooltip } from '../shared/Tooltip';
import { fileName, filePath, fmt } from '../theme';

import type { CursedFile, GitrelicReport } from '@gitrelic/core';

interface CursedFilesTabProps {
  report: GitrelicReport;
  onSelectFile: (file: string) => void;
}

function reasonVariant(
  reason: string,
): 'critical' | 'warning' | 'ownership' | 'coupling' | 'parallel' {
  if (reason.includes('revert') || reason.includes('shame') || reason.includes('break'))
    return 'critical';
  if (reason.includes('author') || reason.includes('owner')) return 'ownership';
  if (reason.includes('coupling') || reason.includes('coordination')) return 'coupling';
  if (reason.includes('parallel')) return 'parallel';
  return 'warning';
}

function getAuthors(file: string, report: GitrelicReport): string[] | undefined {
  const bf = report.busFactors.files.find((f) => f.file === file);
  return bf ? bf.authors : undefined;
}

export function CursedFilesTab({ report, onSelectFile }: CursedFilesTabProps) {
  const columns: Column<CursedFile>[] = [
    {
      key: 'file',
      label: 'File',
      render: (c) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--severity-critical)',
          }}
        >
          {fileName(c.file)}
          <span
            style={{
              color: 'var(--text-tertiary)',
              marginLeft: 6,
              fontSize: 10,
            }}
          >
            {filePath(c.file)}
          </span>
        </span>
      ),
    },
    {
      key: 'reasons',
      label: 'Reasons',
      width: '300px',
      render: (c) => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {c.reasons.slice(0, 4).map((r) => (
            <Badge key={r} variant={reasonVariant(r)}>
              {r}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'score',
      label: 'Curse Score',
      width: '80px',
      align: 'right',
      sortValue: (c) => c.curseScore,
      render: (c) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--severity-critical)',
            fontWeight: 600,
          }}
        >
          {c.curseScore}
        </span>
      ),
    },
    {
      key: 'churn',
      label: 'Churn',
      width: '60px',
      align: 'right',
      sortValue: (c) => c.churn,
      render: (c) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-secondary)',
          }}
        >
          {fmt(c.churn)}
        </span>
      ),
    },
    {
      key: 'authors',
      label: 'Authors',
      width: '60px',
      align: 'right',
      sortValue: (c) => c.authors,
      render: (c) => {
        const authors = getAuthors(c.file, report);
        const span = (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-secondary)',
            }}
          >
            {c.authors}
          </span>
        );
        if (!authors) return span;
        return (
          <Tooltip
            content={
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {authors.map((a) => (
                  <span key={a}>{a.split('@')[0]}</span>
                ))}
              </div>
            }
          >
            {span}
          </Tooltip>
        );
      },
    },
  ];

  return (
    <SortableTable
      data={report.cursedFiles}
      columns={columns}
      rowKey={(c) => c.file}
      onRowClick={(c) => onSelectFile(c.file)}
    />
  );
}
