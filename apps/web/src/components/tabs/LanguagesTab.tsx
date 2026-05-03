import { type Column, SortableTable } from '../shared/SortableTable';
import { fmt } from '../theme';

import type { GitrelicReport, LanguageBreakdown } from '@gitrelic/core';

interface LanguagesTabProps {
  report: GitrelicReport;
}

export function LanguagesTab({ report }: LanguagesTabProps) {
  const columns: Column<LanguageBreakdown>[] = [
    {
      key: 'language',
      label: 'Language',
      render: (l) => (
        <span className="text-[11px] text-text-primary font-medium">
          {l.language}
        </span>
      ),
    },
    {
      key: 'percentage',
      label: '% of Codebase',
      width: '160px',
      sortValue: (l) => l.percentage,
      render: (l) => (
        <div className="flex items-center gap-2">
          <div className="w-20 h-1 bg-surface-tertiary rounded-xs overflow-hidden">
            <div
              className="h-full rounded-xs bg-accent-primary"
              style={{ width: `${l.percentage}%` }}
            />
          </div>
          <span className="font-mono text-[11px] text-text-secondary w-10">
            {l.percentage.toFixed(1)}%
          </span>
        </div>
      ),
    },
    {
      key: 'files',
      label: 'Files',
      width: '70px',
      align: 'right',
      sortValue: (l) => l.files,
      render: (l) => (
        <span className="font-mono text-[11px] text-text-secondary">
          {fmt(l.files)}
        </span>
      ),
    },
    {
      key: 'lines',
      label: 'Lines',
      width: '80px',
      align: 'right',
      sortValue: (l) => l.lines,
      render: (l) => (
        <span className="font-mono text-[11px] text-text-secondary">
          {fmt(l.lines)}
        </span>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.loc.languages}
      columns={columns}
      rowKey={(l) => l.language}
    />
  );
}
