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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'var(--surface-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 9,
              color: 'var(--text-secondary)',
              flexShrink: 0,
            }}
          >
            {c.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-primary)' }}>{c.name}</div>
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{c.email}</div>
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
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-primary)',
            fontWeight: 600,
          }}
        >
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
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-secondary)',
          }}
        >
          {c.filesOwned}
        </span>
      ),
    },
    {
      key: 'focus',
      label: 'Focus Areas',
      width: '200px',
      render: (c) => (
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
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
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: c.isActive ? 'var(--severity-healthy)' : 'var(--text-tertiary)',
            margin: '0 auto',
          }}
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
