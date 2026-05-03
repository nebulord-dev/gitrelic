import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { sortCriticalByImpact } from '../../utils/sortBusFactor';
import { HeroCaption } from '../shared/HeroCaption';
import type { BusFactorRisk, GitrelicReport } from '@gitrelic/core';

export interface OwnershipBarRow {
  file: string;
  name: string;
  dominantAuthor: string;
  dominantAuthorPercent: number;
  commitCount: number;
  risk: BusFactorRisk;
}

const ROW_HEIGHT = 28;
const BAR_HEIGHT = 18;
const TOP_PAD = 12;
const BOTTOM_PAD = 12;
const LABEL_WIDTH = 220;
// Empirical width of one char in the 10px monospace label font; over-estimates
// slightly so the dynamic right-pad never crops a glyph.
const CHAR_PX = 6.4;
const LABEL_PAD_PX = 14;
const MIN_RIGHT_PAD = 120;
const MIN_BAR_LANE = 120;

function truncateToFit(label: string, maxChars: number): string {
  return label.length > maxChars
    ? `${label.slice(0, Math.max(1, maxChars - 1))}…`
    : label;
}

export function prepareOwnershipBarData(
  report: GitrelicReport,
  topN = 100,
): OwnershipBarRow[] {
  const churnByFile = new Map(
    (report.churn?.files ?? []).map((c) => [c.file, c.commitCount]),
  );
  return sortCriticalByImpact(report)
    .slice(0, topN)
    .map((f) => {
      const basename = f.file.split('/').pop();
      return {
        file: f.file,
        name: basename && basename.length > 0 ? basename : f.file,
        dominantAuthor: f.dominantAuthor,
        dominantAuthorPercent: f.dominantAuthorPercent,
        commitCount: churnByFile.get(f.file) ?? 0,
        risk: f.risk,
      };
    });
}

function riskColor(risk: BusFactorRisk): string {
  switch (risk) {
    case 'critical':
      return 'var(--severity-critical)';
    case 'high':
      return 'var(--severity-warning)';
    case 'medium':
      return 'var(--severity-moderate)';
    case 'low':
      return 'var(--severity-healthy)';
  }
}

interface OwnershipBarProps {
  report: GitrelicReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

export function OwnershipBar({
  report,
  selectedFile,
  onSelectFile,
}: OwnershipBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    row: OwnershipBarRow;
  } | null>(null);

  const rows = useMemo(() => prepareOwnershipBarData(report), [report]);
  const totalCriticalFiles = report.busFactors.criticalFiles.length;

  useEffect(() => {
    if (!scrollRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    observer.observe(scrollRef.current);
    return () => observer.disconnect();
  }, []);

  // Scroll the selected row into view when selection changes from outside.
  useLayoutEffect(() => {
    if (!selectedFile || !scrollRef.current) return;
    const idx = rows.findIndex((r) => r.file === selectedFile);
    if (idx < 0) return;
    const rowTop = TOP_PAD + idx * ROW_HEIGHT;
    const rowBottom = rowTop + ROW_HEIGHT;
    const viewTop = scrollRef.current.scrollTop;
    const viewBottom = viewTop + scrollRef.current.clientHeight;
    if (rowTop < viewTop || rowBottom > viewBottom) {
      scrollRef.current.scrollTo({
        top: Math.max(0, rowTop - 40),
        behavior: 'smooth',
      });
    }
  }, [selectedFile, rows]);

  if (rows.length === 0) {
    return (
      <div ref={containerRef} className="w-full h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center text-text-tertiary text-xs">
          No critical-ownership files detected.
        </div>
        <HeroCaption
          primary="One row per critical file · bar = dominant-author share · color = risk tier"
          subtitle="Critical = single-author file or one author owning ≥90% of commits."
        />
      </div>
    );
  }

  // Right-pad must fit the longest "{author} {percent}%" label across visible
  // rows so emails aren't truncated when they don't have to be. When the
  // longest label is so long it would shrink the bar lane below MIN_BAR_LANE,
  // the pad is clamped and any over-long labels fall back to ellipsis.
  const longestLabelChars = rows.reduce((max, r) => {
    const len = `${r.dominantAuthor} ${r.dominantAuthorPercent}%`.length;
    return len > max ? len : max;
  }, 0);
  const desiredRightPad = longestLabelChars * CHAR_PX + LABEL_PAD_PX;
  const maxAllowedRightPad = Math.max(
    MIN_RIGHT_PAD,
    width - LABEL_WIDTH - MIN_BAR_LANE,
  );
  const rightPad = Math.max(
    MIN_RIGHT_PAD,
    Math.min(desiredRightPad, maxAllowedRightPad),
  );
  const available = Math.max(MIN_BAR_LANE, width - LABEL_WIDTH - rightPad);
  const labelMaxChars = Math.max(
    8,
    Math.floor((rightPad - LABEL_PAD_PX) / CHAR_PX),
  );
  const chartHeight = TOP_PAD + rows.length * ROW_HEIGHT + BOTTOM_PAD;
  const truncated = totalCriticalFiles > rows.length;
  const subtitle = truncated
    ? `Showing top ${rows.length} of ${totalCriticalFiles.toLocaleString()} critical files. Sorted by ownership share, tiebroken by commit count.`
    : `${rows.length} critical file${rows.length === 1 ? '' : 's'}. Sorted by ownership share, tiebroken by commit count.`;

  return (
    <div ref={containerRef} className="w-full h-full relative flex flex-col">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <svg width={width} height={chartHeight} className="block">
          {rows.map((row, i) => {
            const y = TOP_PAD + i * ROW_HEIGHT;
            const barTop = y + (ROW_HEIGHT - BAR_HEIGHT) / 2;
            const barWidth = Math.max(
              2,
              (row.dominantAuthorPercent / 100) * available,
            );
            const isSelected = selectedFile === row.file;
            const color = riskColor(row.risk);

            return (
              <g
                key={row.file}
                onClick={() => onSelectFile(row.file)}
                className="cursor-pointer"
                onMouseEnter={(evt) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setTooltip({
                    x: evt.clientX - rect.left,
                    y: evt.clientY - rect.top,
                    row,
                  });
                }}
                onMouseMove={(evt) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setTooltip((prev) =>
                    prev
                      ? {
                          ...prev,
                          x: evt.clientX - rect.left,
                          y: evt.clientY - rect.top,
                        }
                      : prev,
                  );
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                <text
                  x={LABEL_WIDTH - 8}
                  y={barTop + BAR_HEIGHT / 2}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={10}
                  fontFamily="var(--font-mono)"
                  fill={
                    isSelected
                      ? 'var(--accent-primary)'
                      : 'var(--text-secondary)'
                  }
                >
                  {row.name}
                </text>
                <rect
                  x={LABEL_WIDTH}
                  y={barTop}
                  width={available}
                  height={BAR_HEIGHT}
                  rx={2}
                  fill="var(--surface-secondary)"
                  fillOpacity={0.4}
                />
                <rect
                  x={LABEL_WIDTH}
                  y={barTop}
                  width={barWidth}
                  height={BAR_HEIGHT}
                  rx={2}
                  fill={color}
                  fillOpacity={isSelected ? 0.9 : 0.7}
                  stroke={isSelected ? 'var(--accent-primary)' : 'transparent'}
                  strokeWidth={isSelected ? 1 : 0}
                />
                <text
                  x={LABEL_WIDTH + available + 6}
                  y={barTop + BAR_HEIGHT / 2}
                  dominantBaseline="middle"
                  fontSize={10}
                  fontFamily="var(--font-mono)"
                  fill={color}
                  fontWeight={600}
                  className="pointer-events-none"
                >
                  {truncateToFit(
                    `${row.dominantAuthor} ${row.dominantAuthorPercent}%`,
                    labelMaxChars,
                  )}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <HeroCaption
        primary="One row per critical file · bar = dominant-author share · color = risk tier"
        subtitle={subtitle}
      />
      {tooltip && (
        <div
          className="absolute bg-tooltip-bg border border-border-primary rounded px-2.5 py-1.5 text-[10px] text-tooltip-text pointer-events-none z-20 max-w-80 break-all"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
        >
          <div className="font-semibold mb-0.5">{tooltip.row.file}</div>
          <div className="text-text-secondary">
            {tooltip.row.dominantAuthor} owns{' '}
            {tooltip.row.dominantAuthorPercent}%
          </div>
          {tooltip.row.commitCount > 0 && (
            <div className="text-text-secondary">
              {tooltip.row.commitCount} commit
              {tooltip.row.commitCount === 1 ? '' : 's'}
            </div>
          )}
          <div
            className="mt-0.5 capitalize"
            style={{ color: riskColor(tooltip.row.risk) }}
          >
            {tooltip.row.risk} risk
          </div>
        </div>
      )}
    </div>
  );
}
