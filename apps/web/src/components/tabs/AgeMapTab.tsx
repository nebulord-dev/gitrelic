import { aggregateAgeByDirectory } from '../../utils/ageByDirectory';
import { NarrativeKPI } from '../shared/NarrativeKPI';
import { Tooltip } from '../shared/Tooltip';
import { fmt } from '../theme';

import type { PresetId } from '../../presets/types';
import type { BadgeVariant } from '../theme';
import type { GitrelicReport } from '@gitrelic/core';

interface AgeMapTabProps {
  report: GitrelicReport;
  onApplyPreset: (id: PresetId) => void;
}

const TOP_DIRS_FINDING = 3;
const DIRECTORY_ROLLUP_LIMIT = 5;

// Cold-share tiering: <25% Healthy · 25-49% Moderate · 50-74% High · ≥75% Critical.
// Anchored on the share of files in stale + ancient tiers — surfaces the
// "going cold" verdict the strip's individual counts can't combine.
function tierBadge(coldShare: number): { variant: BadgeVariant; label: string } {
  if (coldShare < 0.25) return { variant: 'healthy', label: 'Healthy' };
  if (coldShare < 0.5) return { variant: 'warning', label: 'Moderate' };
  if (coldShare < 0.75) return { variant: 'critical', label: 'High' };
  return { variant: 'critical', label: 'Critical' };
}

export function AgeMapTab({ report, onApplyPreset }: AgeMapTabProps) {
  const { files, staleFiles, ancientFiles } = report.ageMap;

  const total = files.length;
  const coldCount = staleFiles.length + ancientFiles.length;
  const coldShare = total === 0 ? 0 : coldCount / total;
  const coldPercent = Math.round(coldShare * 100);
  const tier = tierBadge(coldShare);

  const tierMix = files.reduce(
    (acc, f) => {
      acc[f.status]++;
      return acc;
    },
    { fresh: 0, aging: 0, stale: 0, ancient: 0 } as Record<
      'fresh' | 'aging' | 'stale' | 'ancient',
      number
    >,
  );

  // Aggregator returns directories sorted by median age desc — perfect for the
  // top-3 finding and for picking the "where ancient files live" rollup.
  const allDirectoryRows = aggregateAgeByDirectory(files);
  const topStaleDirs = allDirectoryRows.slice(0, TOP_DIRS_FINDING);

  // For the "Where they live" extras, re-rank by ancient count desc so the
  // rollup answers "which directory has the most dead-weight files?" rather
  // than "which directory has the highest median?". Same shape as Bus Factor /
  // Rewrite Ratio / Blast Radius. Exclude directories already shown in the
  // finding to avoid rendering the same directory name twice in the DOM.
  const findingDirs = new Set(topStaleDirs.map((d) => d.directory));
  const ancientDirectoryRows = [...allDirectoryRows].sort(
    (a, b) => b.ancientCount - a.ancientCount || a.directory.localeCompare(b.directory),
  );
  const eligibleAncientRows = ancientDirectoryRows.filter(
    (r) => r.ancientCount > 0 && !findingDirs.has(r.directory),
  );
  const directoryRows = eligibleAncientRows.slice(0, DIRECTORY_ROLLUP_LIMIT);
  const hiddenDirectoryCount = Math.max(0, eligibleAncientRows.length - DIRECTORY_ROLLUP_LIMIT);
  const maxAncientCount = directoryRows[0]?.ancientCount ?? 1;

  return (
    <NarrativeKPI
      bigNumber={`${coldPercent}%`}
      tier={tier}
      metric="% Cold"
      finding={
        topStaleDirs.length > 0 && total > 0 ? (
          <div className="flex flex-col gap-1">
            <div className="text-[9px] text-text-tertiary uppercase tracking-[1px]">
              Top stale directories
            </div>
            {topStaleDirs.map((d) => (
              <div key={d.directory} className="leading-[1.5]">
                <span className="font-mono text-text-primary">{d.directory || '(root)'}</span>{' '}
                <span className="text-text-tertiary">
                  — <strong className="text-text-primary">{fmt(d.medianAgeDays)}</strong> days
                  median · <strong className="text-severity-critical">{fmt(d.ancientCount)}</strong>{' '}
                  ancient
                </span>
              </div>
            ))}
          </div>
        ) : (
          <>No age signal in the analysis window.</>
        )
      }
      subline={
        total > 0 ? (
          <>
            Tier mix: <strong className="text-severity-healthy">{fmt(tierMix.fresh)}</strong> fresh
            · <strong className="text-text-primary">{fmt(tierMix.aging)}</strong> aging ·{' '}
            <strong className="text-severity-warning">{fmt(tierMix.stale)}</strong> stale ·{' '}
            <strong className="text-severity-critical">{fmt(tierMix.ancient)}</strong> ancient.
          </>
        ) : null
      }
      extras={
        directoryRows.length > 0 ? (
          <div>
            <div className="text-[9px] text-text-tertiary uppercase tracking-[1px] mb-2">
              Where they live
            </div>
            <div className="flex flex-col gap-1">
              {directoryRows.map((row) => (
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
                      style={{ width: `${(row.ancientCount / maxAncientCount) * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-text-primary font-semibold inline-block min-w-8 text-right">
                    {row.ancientCount}
                  </span>
                  <span className="text-text-tertiary text-[10px] inline-block min-w-9 text-right">
                    {((row.ancientCount / Math.max(1, ancientFiles.length)) * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
            {hiddenDirectoryCount > 0 && (
              <div className="mt-1.5 text-[10px] text-text-tertiary">
                + {hiddenDirectoryCount} more{' '}
                {hiddenDirectoryCount === 1 ? 'directory' : 'directories'}
              </div>
            )}
          </div>
        ) : undefined
      }
      seeAlso={[
        { label: 'Stale Files', presetId: 'dead-code' },
        { label: 'Cursed Files', presetId: 'cursed-files' },
      ]}
      onApplyPreset={onApplyPreset}
    />
  );
}
