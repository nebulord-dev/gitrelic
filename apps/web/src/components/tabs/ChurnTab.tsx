import { type CSSProperties, useMemo } from 'react';

import { aggregateChurnByDirectory, type DirectoryChurnRow } from '../../utils/churnByDirectory';
import { type Column, SortableTable } from '../shared/SortableTable';
import { fmt } from '../theme';

import type { PresetId } from '../../presets/types';
import type { GitrelicReport } from '@gitrelic/core';

interface ChurnTabProps {
  report: GitrelicReport;
  onApplyPreset: (id: PresetId) => void;
}

const linkStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--accent-primary)',
  fontSize: 10,
  cursor: 'pointer',
  padding: 0,
  textDecoration: 'underline',
};

const numericCellStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  color: 'var(--text-secondary)',
};

function formatShare(share: number): string {
  return `${(share * 100).toFixed(1)}%`;
}

export function ChurnTab({ report, onApplyPreset }: ChurnTabProps) {
  const files = report.churn?.files ?? [];
  const rows = useMemo(() => aggregateChurnByDirectory(files), [files]);

  const columns: Column<DirectoryChurnRow>[] = [
    {
      key: 'directory',
      label: 'Directory',
      render: (r) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          {r.directory === '' ? (
            <span style={{ color: 'var(--text-tertiary)' }}>(root)</span>
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
      render: (r) => <span style={numericCellStyle}>{fmt(r.commits)}</span>,
    },
    {
      key: 'share',
      label: 'Share',
      width: '70px',
      align: 'right',
      sortValue: (r) => r.share,
      render: (r) => <span style={numericCellStyle}>{formatShare(r.share)}</span>,
    },
    {
      key: 'files',
      label: 'Files',
      width: '70px',
      align: 'right',
      sortValue: (r) => r.files,
      render: (r) => <span style={numericCellStyle}>{fmt(r.files)}</span>,
    },
    {
      key: 'topFile',
      label: 'Top file',
      render: (r) => <span style={numericCellStyle}>{r.topFile}</span>,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{ flex: 1 }}>
        <SortableTable data={rows} columns={columns} rowKey={(r) => r.directory} />
      </div>
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          marginTop: 'auto',
          background: 'var(--surface-primary)',
          borderTop: '1px solid var(--border-primary)',
          padding: '6px 4px',
          fontSize: 10,
          color: 'var(--text-tertiary)',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        See also:{' '}
        <button onClick={() => onApplyPreset('hotspots')} style={linkStyle}>
          Hotspots
        </button>
        ·
        <button onClick={() => onApplyPreset('cursed-files')} style={linkStyle}>
          Cursed Files
        </button>
      </div>
    </div>
  );
}
