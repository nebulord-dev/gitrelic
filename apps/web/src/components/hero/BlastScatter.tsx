import { useEffect, useMemo, useRef, useState } from 'react';

import { scaleLinear } from 'd3-scale';

import type { GitrelicReport } from '@gitrelic/core';

export type BlastTier = 'low' | 'medium' | 'high' | 'critical';

export interface BlastPoint {
  file: string;
  x: number;
  y: number;
  tier: BlastTier;
}

export interface BlastData {
  points: BlastPoint[];
  xMax: number;
  yMax: number;
}

export function blastTierFor(blastScore: number): BlastTier {
  if (blastScore < 25) return 'low';
  if (blastScore < 50) return 'medium';
  if (blastScore <= 75) return 'high';
  return 'critical';
}

export function prepareBlastData(report: GitrelicReport): BlastData {
  const points: BlastPoint[] = report.blastRadius.files.map((f) => ({
    file: f.file,
    x: f.blastScore,
    y: f.avgCoChangedFiles,
    tier: blastTierFor(f.blastScore),
  }));

  let xMax = 0;
  let yMax = 0;
  for (const p of points) {
    if (p.x > xMax) xMax = p.x;
    if (p.y > yMax) yMax = p.y;
  }
  return { points, xMax, yMax };
}

const TIER_COLORS: Record<BlastTier, string> = {
  low: 'var(--severity-healthy)',
  medium: 'var(--severity-warning)',
  high: '#d27b22',
  critical: 'var(--severity-critical)',
};

interface BlastScatterProps {
  report: GitrelicReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

const PADDING = { top: 24, right: 20, bottom: 40, left: 56 };
const CASCADE_SCORE_THRESHOLD = 75;

export function BlastScatter({ report, selectedFile, onSelectFile }: BlastScatterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: BlastPoint } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { points, xMax, yMax } = useMemo(() => prepareBlastData(report), [report]);

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
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-tertiary)',
          fontSize: 12,
        }}
      >
        No blast-radius data available.
      </div>
    );
  }

  // Cascade-risk zone: blastScore > 75 AND avgCoChangedFiles > median
  const sortedY = [...points].sort((a, b) => a.y - b.y);
  const medianY = sortedY[Math.floor(sortedY.length / 2)].y;
  const cascadeXStart = xScale(CASCADE_SCORE_THRESHOLD);
  const cascadeYEnd = yScale(medianY);
  const showCascadeZone = xMax > CASCADE_SCORE_THRESHOLD;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={dims.width} height={dims.height}>
        <g transform={`translate(${PADDING.left},${PADDING.top})`}>
          {/* Cascade-risk zone shading */}
          {showCascadeZone && cascadeXStart < plotW && (
            <>
              <rect
                x={cascadeXStart}
                y={0}
                width={plotW - cascadeXStart}
                height={cascadeYEnd}
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
                cascade risk
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
            Blast score
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
            Avg co-changed files
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
                style={{ cursor: 'pointer' }}
              />
            );
          })}
        </g>

        {/* Tier legend */}
        {(['low', 'medium', 'high', 'critical'] as const).map((tier, i) => (
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
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{tooltip.point.file}</div>
          <div style={{ color: 'var(--text-secondary)' }}>
            Blast {tooltip.point.x} · {tooltip.point.y.toFixed(1)} avg co-changed
          </div>
          <div
            style={{
              color: TIER_COLORS[tooltip.point.tier],
              marginTop: 2,
              textTransform: 'capitalize',
            }}
          >
            {tooltip.point.tier}
          </div>
        </div>
      )}
    </div>
  );
}
