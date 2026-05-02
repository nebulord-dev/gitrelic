import { useEffect, useMemo, useRef, useState } from 'react';

import type { GitrelicReport } from '@gitrelic/core';

export type CoverageTier = 'critical' | 'low' | 'medium' | 'good';

export interface CoverageByDirRow {
  directory: string;
  sourceFiles: number;
  testFiles: number;
  coverageRatio: number;
  tier: CoverageTier;
}

export interface CoverageByDirData {
  rows: CoverageByDirRow[];
}

export function coverageTierFor(ratio: number): CoverageTier {
  if (ratio < 0.25) return 'critical';
  if (ratio < 0.5) return 'low';
  if (ratio < 0.8) return 'medium';
  return 'good';
}

export function prepareCoverageByDirData(report: GitrelicReport, topN = 30): CoverageByDirData {
  const rows: CoverageByDirRow[] = report.testCoverage.directories
    .filter((d) => d.sourceFiles > 0)
    .map((d) => ({
      directory: d.directory,
      sourceFiles: d.sourceFiles,
      testFiles: d.testFiles,
      coverageRatio: d.coverageRatio,
      tier: coverageTierFor(d.coverageRatio),
    }))
    .sort((a, b) => a.coverageRatio - b.coverageRatio)
    .slice(0, topN);

  return { rows };
}

const TIER_COLORS: Record<CoverageTier, string> = {
  critical: 'var(--severity-critical)',
  low: '#d27b22',
  medium: 'var(--severity-warning)',
  good: 'var(--severity-healthy)',
};

interface TestCoverageByDirProps {
  report: GitrelicReport;
}

export function TestCoverageByDir({ report }: TestCoverageByDirProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; row: CoverageByDirRow } | null>(
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

  const { rows } = useMemo(() => prepareCoverageByDirData(report), [report]);

  if (rows.length === 0) {
    return (
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center text-text-tertiary text-xs"
      >
        No directories with source files detected.
      </div>
    );
  }

  const labelWidth = 280;
  const rightPad = 80;
  const topPad = 16;
  const bottomPad = 16;
  const available = Math.max(120, dims.width - labelWidth - rightPad);
  const rowHeight = Math.max(20, (dims.height - topPad - bottomPad) / Math.max(rows.length, 1));
  const barHeight = Math.max(10, rowHeight - 6);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg width={dims.width} height={dims.height}>
        {rows.map((row, i) => {
          const y = topPad + i * rowHeight;
          const barWidth = Math.max(2, row.coverageRatio * available);
          const color = TIER_COLORS[row.tier];

          return (
            <g
              key={row.directory}
              onMouseEnter={(evt) => {
                const rect = containerRef.current?.getBoundingClientRect();
                if (!rect) return;
                setTooltip({ x: evt.clientX - rect.left, y: evt.clientY - rect.top, row });
              }}
              onMouseLeave={() => setTooltip(null)}
              className="cursor-default"
            >
              <text
                x={labelWidth - 8}
                y={y + barHeight / 2}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10}
                fontFamily="var(--font-mono)"
                fill="var(--text-secondary)"
              >
                {row.directory}
              </text>
              <rect
                x={labelWidth}
                y={y}
                width={available}
                height={barHeight}
                rx={2}
                fill="var(--surface-secondary)"
                fillOpacity={0.4}
              />
              <rect
                x={labelWidth}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={2}
                fill={color}
                fillOpacity={0.75}
              />
              <text
                x={labelWidth + available + 6}
                y={y + barHeight / 2}
                dominantBaseline="middle"
                fontSize={10}
                fontFamily="var(--font-mono)"
                fill={color}
                fontWeight={600}
                className="pointer-events-none"
              >
                {Math.round(row.coverageRatio * 100)}%
              </text>
            </g>
          );
        })}
      </svg>
      {tooltip && (
        <div
          className="absolute bg-surface-elevated border border-border-primary rounded px-[10px] py-[6px] text-[10px] text-text-primary pointer-events-none z-20 max-w-[320px] break-all"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
        >
          <div className="font-semibold mb-0.5">{tooltip.row.directory}</div>
          <div className="text-text-secondary">
            {tooltip.row.testFiles} test{tooltip.row.testFiles === 1 ? '' : 's'} ·{' '}
            {tooltip.row.sourceFiles} source file{tooltip.row.sourceFiles === 1 ? '' : 's'}
          </div>
          <div className="mt-0.5 capitalize" style={{ color: TIER_COLORS[tooltip.row.tier] }}>
            {Math.round(tooltip.row.coverageRatio * 100)}% · {tooltip.row.tier}
          </div>
        </div>
      )}
    </div>
  );
}
