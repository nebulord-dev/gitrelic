import { useMemo } from 'react';

import {
  aggregateChurnByDirectory,
  type DirectoryChurnRow,
} from '../../utils/churnByDirectory';
import { isTestPath } from '../../utils/isTestPath';
import { type Column, SortableTable } from '../shared/SortableTable';
import { fmt } from '../theme';

import type { PresetId } from '../../presets/types';
import type { GitrelicReport } from '@gitrelic/core';

export type ChurnTabMode = 'source' | 'tests';

interface ChurnTabProps {
  report: GitrelicReport;
  onApplyPreset: (id: PresetId) => void;
  mode: ChurnTabMode;
}

function formatShare(share: number): string {
  return `${(share * 100).toFixed(1)}%`;
}

function emptyStateCopy(mode: ChurnTabMode): string {
  return mode === 'tests'
    ? 'No test files detected in the analysis window. Looking for __tests__/, __snapshots__/, __fixtures__/, tests/, cypress/ paths and .test./.spec. basenames.'
    : 'No source files detected in the analysis window.';
}

export function ChurnTab({ report, onApplyPreset, mode }: ChurnTabProps) {
  const rows = useMemo(() => {
    const files = report.churn?.files ?? [];
    const filtered = files.filter((f) =>
      mode === 'tests' ? isTestPath(f.file) : !isTestPath(f.file),
    );
    return aggregateChurnByDirectory(filtered);
  }, [report.churn?.files, mode]);

  const columns: Column<DirectoryChurnRow>[] = [
    {
      key: 'directory',
      label: 'Directory',
      render: (r) => (
        <span className="font-mono text-[11px]">
          {r.directory === '' ? (
            <span className="text-text-tertiary">(root)</span>
          ) : (
            r.directory
          )}
        </span>
      ),
    },
    {
      key: 'commits',
      label: 'Commits',
      width: '90px',
      align: 'right',
      sortValue: (r) => r.commits,
      render: (r) => (
        <span className="font-mono text-[11px] text-text-secondary">
          {fmt(r.commits)}
        </span>
      ),
    },
    {
      key: 'share',
      label: 'Share',
      width: '70px',
      align: 'right',
      sortValue: (r) => r.share,
      render: (r) => (
        <span className="font-mono text-[11px] text-text-secondary">
          {formatShare(r.share)}
        </span>
      ),
    },
    {
      key: 'files',
      label: 'Files',
      width: '70px',
      align: 'right',
      sortValue: (r) => r.files,
      render: (r) => (
        <span className="font-mono text-[11px] text-text-secondary">
          {fmt(r.files)}
        </span>
      ),
    },
    {
      key: 'topFile',
      label: 'Top file',
      render: (r) => (
        <span className="font-mono text-[11px] text-text-secondary">
          {r.topFile}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1">
        {rows.length === 0 ? (
          <div className="py-6 px-3 text-[11px] text-text-tertiary text-center">
            {emptyStateCopy(mode)}
          </div>
        ) : (
          <SortableTable
            data={rows}
            columns={columns}
            rowKey={(r) => r.directory}
          />
        )}
      </div>
      <div className="sticky bottom-0 mt-auto bg-surface-primary border-t border-border-primary py-1.5 px-1 text-[10px] text-text-tertiary flex gap-2 items-center">
        See also:{' '}
        <button
          onClick={() => onApplyPreset('hotspots')}
          className="bg-transparent border-none text-accent-primary text-[10px] cursor-pointer p-0 underline"
        >
          Hotspots
        </button>
        ·
        <button
          onClick={() => onApplyPreset('cursed-files')}
          className="bg-transparent border-none text-accent-primary text-[10px] cursor-pointer p-0 underline"
        >
          Cursed Files
        </button>
      </div>
    </div>
  );
}
