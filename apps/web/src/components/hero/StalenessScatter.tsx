import { useEffect, useMemo, useRef, useState } from 'react';

import { scaleLinear } from 'd3-scale';

import type { GitrelicReport } from '@gitrelic/core';

export type StaleTier = 'fresh' | 'aging' | 'stale' | 'ancient';

export interface StalenessPoint {
  file: string;
  x: number;
  y: number;
  tier: StaleTier;
}

export interface StalenessData {
  points: StalenessPoint[];
  xMax: number;
  yMax: number;
}

export function staleTierFor(ageInDays: number): StaleTier {
  if (ageInDays < 30) return 'fresh';
  if (ageInDays < 180) return 'aging';
  if (ageInDays <= 365) return 'stale';
  return 'ancient';
}

export function prepareStalenessData(report: GitrelicReport): StalenessData {
  const points: StalenessPoint[] = report.deadCode.candidates.map((c) => ({
    file: c.file,
    x: c.ageInDays,
    y: c.loc,
    tier: staleTierFor(c.ageInDays),
  }));

  let xMax = 0;
  let yMax = 0;
  for (const p of points) {
    if (p.x > xMax) xMax = p.x;
    if (p.y > yMax) yMax = p.y;
  }
  return { points, xMax, yMax };
}

const TIER_COLORS: Record<StaleTier, string> = {
  fresh: 'var(--severity-healthy)',
  aging: 'var(--severity-warning)',
  stale: '#d27b22',
  ancient: 'var(--severity-critical)',
};

interface StalenessScatterProps {
  report: GitrelicReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

const PADDING = { top: 24, right: 20, bottom: 40, left: 56 };
const DANGER_AGE_THRESHOLD = 365;

export function StalenessScatter({ report, selectedFile, onSelectFile }: StalenessScatterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: StalenessPoint } | null>(
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

  const { points, xMax, yMax } = useMemo(() => prepareStalenessData(report), [report]);

  const plotW = Math.max(40, dims.width - PADDING.left - PADDING.right);
  const plotH = Math.max(40, dims.height - PADDING.top - PADDING.bottom);

  const { xScale, yScale } = useMemo(() => {
    return {
      xScale: scaleLinear()
        .domain([0, Math.max(xMax, 1)])
        .range([0, plotW]),
      yScale: scaleLinear()
        .domain([0, Math.max(yMax, 1)])
        .range([plotH, 0]),
    };
  }, [xMax, yMax, plotW, plotH]);

  if (points.length === 0) {
    return (
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center text-text-tertiary text-xs"
      >
        No dead-code candidates detected.
      </div>
    );
  }

  // Danger zone: x > 365 days AND y > median LOC of candidates
  const sortedY = [...points].sort((a, b) => a.y - b.y);
  const medianY = sortedY[Math.floor(sortedY.length / 2)].y;
  const dangerXStart = xScale(DANGER_AGE_THRESHOLD);
  const dangerYEnd = yScale(medianY);
  const showDangerZone = xMax > DANGER_AGE_THRESHOLD;

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg width={dims.width} height={dims.height}>
        <g transform={`translate(${PADDING.left},${PADDING.top})`}>
          {/* Danger zone shading */}
          {showDangerZone && dangerXStart < plotW && (
            <>
              <rect
                x={dangerXStart}
                y={0}
                width={plotW - dangerXStart}
                height={dangerYEnd}
                fill="var(--severity-critical)"
                fillOpacity={0.06}
              />
              <text
                x={plotW - 4}
                y={12}
                textAnchor="end"
                fontSize={9}
                fill="var(--severity-critical)"
                fillOpacity={0.7}
              >
                ancient + large
              </text>
            </>
          )}

          {/* X axis */}
          <line x1={0} y1={plotH} x2={plotW} y2={plotH} stroke="var(--border-primary)" />
          <text
            x={plotW / 2}
            y={plotH + 30}
            textAnchor="middle"
            fontSize={10}
            fill="var(--text-tertiary)"
          >
            Days since last commit
          </text>
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
            transform={`translate(-40,${plotH / 2}) rotate(-90)`}
            textAnchor="middle"
            fontSize={10}
            fill="var(--text-tertiary)"
          >
            Lines of Code
          </text>
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
            const cx = xScale(p.x);
            const cy = yScale(p.y);
            const isSelected = selectedFile === p.file;
            const color = TIER_COLORS[p.tier];

            return (
              <circle
                key={p.file}
                cx={cx}
                cy={cy}
                r={isSelected ? 7 : 5}
                fill={color}
                fillOpacity={isSelected ? 0.85 : 0.55}
                stroke={isSelected ? 'var(--accent-primary)' : color}
                strokeWidth={isSelected ? 2 : 1}
                onClick={() => onSelectFile(p.file)}
                onMouseEnter={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, point: p });
                }}
                onMouseLeave={() => setTooltip(null)}
                className="cursor-pointer"
              />
            );
          })}
        </g>

        {/* Tier legend */}
        {(['fresh', 'aging', 'stale', 'ancient'] as const).map((tier, i) => (
          <g key={tier} transform={`translate(${PADDING.left + i * 80},${PADDING.top - 10})`}>
            <circle cx={4} cy={0} r={4} fill={TIER_COLORS[tier]} fillOpacity={0.7} />
            <text x={12} y={3} fontSize={9} fill="var(--text-tertiary)">
              {tier}
            </text>
          </g>
        ))}
      </svg>
      {tooltip && (
        <div
          className="absolute bg-tooltip-bg border border-border-primary rounded px-[10px] py-[6px] text-[10px] text-tooltip-text pointer-events-none z-20 max-w-[320px] break-all"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
        >
          <div className="font-semibold mb-0.5">{tooltip.point.file}</div>
          <div className="text-text-secondary">
            {tooltip.point.x} day{tooltip.point.x === 1 ? '' : 's'} since last commit ·{' '}
            {tooltip.point.y} LOC
          </div>
          <div className="mt-0.5 capitalize" style={{ color: TIER_COLORS[tooltip.point.tier] }}>
            {tooltip.point.tier}
          </div>
        </div>
      )}
    </div>
  );
}
