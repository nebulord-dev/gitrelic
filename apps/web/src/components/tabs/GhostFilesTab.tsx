import {
  aggregateGhostFilesByDirectory,
  type GhostDirectoryRow,
} from '../../utils/ghostFilesByDirectory';
import { topGhostOwners, type TopGhostOwner } from '../../utils/ghostOwners';
import { NarrativeKPI } from '../shared/NarrativeKPI';
import { Tooltip } from '../shared/Tooltip';
import { fmt } from '../theme';
import type { PresetId } from '../../presets/types';
import type { BadgeVariant } from '../theme';
import type { GitrelicReport } from '@gitrelic/core';

interface GhostFilesTabProps {
  report: GitrelicReport;
  onApplyPreset: (id: PresetId) => void;
}

const TOP_OWNERS_COUNT = 3;
const DIRECTORY_ROLLUP_LIMIT = 5;

function ghostOwnerTier(count: number): {
  variant: BadgeVariant;
  label: string;
} {
  if (count === 0) return { variant: 'healthy', label: 'Healthy' };
  if (count <= 2) return { variant: 'warning', label: 'Moderate' };
  return { variant: 'critical', label: 'High Risk' };
}

function TopGhostOwnersList({ owners }: { owners: TopGhostOwner[] }) {
  if (owners.length === 0) {
    return <>No ghost owners — every dominant author is still active.</>;
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[9px] text-text-tertiary uppercase tracking-[1px]">
        Top ghost owners
      </div>
      {owners.map((o) => (
        <div key={o.email} className="leading-[1.5]">
          <span className="text-text-primary font-semibold">{o.name}</span>{' '}
          <span className="text-text-tertiary">
            <span className="font-mono text-text-primary">{o.fileCount}</span>{' '}
            file{o.fileCount === 1 ? '' : 's'} ·{' '}
            <span className="font-mono text-text-primary">
              {fmt(o.ghostLoc)}
            </span>{' '}
            LOC
          </span>
        </div>
      ))}
    </div>
  );
}

function GhostDirectoryRollup({
  rows,
  hiddenCount,
}: {
  rows: GhostDirectoryRow[];
  hiddenCount: number;
}) {
  if (rows.length === 0) return null;
  const maxCount = rows[0].count;
  return (
    <div>
      <div className="text-[9px] text-text-tertiary uppercase tracking-[1px] mb-2">
        Where they live
      </div>
      <div className="flex flex-col gap-1">
        {rows.map((row) => (
          <div
            key={row.directory}
            className="flex items-center gap-3 text-[11px] leading-[1.4]"
          >
            <Tooltip
              content={row.directory || '(root)'}
              wrapperClassName="block flex-1 min-w-0 font-mono text-text-secondary overflow-hidden text-ellipsis whitespace-nowrap"
            >
              {row.directory || '(root)'}
            </Tooltip>
            <div className="w-20 h-1 bg-surface-tertiary rounded-xs overflow-hidden shrink-0">
              <div
                className="h-full bg-severity-critical opacity-70"
                style={{ width: `${(row.count / maxCount) * 100}%` }}
              />
            </div>
            <span className="font-mono text-text-primary font-semibold inline-block min-w-8 text-right">
              {row.count}
            </span>
            <span className="text-text-tertiary text-[10px] inline-block min-w-9 text-right">
              {(row.share * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
      {hiddenCount > 0 && (
        <div className="mt-1.5 text-[10px] text-text-tertiary">
          + {hiddenCount} more {hiddenCount === 1 ? 'directory' : 'directories'}
        </div>
      )}
    </div>
  );
}

export function GhostFilesTab({ report, onApplyPreset }: GhostFilesTabProps) {
  const gf = report.ghostFiles;
  const tier = ghostOwnerTier(gf.ghostOwners);
  const topOwners = topGhostOwners(
    gf.files,
    report.contributors.contributors,
    TOP_OWNERS_COUNT,
  );
  const allDirRollup = aggregateGhostFilesByDirectory(gf.files);
  const dirRollup = allDirRollup.slice(0, DIRECTORY_ROLLUP_LIMIT);
  const hiddenDirectoryCount = Math.max(
    0,
    allDirRollup.length - DIRECTORY_ROLLUP_LIMIT,
  );

  return (
    <NarrativeKPI
      bigNumber={String(gf.ghostOwners)}
      tier={tier}
      metric="GHOST OWNERS"
      finding={<TopGhostOwnersList owners={topOwners} />}
      subline={
        gf.totalGhostFiles > 0 ? (
          <>
            <span className="font-mono text-text-primary font-semibold">
              {gf.totalGhostFiles}
            </span>{' '}
            ghost files —{' '}
            <span className="font-mono">{gf.tierMix.trueGhost}</span> true ghost
            · <span className="font-mono">{gf.tierMix.fading}</span> fading ·{' '}
            <span className="font-mono">{fmt(gf.ghostLoc)}</span> LOC dormant
          </>
        ) : (
          <>0 ghost files — knowledge transfer is intact.</>
        )
      }
      extras={
        dirRollup.length > 0 ? (
          <GhostDirectoryRollup
            rows={dirRollup}
            hiddenCount={hiddenDirectoryCount}
          />
        ) : undefined
      }
      seeAlso={[
        { label: 'Bus Factor', presetId: 'bus-factor' },
        { label: 'Knowledge Silos', presetId: 'knowledge-silos' },
      ]}
      onApplyPreset={onApplyPreset}
    />
  );
}
