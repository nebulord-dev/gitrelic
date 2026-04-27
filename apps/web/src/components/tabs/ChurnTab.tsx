import { type CSSProperties, useMemo } from 'react';

import { severityForChurn } from '../../utils/churn';
import { formatRelative } from '../../utils/relativeTime';
import Badge from '../shared/Badge';
import { type Column, SortableTable } from '../shared/SortableTable';
import { Tooltip } from '../shared/Tooltip';
import { fileName, filePath, fmt } from '../theme';

import type { PresetId } from '../../presets/types';
import type { FileChurn, GitrelicReport } from '@gitrelic/core';

interface ChurnTabProps {
  report: GitrelicReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
  onApplyPreset?: (id: PresetId) => void;
}

interface ChurnRow {
  file: string;
  commitCount: number;
  category: 'hot' | 'warm' | 'cold' | 'frozen';
  loc: number | null;
  uniqueAuthors: number | null;
  authors: string[] | null;
  ageDays: number | null;
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

function buildRows(report: GitrelicReport): ChurnRow[] {
  const locByFile = new Map(report.loc.files.map((f) => [f.file, f.lines]));
  const bfByFile = new Map(
    report.busFactors.files.map((f) => [
      f.file,
      { uniqueAuthors: f.uniqueAuthors, authors: f.authors },
    ]),
  );
  const ageByFile = new Map(report.ageMap.files.map((f) => [f.file, f.ageInDays]));

  return (report.churn?.files ?? []).map((f: FileChurn) => {
    const bf = bfByFile.get(f.file);
    return {
      file: f.file,
      commitCount: f.commitCount,
      category: f.category,
      loc: locByFile.get(f.file) ?? null,
      uniqueAuthors: bf?.uniqueAuthors ?? null,
      authors: bf?.authors ?? null,
      ageDays: ageByFile.get(f.file) ?? null,
    };
  });
}

export function ChurnTab({ report, selectedFile, onSelectFile, onApplyPreset }: ChurnTabProps) {
  const rows = useMemo(() => buildRows(report), [report]);

  const columns: Column<ChurnRow>[] = [
    {
      key: 'file',
      label: 'File',
      render: (r) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          {fileName(r.file)}
          <span style={{ color: 'var(--text-tertiary)', marginLeft: 6, fontSize: 10 }}>
            {filePath(r.file)}
          </span>
        </span>
      ),
    },
    {
      key: 'commits',
      label: 'Commits',
      width: '90px',
      align: 'right',
      sortValue: (r) => r.commitCount,
      render: (r) => (
        <span
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}
        >
          {fmt(r.commitCount)}
        </span>
      ),
    },
    {
      key: 'loc',
      label: 'LOC',
      width: '70px',
      align: 'right',
      sortValue: (r) => r.loc ?? -1,
      render: (r) => (
        <span
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}
        >
          {r.loc != null ? fmt(r.loc) : '—'}
        </span>
      ),
    },
    {
      key: 'authors',
      label: 'Authors',
      width: '70px',
      align: 'right',
      sortValue: (r) => r.uniqueAuthors ?? -1,
      render: (r) => {
        const authors = r.authors ?? [];
        return authors.length > 0 ? (
          <Tooltip
            content={
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {authors.map((a) => (
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
              {r.uniqueAuthors ?? '—'}
            </span>
          </Tooltip>
        ) : (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-secondary)',
            }}
          >
            —
          </span>
        );
      },
    },
    {
      key: 'lastTouched',
      label: 'Last Touched',
      width: '110px',
      align: 'right',
      sortValue: (r) => r.ageDays ?? Number.MAX_SAFE_INTEGER,
      render: (r) => (
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          {formatRelative(r.ageDays)}
        </span>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      width: '80px',
      align: 'center',
      render: (r) => <Badge variant={severityForChurn(r.category)}>{r.category}</Badge>,
    },
  ];

  // Initial sort: commits desc. SortableTable auto-defaults to desc on first column click;
  // we don't have a direct "default sort" prop, so the data is pre-sorted here so the
  // initial render matches what the user expects without any clicks.
  const sorted = useMemo(() => [...rows].sort((a, b) => b.commitCount - a.commitCount), [rows]);

  return (
    <>
      <SortableTable
        data={sorted}
        columns={columns}
        rowKey={(r) => r.file}
        selectedKey={selectedFile}
        onRowClick={(r) => onSelectFile(r.file)}
      />
      {onApplyPreset && (
        <div
          style={{
            padding: '8px 4px 4px',
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
      )}
    </>
  );
}
