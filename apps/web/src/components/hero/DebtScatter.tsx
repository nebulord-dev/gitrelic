import { useEffect, useMemo, useRef, useState } from 'react';

import { scaleLinear } from 'd3-scale';

import type { GitloreReport } from '@gitlore/core';

interface DebtScatterProps {
  report: GitloreReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

interface DebtPoint {
  file: string;
  ageDays: number;
  rewriteScore: number;
  loc: number;
  churnTrend: string;
}

const PADDING = { top: 30, right: 20, bottom: 40, left: 55 };

function trendColor(trend: string, opacity: number): string {
  switch (trend) {
    case 'accelerating':
      return `rgba(248, 81, 73, ${opacity})`;
    case 'stable':
      return `rgba(210, 153, 34, ${opacity})`;
    case 'decelerating':
      return `rgba(63, 185, 80, ${opacity})`;
    default:
      return `rgba(88, 166, 255, ${opacity})`;
  }
}

function prepareDebtData(report: GitloreReport): DebtPoint[] {
  const ageMap = new Map<string, number>();
  for (const f of report.ageMap.files) {
    ageMap.set(f.file, f.ageInDays);
  }

  const locMap = new Map<string, number>();
  for (const f of report.loc.files) {
    locMap.set(f.file, f.lines);
  }

  const trendMap = new Map<string, string>();
  for (const f of report.churnVelocity.files) {
    trendMap.set(f.file, f.trend);
  }

  const points: DebtPoint[] = [];
  for (const f of report.rewriteRatio.files) {
    const ageDays = ageMap.get(f.file);
    const loc = locMap.get(f.file);
    if (ageDays == null || loc == null) continue;

    points.push({
      file: f.file,
      ageDays,
      rewriteScore: f.rewriteScore,
      loc,
      churnTrend: trendMap.get(f.file) ?? 'unknown',
    });
  }

  return points;
}

export function DebtScatter({ report, selectedFile, onSelectFile }: DebtScatterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: DebtPoint } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const points = useMemo(() => prepareDebtData(report), [report]);

  const plotW = dims.width - PADDING.left - PADDING.right;
  const plotH = dims.height - PADDING.top - PADDING.bottom;

  const { xScale, yScale, rScale } = useMemo(() => {
    const maxAge = Math.max(...points.map((p) => p.ageDays), 1);
    const maxRewrite = Math.max(...points.map((p) => p.rewriteScore), 1);
    const maxLoc = Math.max(...points.map((p) => p.loc), 1);

    return {
      xScale: scaleLinear().domain([0, maxAge]).range([0, plotW]),
      yScale: scaleLinear().domain([0, maxRewrite]).range([plotH, 0]),
      rScale: scaleLinear().domain([0, maxLoc]).range([3, 16]),
    };
  }, [points, plotW, plotH]);

  const midX = plotW / 2;
  const midY = plotH / 2;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={dims.width} height={dims.height}>
        <g transform={`translate(${PADDING.left},${PADDING.top})`}>
          {/* Quadrant labels */}
          <text x={4} y={12} textAnchor="start" fontSize={9} fill="rgba(255,255,255,0.10)">
            Active Churn
          </text>
          <text
            x={plotW - 4}
            y={12}
            textAnchor="end"
            fontSize={9}
            fontWeight={600}
            fill="rgba(255,255,255,0.15)"
          >
            Legacy Debt
          </text>
          <text x={4} y={plotH - 6} textAnchor="start" fontSize={9} fill="rgba(255,255,255,0.10)">
            Healthy
          </text>
          <text
            x={plotW - 4}
            y={plotH - 6}
            textAnchor="end"
            fontSize={9}
            fill="rgba(255,255,255,0.10)"
          >
            Stable Legacy
          </text>

          {/* Quadrant dividers */}
          <line
            x1={midX}
            y1={0}
            x2={midX}
            y2={plotH}
            stroke="var(--border-primary)"
            strokeDasharray="3,4"
            opacity={0.4}
          />
          <line
            x1={0}
            y1={midY}
            x2={plotW}
            y2={midY}
            stroke="var(--border-primary)"
            strokeDasharray="3,4"
            opacity={0.4}
          />

          {/* X axis */}
          <line x1={0} y1={plotH} x2={plotW} y2={plotH} stroke="var(--border-primary)" />
          <text
            x={plotW / 2}
            y={plotH + 30}
            textAnchor="middle"
            fontSize={10}
            fill="var(--text-tertiary)"
          >
            File Age (days)
          </text>

          {/* X axis ticks */}
          {xScale.ticks(5).map((tick) => (
            <g key={`x-${tick}`} transform={`translate(${xScale(tick)},${plotH})`}>
              <line y2={4} stroke="var(--border-primary)" />
              <text y={14} textAnchor="middle" fontSize={8} fill="var(--text-tertiary)">
                {tick}
              </text>
            </g>
          ))}

          {/* Y axis */}
          <line x1={0} y1={0} x2={0} y2={plotH} stroke="var(--border-primary)" />
          <text
            transform={`translate(-42,${plotH / 2}) rotate(-90)`}
            textAnchor="middle"
            fontSize={10}
            fill="var(--text-tertiary)"
          >
            Rewrite Score
          </text>

          {/* Y axis ticks */}
          {yScale.ticks(5).map((tick) => (
            <g key={`y-${tick}`} transform={`translate(0,${yScale(tick)})`}>
              <line x2={-4} stroke="var(--border-primary)" />
              <text
                x={-8}
                textAnchor="end"
                dominantBaseline="central"
                fontSize={8}
                fill="var(--text-tertiary)"
              >
                {tick}
              </text>
            </g>
          ))}

          {/* Data points */}
          {points.map((p) => {
            const cx = xScale(p.ageDays);
            const cy = yScale(p.rewriteScore);
            const r = rScale(p.loc);
            const isSelected = selectedFile === p.file;

            return (
              <circle
                key={p.file}
                cx={cx}
                cy={cy}
                r={r}
                fill={trendColor(p.churnTrend, 0.4)}
                stroke={isSelected ? 'var(--accent-primary)' : trendColor(p.churnTrend, 0.8)}
                strokeWidth={isSelected ? 2.5 : 1}
                onClick={() => onSelectFile(p.file)}
                onMouseEnter={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect) {
                    setTooltip({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                      point: p,
                    });
                  }
                }}
                onMouseLeave={() => setTooltip(null)}
                style={{ cursor: 'pointer' }}
              />
            );
          })}

          {/* Legend */}
          {(['accelerating', 'stable', 'decelerating'] as const).map((trend, i) => {
            const lx = plotW - 110;
            const ly = plotH - 58 + i * 18;
            return (
              <g key={trend} transform={`translate(${lx},${ly})`}>
                <circle
                  r={5}
                  fill={trendColor(trend, 0.5)}
                  stroke={trendColor(trend, 0.9)}
                  strokeWidth={1}
                />
                <text x={10} dominantBaseline="central" fontSize={8} fill="var(--text-secondary)">
                  {trend.charAt(0).toUpperCase() + trend.slice(1)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

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
              wordBreak: 'break-all',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {tooltip.point.file}
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>
            Age: {tooltip.point.ageDays}d · Rewrite: {tooltip.point.rewriteScore} · LOC:{' '}
            {tooltip.point.loc} · Trend: {tooltip.point.churnTrend}
          </div>
        </div>
      )}
    </div>
  );
}
