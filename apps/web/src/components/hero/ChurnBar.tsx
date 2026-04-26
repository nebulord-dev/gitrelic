import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { categoryColor } from '../../utils/colors';
import { HeroCaption } from '../shared/HeroCaption';

import type { ChurnCategory, GitrelicReport } from '@gitrelic/core';

export interface ChurnBarRow {
  file: string;
  name: string;
  commitCount: number;
  category: ChurnCategory;
}

const ROW_HEIGHT = 28;
const BAR_HEIGHT = 18;
const TOP_PAD = 12;
const BOTTOM_PAD = 12;
const LABEL_WIDTH = 220;
// Same empirical char width used by OwnershipBar for the trailing label pad.
const CHAR_PX = 6.4;
const LABEL_PAD_PX = 14;
const MIN_RIGHT_PAD = 90;
const MIN_BAR_LANE = 120;

function truncateToFit(label: string, maxChars: number): string {
  return label.length > maxChars ? `${label.slice(0, Math.max(1, maxChars - 1))}…` : label;
}

export function prepareChurnBarData(report: GitrelicReport, topN = 100): ChurnBarRow[] {
  const files = report.churn?.files ?? [];
  const sorted = [...files].sort((a, b) => {
    const diff = b.commitCount - a.commitCount;
    if (diff !== 0) return diff;
    return a.file < b.file ? -1 : a.file > b.file ? 1 : 0;
  });
  return sorted.slice(0, topN).map((f) => {
    const basename = f.file.split('/').pop();
    return {
      file: f.file,
      name: basename && basename.length > 0 ? basename : f.file,
      commitCount: f.commitCount,
      category: f.category,
    };
  });
}

// Maps churn categories to the severity tokens used by `categoryColor` and the
// shared `Badge` component, so ChurnBar tooltips and ChurnTab badges agree on
// what `frozen` looks like.
function severityForChurn(
  category: ChurnCategory,
): 'critical' | 'warning' | 'moderate' | 'healthy' {
  switch (category) {
    case 'hot':
      return 'critical';
    case 'warm':
      return 'warning';
    case 'cold':
      return 'moderate';
    case 'frozen':
      return 'healthy';
  }
}

function fillFor(category: ChurnCategory, opacity: number): string {
  return categoryColor(severityForChurn(category), opacity);
}

interface ChurnBarProps {
  report: GitrelicReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

export function ChurnBar({ report, selectedFile, onSelectFile }: ChurnBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; row: ChurnBarRow } | null>(null);

  const rows = useMemo(() => prepareChurnBarData(report), [report]);
  const totalChurnedFiles = report.churn?.files.length ?? 0;

  useEffect(() => {
    if (!scrollRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    observer.observe(scrollRef.current);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!selectedFile || !scrollRef.current) return;
    const idx = rows.findIndex((r) => r.file === selectedFile);
    if (idx < 0) return;
    const rowTop = TOP_PAD + idx * ROW_HEIGHT;
    const rowBottom = rowTop + ROW_HEIGHT;
    const viewTop = scrollRef.current.scrollTop;
    const viewBottom = viewTop + scrollRef.current.clientHeight;
    if (rowTop < viewTop || rowBottom > viewBottom) {
      scrollRef.current.scrollTo({ top: Math.max(0, rowTop - 40), behavior: 'smooth' });
    }
  }, [selectedFile, rows]);

  if (rows.length === 0) {
    return (
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-tertiary)',
            fontSize: 12,
          }}
        >
          No file churn detected.
        </div>
        <HeroCaption
          primary="One row per file · bar = commit count · color = churn category"
          subtitle="Churn = how many commits each file appears in."
        />
      </div>
    );
  }

  const maxCommits = rows[0].commitCount;
  const longestLabelChars = rows.reduce((max, r) => {
    const len = `${r.commitCount.toLocaleString()} commits`.length;
    return len > max ? len : max;
  }, 0);
  const desiredRightPad = longestLabelChars * CHAR_PX + LABEL_PAD_PX;
  const maxAllowedRightPad = Math.max(MIN_RIGHT_PAD, width - LABEL_WIDTH - MIN_BAR_LANE);
  const rightPad = Math.max(MIN_RIGHT_PAD, Math.min(desiredRightPad, maxAllowedRightPad));
  const available = Math.max(MIN_BAR_LANE, width - LABEL_WIDTH - rightPad);
  const labelMaxChars = Math.max(8, Math.floor((rightPad - LABEL_PAD_PX) / CHAR_PX));
  const chartHeight = TOP_PAD + rows.length * ROW_HEIGHT + BOTTOM_PAD;
  const truncated = totalChurnedFiles > rows.length;
  const subtitle = truncated
    ? `Showing top ${rows.length} of ${totalChurnedFiles.toLocaleString()} churned files. Sorted by commits, ties broken by file path.`
    : `${rows.length.toLocaleString()} churned file${rows.length === 1 ? '' : 's'}. Sorted by commits, ties broken by file path.`;

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <svg width={width} height={chartHeight} style={{ display: 'block' }}>
          {rows.map((row, i) => {
            const y = TOP_PAD + i * ROW_HEIGHT;
            const barTop = y + (ROW_HEIGHT - BAR_HEIGHT) / 2;
            const barWidth = Math.max(2, (row.commitCount / maxCommits) * available);
            const isSelected = selectedFile === row.file;
            const color = fillFor(row.category, isSelected ? 0.9 : 0.7);
            const trailingLabel = truncateToFit(
              `${row.commitCount.toLocaleString()} commits`,
              labelMaxChars,
            );

            return (
              <g
                key={row.file}
                onClick={() => onSelectFile(row.file)}
                style={{ cursor: 'pointer' }}
                onMouseEnter={(evt) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setTooltip({ x: evt.clientX - rect.left, y: evt.clientY - rect.top, row });
                }}
                onMouseMove={(evt) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setTooltip((prev) =>
                    prev
                      ? { ...prev, x: evt.clientX - rect.left, y: evt.clientY - rect.top }
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
                  fill={isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)'}
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
                  stroke={isSelected ? 'var(--accent-primary)' : 'transparent'}
                  strokeWidth={isSelected ? 1 : 0}
                />
                <text
                  x={LABEL_WIDTH + available + 6}
                  y={barTop + BAR_HEIGHT / 2}
                  dominantBaseline="middle"
                  fontSize={10}
                  fontFamily="var(--font-mono)"
                  fill="var(--text-secondary)"
                  style={{ pointerEvents: 'none' }}
                >
                  {trailingLabel}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <HeroCaption
        primary="One row per file · bar = commit count · color = churn category"
        subtitle={subtitle}
      />
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.x + 12,
            top: tooltip.y - 8,
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-primary)',
            borderRadius: 4,
            padding: '6px 10px',
            fontSize: 10,
            color: 'var(--text-primary)',
            pointerEvents: 'none',
            zIndex: 20,
            maxWidth: 320,
            wordBreak: 'break-all',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{tooltip.row.file}</div>
          <div style={{ color: 'var(--text-secondary)' }}>
            {tooltip.row.commitCount.toLocaleString()} commit
            {tooltip.row.commitCount === 1 ? '' : 's'}
          </div>
          <div
            style={{
              color: fillFor(tooltip.row.category, 1),
              marginTop: 2,
              textTransform: 'capitalize',
            }}
          >
            {tooltip.row.category}
          </div>
        </div>
      )}
    </div>
  );
}
