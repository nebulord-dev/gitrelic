import Badge from '../shared/Badge';
import { type Column, SortableTable } from '../shared/SortableTable';
import { fmt } from '../theme';

import type { Contributor, GitrelicReport } from '@gitrelic/core';

interface ContributorsTabProps {
  report: GitrelicReport;
}

export function ContributorsTab({ report }: ContributorsTabProps) {
  const columns: Column<Contributor>[] = [
    {
      key: 'name',
      label: 'Contributor',
      render: (c) => (
        <div className="flex items-center gap-2">
          <div className="w-[22px] h-[22px] rounded-full bg-surface-tertiary flex items-center justify-center text-[9px] text-text-secondary shrink-0">
            {c.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-[11px] text-text-primary">{c.name}</div>
            <div className="text-[9px] text-text-tertiary">{c.email}</div>
          </div>
          {!c.isActive && <Badge variant="stale">ghost</Badge>}
        </div>
      ),
    },
    {
      key: 'commits',
      label: 'Commits',
      width: '70px',
      align: 'right',
      sortValue: (c) => c.commitCount,
      render: (c) => (
        <span className="font-mono text-[11px] text-text-primary font-semibold">
          {fmt(c.commitCount)}
        </span>
      ),
    },
    {
      key: 'files',
      label: 'Files',
      width: '60px',
      align: 'right',
      sortValue: (c) => c.filesOwned,
      render: (c) => (
        <span className="font-mono text-[11px] text-text-secondary">
          {c.filesOwned}
        </span>
      ),
    },
    {
      key: 'focus',
      label: 'Focus Areas',
      width: '200px',
      render: (c) => (
        <span className="text-[10px] text-text-tertiary">
          {c.focusAreas.slice(0, 2).join(', ')}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '50px',
      align: 'center',
      render: (c) => (
        <div
          className={
            c.isActive
              ? 'w-2 h-2 rounded-full bg-severity-healthy mx-auto'
              : 'w-2 h-2 rounded-full bg-text-tertiary mx-auto'
          }
        />
      ),
    },
  ];

  return (
    <SortableTable
      data={report.contributors.contributors}
      columns={columns}
      rowKey={(c) => c.email}
    />
  );
}
