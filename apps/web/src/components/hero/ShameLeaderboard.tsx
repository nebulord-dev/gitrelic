import { useEffect, useMemo, useRef, useState } from 'react';

import { HeroCaption } from '../shared/HeroCaption';

import type { GitrelicReport } from '@gitrelic/core';

// Mirrors CONFIDENCE_FLOOR in packages/core/src/analyzers/forensics.ts. Exported so the
// shame-leaderboard test can assert the value matches core (catches drift if core bumps).
export const CONFIDENCE_FLOOR = 5;

type ShameTier = 'critical' | 'moderate' | 'mild';

// Mirrors the SHAME_KEYWORDS tier sets in packages/core/src/analyzers/forensics.ts.
// If core's keyword tiers change, mirror the change here in the same PR.
export const TIER_KEYWORDS: Record<ShameTier, ReadonlySet<string>> = {
  critical: new Set(['revert', 'hotfix', 'oops', 'fixup', 'broke']),
  moderate: new Set(['hack', 'workaround', 'temporary', 'temp', 'kludge', 'band-aid']),
  mild: new Set(['fix', 'bug', 'wrong', 'mistake', 'typo', 'cleanup']),
};

const TIER_COLORS: Record<ShameTier, string> = {
  critical: 'var(--severity-critical)',
  moderate: 'var(--severity-warning)',
  mild: '#9b8b3e', // muted yellow — distinct from --severity-healthy (green)
};

export function classifyTier(dominantKeyword: string | null): ShameTier {
  if (!dominantKeyword) return 'mild';
  if (TIER_KEYWORDS.critical.has(dominantKeyword)) return 'critical';
  if (TIER_KEYWORDS.moderate.has(dominantKeyword)) return 'moderate';
  return 'mild';
}

export interface ShameBarEntry {
  file: string;
  name: string;
  score: number;
  shameCommitCount: number;
  topKeyword: string | null;
  tier: ShameTier;
}

export function prepareShameData(report: GitrelicReport): ShameBarEntry[] {
  return report.forensics.shameLeaderboard.map((f) => {
    const basename = f.file.split('/').pop();
    const topKeyword = f.dominantKeywords[0] ?? null;
    return {
      file: f.file,
      name: basename && basename.length > 0 ? basename : f.file,
      score: f.shameScore,
      shameCommitCount: f.shameCommitCount,
      topKeyword,
      tier: classifyTier(topKeyword),
    };
  });
}

interface ShameLeaderboardProps {
  report: GitrelicReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

export function ShameLeaderboard({ report, selectedFile, onSelectFile }: ShameLeaderboardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; entry: ShameBarEntry } | null>(
    null,
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const entries = useMemo(() => prepareShameData(report), [report]);

  if (entries.length === 0) {
    return (
      <div ref={containerRef} className="w-full h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center text-text-tertiary text-xs">
          No shame signals detected.
        </div>
        <HeroCaption
          primary={`One row per file · bar = shame score · color = dominant tier · files with ≥${CONFIDENCE_FLOOR} commits`}
          subtitle="Which files actually carry sustained shame, ranked by severity-weighted commit messages?"
        />
      </div>
    );
  }

  const labelWidth = 180;
  const rightPad = 70;
  const topPad = 16;
  const bottomPad = 16;
  const available = Math.max(120, dims.width - labelWidth - rightPad);
  const svgHeight = Math.max(120, dims.height - 56);
  const rowHeight = Math.max(20, (svgHeight - topPad - bottomPad) / Math.max(entries.length, 1));
  const barHeight = Math.max(10, rowHeight - 6);

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col">
      <div className="flex-1 relative">
        <svg
          width={dims.width}
          height={svgHeight}
          role="img"
          aria-label={`Shame leaderboard. ${entries.length} ${entries.length === 1 ? 'file' : 'files'} ranked by severity-weighted shame score, filtered to files with at least ${CONFIDENCE_FLOOR} commits.`}
        >
          {entries.map((e, i) => {
            const y = topPad + i * rowHeight;
            const barWidth = Math.max(2, (e.score / 100) * available);
            const isSelected = selectedFile === e.file;
            const color = TIER_COLORS[e.tier];

            return (
              <g
                key={e.file}
                onClick={() => onSelectFile(e.file)}
                className="cursor-pointer"
                onMouseEnter={(evt) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setTooltip({
                    x: evt.clientX - rect.left,
                    y: evt.clientY - rect.top,
                    entry: e,
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                <text
                  x={labelWidth - 8}
                  y={y + barHeight / 2}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={10}
                  fontFamily="var(--font-mono)"
                  fill={isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)'}
                >
                  {e.name}
                </text>
                <rect
                  data-tier={e.tier}
                  x={labelWidth}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx={2}
                  fill={color}
                  fillOpacity={isSelected ? 0.9 : 0.7}
                  stroke={isSelected ? 'var(--accent-primary)' : 'transparent'}
                  strokeWidth={isSelected ? 1 : 0}
                />
                {e.topKeyword && barWidth > 60 && (
                  <text
                    x={labelWidth + 6}
                    y={y + barHeight / 2}
                    dominantBaseline="middle"
                    fontSize={9}
                    fill="rgba(255,255,255,0.8)"
                    className="pointer-events-none"
                  >
                    {e.topKeyword}
                  </text>
                )}
                <text
                  x={labelWidth + barWidth + 6}
                  y={y + barHeight / 2}
                  dominantBaseline="middle"
                  fontSize={10}
                  fontFamily="var(--font-mono)"
                  fill={color}
                  fontWeight={600}
                  className="pointer-events-none"
                >
                  {e.score}
                </text>
              </g>
            );
          })}
        </svg>
        {tooltip && (
          <div
            className="absolute bg-surface-elevated border border-border-primary rounded px-2.5 py-1.5 text-[10px] text-text-primary pointer-events-none z-20 max-w-[320px] break-all"
            style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
          >
            <div className="font-semibold mb-0.5">{tooltip.entry.file}</div>
            <div className="text-text-secondary">
              Shame {tooltip.entry.score} · {tooltip.entry.shameCommitCount} shame commit
              {tooltip.entry.shameCommitCount !== 1 ? 's' : ''}
            </div>
            {tooltip.entry.topKeyword && (
              <div className="text-text-tertiary mt-0.5">
                Top keyword: {tooltip.entry.topKeyword}
              </div>
            )}
          </div>
        )}
      </div>
      <HeroCaption
        primary={`One row per file · bar = shame score · color = dominant tier · files with ≥${CONFIDENCE_FLOOR} commits`}
        subtitle="Which files actually carry sustained shame, ranked by severity-weighted commit messages?"
      />
    </div>
  );
}
