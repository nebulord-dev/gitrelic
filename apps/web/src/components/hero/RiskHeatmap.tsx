import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { GitrelicReport } from '@gitrelic/core';

interface RiskHeatmapProps {
  report: GitrelicReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

interface RiskRow {
  file: string;
  label: string;
  churn: number;
  blast: number;
  shame: number;
  ghost: number;
  composite: number;
}

interface TooltipState {
  x: number;
  y: number;
  file: string;
  dimension: string;
  value: number;
}

const LABEL_WIDTH = 220;
const CELL_HEIGHT = 22;
const HEADER_HEIGHT = 30;
// Files with fewer commits than this are excluded — the shame metric saturates
// at 100 for any single commit containing a fix-flavored keyword, so low-N
// files would dominate the heatmap with effectively-binary signal.
const MIN_COMMITS = 3;
// Each dimension is intentionally orthogonal to bus-factor/ownership concentration —
// that's what the bar-chart hero is for. The heatmap surfaces files that hit
// multiple distinct risk axes at once.
const DIMENSIONS = ['Churn', 'Blast Radius', 'Shame', 'Ghost Risk'] as const;
const COMPOSITE_THRESHOLD = 30;

function cellColor(value: number): string {
  if (value >= 75) return 'rgba(248, 81, 73, 0.7)';
  if (value >= 50) return 'rgba(210, 153, 34, 0.5)';
  if (value >= 25) return 'rgba(88, 166, 255, 0.3)';
  return 'rgba(63, 185, 80, 0.2)';
}

// Show "{parent}/{basename}" so duplicate basenames in different directories
// (e.g. fixtures/.../server.node.js) are distinguishable. Falls back to just
// basename for files at the repo root, and ellipsis-truncates the parent side
// from the left when the combined label is too long.
export function truncateLabel(file: string, maxChars = 30): string {
  const segments = file.split('/').filter((s) => s.length > 0);
  if (segments.length === 0) return file;
  const basename = segments[segments.length - 1];
  if (segments.length === 1) {
    return basename.length <= maxChars ? basename : basename.slice(0, maxChars - 1) + '\u2026';
  }
  const parent = segments[segments.length - 2];
  const combined = `${parent}/${basename}`;
  if (combined.length <= maxChars) return combined;
  // Basename matters more than parent — if basename alone is too long, just
  // truncate it. Otherwise reserve 2 chars for "…/" and trim the parent.
  if (basename.length >= maxChars - 2) {
    return basename.slice(0, maxChars - 1) + '\u2026';
  }
  const parentBudget = maxChars - basename.length - 2;
  return `\u2026${parent.slice(parent.length - parentBudget)}/${basename}`;
}

export function prepareRiskRows(report: GitrelicReport): RiskRow[] {
  const churnFiles = report.churn?.files ?? [];
  const churnMap = new Map(churnFiles.map((c) => [c.file, c.churnScore]));
  const commitMap = new Map(churnFiles.map((c) => [c.file, c.commitCount]));
  const blastMap = new Map((report.blastRadius?.files ?? []).map((b) => [b.file, b.blastScore]));
  const shameMap = new Map((report.forensics?.files ?? []).map((f) => [f.file, f.shameScore]));
  const ghostSet = new Set((report.ghostFiles?.files ?? []).map((g) => g.file));

  // Iterate the bus-factor list because every tracked file gets an entry there;
  // it's effectively the universe of files we can score.
  const rows: RiskRow[] = [];
  for (const bf of report.busFactors.files) {
    if ((commitMap.get(bf.file) ?? 0) < MIN_COMMITS) continue;
    const churn = churnMap.get(bf.file) ?? 0;
    const blast = blastMap.get(bf.file) ?? 0;
    const shame = shameMap.get(bf.file) ?? 0;
    const ghost = ghostSet.has(bf.file) ? 100 : 0;
    const composite = churn * 0.3 + blast * 0.25 + shame * 0.25 + ghost * 0.2;
    if (composite < COMPOSITE_THRESHOLD) continue;

    rows.push({
      file: bf.file,
      label: truncateLabel(bf.file),
      churn,
      blast,
      shame,
      ghost,
      composite,
    });
  }

  rows.sort((a, b) => b.composite - a.composite);
  return rows.slice(0, 30);
}

const LEGEND_ITEMS = [
  { color: 'rgba(248, 81, 73, 0.7)', label: '≥75 Critical' },
  { color: 'rgba(210, 153, 34, 0.5)', label: '≥50 High' },
  { color: 'rgba(88, 166, 255, 0.3)', label: '≥25 Medium' },
  { color: 'rgba(63, 185, 80, 0.2)', label: '<25 Low' },
] as const;

export function RiskHeatmap({ report, selectedFile, onSelectFile }: RiskHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(700);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    observer.observe(scrollRef.current);
    return () => observer.disconnect();
  }, []);

  const rows = useMemo(() => prepareRiskRows(report), [report]);

  // Scroll the selected row into view when selection changes from outside —
  // mirrors the OwnershipBar behavior so all heroes feel consistent.
  useLayoutEffect(() => {
    if (!selectedFile || !scrollRef.current) return;
    const idx = rows.findIndex((r) => r.file === selectedFile);
    if (idx < 0) return;
    const rowTop = HEADER_HEIGHT + idx * CELL_HEIGHT;
    const rowBottom = rowTop + CELL_HEIGHT;
    const viewTop = scrollRef.current.scrollTop;
    const viewBottom = viewTop + scrollRef.current.clientHeight;
    if (rowTop < viewTop || rowBottom > viewBottom) {
      scrollRef.current.scrollTo({ top: Math.max(0, rowTop - 40), behavior: 'smooth' });
    }
  }, [selectedFile, rows]);

  const cellWidth = (width - LABEL_WIDTH) / 4;
  const svgHeight = HEADER_HEIGHT + rows.length * CELL_HEIGHT;

  function getDimValue(row: RiskRow, dim: (typeof DIMENSIONS)[number]): number {
    switch (dim) {
      case 'Churn':
        return row.churn;
      case 'Blast Radius':
        return row.blast;
      case 'Shame':
        return row.shame;
      case 'Ghost Risk':
        return row.ghost;
    }
  }

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
        {rows.length === 0 ? (
          <div style={{ color: 'var(--text-tertiary)', padding: 20, fontSize: 12 }}>
            No files exceed the risk threshold.
          </div>
        ) : (
          <svg width={width} height={svgHeight} style={{ display: 'block' }}>
            {/* Column headers */}
            <g>
              {DIMENSIONS.map((dim, di) => (
                <text
                  key={dim}
                  x={LABEL_WIDTH + di * cellWidth + cellWidth / 2}
                  y={18}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={600}
                  fill="var(--text-secondary)"
                >
                  {dim}
                </text>
              ))}
            </g>

            {/* Rows */}
            {rows.map((row, ri) => {
              const y = HEADER_HEIGHT + ri * CELL_HEIGHT;
              const isSelected = selectedFile === row.file;

              return (
                <g
                  key={row.file}
                  onClick={() => onSelectFile(row.file)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Row background for selected state */}
                  {isSelected && (
                    <rect
                      x={0}
                      y={y}
                      width={width}
                      height={CELL_HEIGHT}
                      fill="rgba(255,255,255,0.04)"
                    />
                  )}

                  {/* File label */}
                  <text
                    x={LABEL_WIDTH - 6}
                    y={y + CELL_HEIGHT / 2}
                    textAnchor="end"
                    dominantBaseline="central"
                    fontSize={10}
                    fontFamily="monospace"
                    fill={isSelected ? 'var(--text-primary)' : 'var(--text-secondary)'}
                  >
                    {row.label}
                  </text>

                  {/* Cells */}
                  {DIMENSIONS.map((dim, di) => {
                    const val = getDimValue(row, dim);
                    const cx = LABEL_WIDTH + di * cellWidth;

                    return (
                      <g key={dim}>
                        <rect
                          x={cx + 1}
                          y={y + 1}
                          width={cellWidth - 2}
                          height={CELL_HEIGHT - 2}
                          fill={cellColor(val)}
                          rx={2}
                          stroke={isSelected ? 'var(--accent-primary)' : 'transparent'}
                          strokeWidth={isSelected ? 1 : 0}
                          onMouseEnter={(e) => {
                            const rect = containerRef.current?.getBoundingClientRect();
                            if (rect) {
                              setTooltip({
                                x: e.clientX - rect.left,
                                y: e.clientY - rect.top,
                                file: row.file,
                                dimension: dim,
                                value: val,
                              });
                            }
                          }}
                          onMouseMove={(e) => {
                            const rect = containerRef.current?.getBoundingClientRect();
                            if (!rect) return;
                            setTooltip((prev) =>
                              prev
                                ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top }
                                : prev,
                            );
                          }}
                          onMouseLeave={() => setTooltip(null)}
                        />
                        <text
                          x={cx + cellWidth / 2}
                          y={y + CELL_HEIGHT / 2}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={9}
                          fill="rgba(255,255,255,0.9)"
                          pointerEvents="none"
                        >
                          {Math.round(val)}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Sticky caption + legend strip */}
      <div
        style={{
          flexShrink: 0,
          padding: '10px 16px',
          borderTop: '1px solid var(--border-primary)',
          background: 'var(--surface-primary)',
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Files scoring high across multiple risk axes · churn, blast radius, shame, ghost risk ·
          color = severity tier
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 14,
            marginTop: 6,
            fontSize: 10,
            color: 'var(--text-tertiary)',
          }}
        >
          {LEGEND_ITEMS.map(({ color, label }) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 10,
                  height: 10,
                  background: color,
                  borderRadius: 2,
                }}
              />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Tooltip */}
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
          }}
        >
          <div
            style={{
              fontWeight: 600,
              marginBottom: 2,
              fontFamily: 'var(--font-mono)',
              wordBreak: 'break-all',
            }}
          >
            {tooltip.file}
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>
            {tooltip.dimension}: {Math.round(tooltip.value)}
          </div>
        </div>
      )}
    </div>
  );
}
