import Badge from '../shared/Badge';
import { type Column, SortableTable } from '../shared/SortableTable';

import type { DirectoryCoverage, GitrelicReport } from '@gitrelic/core';

interface TestCoverageTabProps {
  report: GitrelicReport;
}

export function TestCoverageTab({ report }: TestCoverageTabProps) {
  const columns: Column<DirectoryCoverage>[] = [
    {
      key: 'directory',
      label: 'Directory',
      render: (d) => <span className="font-mono text-[11px] text-text-primary">{d.directory}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      width: '90px',
      render: (d) => (
        <Badge variant={d.hasTests ? (d.coverageRatio >= 0.5 ? 'healthy' : 'warning') : 'critical'}>
          {d.hasTests ? (d.coverageRatio >= 0.5 ? 'covered' : 'low') : 'untested'}
        </Badge>
      ),
    },
    {
      key: 'source',
      label: 'Source Files',
      width: '90px',
      align: 'right',
      sortValue: (d) => d.sourceFiles,
      render: (d) => (
        <span className="font-mono text-[11px] text-text-secondary">{d.sourceFiles}</span>
      ),
    },
    {
      key: 'test',
      label: 'Test Files',
      width: '80px',
      align: 'right',
      sortValue: (d) => d.testFiles,
      render: (d) => (
        <span className="font-mono text-[11px] text-text-secondary">{d.testFiles}</span>
      ),
    },
    {
      key: 'ratio',
      label: 'Ratio',
      width: '100px',
      align: 'right',
      sortValue: (d) => d.coverageRatio,
      render: (d) => (
        <div className="flex items-center gap-2 justify-end">
          <div className="w-[50px] h-1 bg-surface-tertiary rounded-xs overflow-hidden">
            <div
              className="h-full rounded-xs"
              style={{
                width: `${Math.min(100, d.coverageRatio * 100)}%`,
                background:
                  d.coverageRatio >= 0.5 ? 'var(--severity-healthy)' : 'var(--severity-warning)',
              }}
            />
          </div>
          <span className="font-mono text-[11px] text-text-secondary w-8 text-right">
            {(d.coverageRatio * 100).toFixed(0)}%
          </span>
        </div>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.testCoverage.directories}
      columns={columns}
      rowKey={(d) => d.directory}
    />
  );
}
