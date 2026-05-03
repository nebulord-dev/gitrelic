import { formatRelative } from '../../utils/relativeTime';
import Badge from '../shared/Badge';
import { type Column, SortableTable } from '../shared/SortableTable';
import { fmt } from '../theme';
import type { PresetId } from '../../presets/types';
import type { Contributor, GitrelicReport } from '@gitrelic/core';

interface ContributorsTabProps {
  report: GitrelicReport;
  onApplyPreset: (id: PresetId) => void;
}

function daysSince(iso: string): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return ms / 86_400_000;
}

export function ContributorsTab({
  report,
  onApplyPreset,
}: ContributorsTabProps) {
  const contributors = report.contributors.contributors;

  const columns: Column<Contributor>[] = [
    {
      key: 'name',
      label: 'Contributor',
      render: (c) => (
        <div className="flex items-center gap-2">
          <div className="w-[22px] h-[22px] rounded-full bg-surface-tertiary flex items-center justify-center text-[9px] text-text-secondary shrink-0">
            {(c.name || c.email).slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-text-primary flex items-center gap-1.5">
              <span
                className={
                  c.isActive
                    ? 'w-1.5 h-1.5 rounded-full bg-severity-healthy shrink-0'
                    : 'w-1.5 h-1.5 rounded-full bg-text-tertiary shrink-0'
                }
              />
              <span className="truncate">{c.name || c.email}</span>
              {c.isGhost && <Badge variant="stale">ghost</Badge>}
            </div>
            {c.name && (
              <div className="text-[9px] text-text-tertiary truncate">
                {c.email}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'commits',
      label: 'Commits',
      width: '80px',
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
      width: '70px',
      align: 'right',
      sortValue: (c) => c.filesOwned,
      render: (c) => (
        <span className="font-mono text-[11px] text-text-secondary">
          {fmt(c.filesOwned)}
        </span>
      ),
    },
    {
      key: 'lines',
      label: 'Lines',
      width: '90px',
      align: 'right',
      sortValue: (c) => c.linesChanged,
      render: (c) => (
        <span className="font-mono text-[11px] text-text-secondary">
          {fmt(c.linesChanged)}
        </span>
      ),
    },
    {
      key: 'lastActive',
      label: 'Last Active',
      width: '100px',
      align: 'right',
      // Negate so most-recent sorts first; missing/invalid lastCommit
      // → NaN || 0 → epoch zero → bottom of list (matches daysSince's
      // `null → em-dash` rendering of the same case).
      sortValue: (c) => -1 * (new Date(c.lastCommit).getTime() || 0),
      render: (c) => (
        <span className="font-mono text-[10px] text-text-tertiary">
          {formatRelative(daysSince(c.lastCommit))}
        </span>
      ),
    },
    {
      key: 'focus',
      label: 'Focus Areas',
      width: '260px',
      render: (c) => (
        <span className="text-[10px] text-text-tertiary truncate block">
          {c.focusAreas.slice(0, 3).join(', ')}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1">
        {contributors.length === 0 ? (
          <div className="py-6 px-3 text-[11px] text-text-tertiary text-center">
            No contributors found in the analysis window.
          </div>
        ) : (
          <SortableTable
            data={contributors}
            columns={columns}
            rowKey={(c) => c.email}
          />
        )}
      </div>
      <div className="sticky bottom-0 mt-auto bg-surface-primary border-t border-border-primary py-1.5 px-1 text-[10px] text-text-tertiary flex gap-2 items-center">
        See also:{' '}
        <button
          type="button"
          onClick={() => onApplyPreset('bus-factor')}
          className="bg-transparent border-none text-accent-primary text-[10px] cursor-pointer p-0 underline"
        >
          Bus Factor
        </button>
        ·
        <button
          type="button"
          onClick={() => onApplyPreset('ghost-files')}
          className="bg-transparent border-none text-accent-primary text-[10px] cursor-pointer p-0 underline"
        >
          Ghost Files
        </button>
      </div>
    </div>
  );
}
