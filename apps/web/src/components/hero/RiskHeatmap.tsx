import { useEffect, useMemo, useRef, useState } from 'react';

import type { GitrelicReport } from '@gitrelic/core';

interface RiskHeatmapProps {
  report: GitrelicReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

interface RiskRow {
  file: string;
  label: string;
  busFactor: number;
  ghost: number;
  knowledge: number;
  blast: number;
  composite: number;
}

interface TooltipState {
  x: number;
  y: number;
  file: string;
  dimension: string;
  value: number;
}

const LABEL_WIDTH = 140;
const CELL_HEIGHT = 22;
const HEADER_HEIGHT = 30;
const DIMENSIONS = ['Bus Factor', 'Ghost Risk', 'Knowledge', 'Blast Radius'] as const;

function cellColor(value: number): string {
  if (value >= 75) return 'rgba(248, 81, 73, 0.7)';
  if (value >= 50) return 'rgba(210, 153, 34, 0.5)';
  if (value >= 25) return 'rgba(88, 166, 255, 0.3)';
  return 'rgba(63, 185, 80, 0.2)';
}

function truncateLabel(file: string, maxChars = 18): string {
  const basename = file.split('/').pop() ?? file;
  if (basename.length <= maxChars) return basename;
  return basename.slice(0, maxChars - 1) + '\u2026';
}

const RISK_SCORE: Record<string, number> = {
  critical: 100,
  high: 75,
  medium: 50,
  low: 25,
};

export function prepareRiskRows(report: GitrelicReport): RiskRow[] {
  const ghostSet = new Set(report.ghostFiles.files.map((g) => g.file));
  const blastMap = new Map(report.blastRadius.files.map((b) => [b.file, b.blastScore]));

  const rows: RiskRow[] = [];

  for (const bf of report.busFactors.files) {
    const busFactor = RISK_SCORE[bf.risk] ?? 25;
    const ghost = ghostSet.has(bf.file) ? 100 : 0;
    const knowledge = bf.dominantAuthorPercent;
    const blast = blastMap.get(bf.file) ?? 0;
    const composite = busFactor * 0.35 + ghost * 0.25 + knowledge * 0.25 + blast * 0.15;

    if (composite < 30) continue;

    rows.push({
      file: bf.file,
      label: truncateLabel(bf.file),
      busFactor,
      ghost,
      knowledge,
      blast,
      composite,
    });
  }

  rows.sort((a, b) => b.composite - a.composite);
  return rows.slice(0, 30);
}

export function RiskHeatmap({ report, selectedFile, onSelectFile }: RiskHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 700, height: 400 });
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const rows = useMemo(() => prepareRiskRows(report), [report]);

  const cellWidth = (dims.width - LABEL_WIDTH) / 4;
  const svgHeight = HEADER_HEIGHT + rows.length * CELL_HEIGHT;

  function getDimValue(row: RiskRow, dim: (typeof DIMENSIONS)[number]): number {
    switch (dim) {
      case 'Bus Factor':
        return row.busFactor;
      case 'Ghost Risk':
        return row.ghost;
      case 'Knowledge':
        return row.knowledge;
      case 'Blast Radius':
        return row.blast;
    }
  }

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative', overflowY: 'auto' }}
    >
      {rows.length === 0 ? (
        <div style={{ color: 'var(--text-tertiary)', padding: 20, fontSize: 12 }}>
          No files exceed the risk threshold.
        </div>
      ) : (
        <svg width={dims.width} height={svgHeight} style={{ display: 'block' }}>
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
                    width={dims.width}
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
                        onMouseLeave={() => setTooltip(null)}
                      />
                      <text
                        x={cx + cellWidth / 2}
                        y={y + CELL_HEIGHT / 2}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={9}
                        fill={val >= 50 ? 'rgba(255,255,255,0.85)' : 'var(--text-tertiary)'}
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

          {/* Legend */}
          <g transform={`translate(${LABEL_WIDTH}, ${svgHeight - 0})`}></g>
        </svg>
      )}

      {/* Legend strip below the heatmap */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '6px 0 4px',
          marginLeft: LABEL_WIDTH,
          fontSize: 9,
          color: 'var(--text-tertiary)',
          flexShrink: 0,
        }}
      >
        {[
          { color: 'rgba(248, 81, 73, 0.7)', label: '≥75 Critical' },
          { color: 'rgba(210, 153, 34, 0.5)', label: '≥50 High' },
          { color: 'rgba(88, 166, 255, 0.3)', label: '≥25 Medium' },
          { color: 'rgba(63, 185, 80, 0.2)', label: '<25 Low' },
        ].map(({ color, label }) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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
