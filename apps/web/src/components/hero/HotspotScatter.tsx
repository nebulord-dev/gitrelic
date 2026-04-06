import { useEffect, useMemo, useRef, useState } from 'react';

import { scaleLinear } from 'd3-scale';

import { categoryColor } from '../../utils/colors';

import type { GitloreReport } from '@gitlore/core';

interface HotspotScatterProps {
  report: GitloreReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

export interface ScatterPoint {
  file: string;
  churn: number;
  loc: number;
  hotspotScore: number;
  category: string;
}

const PADDING = { top: 20, right: 20, bottom: 40, left: 50 };

export function prepareScatterData(report: GitloreReport): ScatterPoint[] {
  const locMap = new Map<string, number>();
  for (const f of report.loc.files) {
    locMap.set(f.file, f.lines);
  }

  const hotspotMap = new Map<string, { score: number; category: string }>();
  for (const h of report.hotspots.files) {
    hotspotMap.set(h.file, { score: h.hotspotScore, category: h.category });
  }

  const points: ScatterPoint[] = [];
  for (const c of report.churn.files) {
    const loc = locMap.get(c.file);
    const hotspot = hotspotMap.get(c.file);
    if (loc == null || !hotspot) continue;

    points.push({
      file: c.file,
      churn: c.commitCount,
      loc,
      hotspotScore: hotspot.score,
      category: hotspot.category,
    });
  }

  return points;
}

export function HotspotScatter({ report, selectedFile, onSelectFile }: HotspotScatterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const points = useMemo(() => prepareScatterData(report), [report]);

  const { xScale, yScale, rScale } = useMemo(() => {
    const w = dims.width - PADDING.left - PADDING.right;
    const h = dims.height - PADDING.top - PADDING.bottom;
    const maxChurn = Math.max(...points.map((p) => p.churn), 1);
    const maxLoc = Math.max(...points.map((p) => p.loc), 1);
    const maxScore = Math.max(...points.map((p) => p.hotspotScore), 1);

    return {
      xScale: scaleLinear().domain([0, maxChurn]).range([0, w]),
      yScale: scaleLinear().domain([0, maxLoc]).range([h, 0]),
      rScale: scaleLinear().domain([0, maxScore]).range([3, 18]),
    };
  }, [points, dims.width, dims.height]);

  const plotW = dims.width - PADDING.left - PADDING.right;
  const plotH = dims.height - PADDING.top - PADDING.bottom;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={dims.width} height={dims.height}>
        <g transform={`translate(${PADDING.left},${PADDING.top})`}>
          {/* Quadrant hint */}
          <text x={plotW - 4} y={4} textAnchor="end" fontSize={9} fill="rgba(255,255,255,0.12)">
            high churn + high complexity
          </text>

          {/* X axis */}
          <line x1={0} y1={plotH} x2={plotW} y2={plotH} stroke="var(--border-primary)" />
          <text
            x={plotW / 2}
            y={plotH + 30}
            textAnchor="middle"
            fontSize={10}
            fill="var(--text-tertiary)"
          >
            Churn (commits)
          </text>

          {/* Y axis */}
          <line x1={0} y1={0} x2={0} y2={plotH} stroke="var(--border-primary)" />
          <text
            transform={`translate(-35,${plotH / 2}) rotate(-90)`}
            textAnchor="middle"
            fontSize={10}
            fill="var(--text-tertiary)"
          >
            Lines of Code
          </text>

          {/* Data points */}
          {points.map((p) => {
            const cx = xScale(p.churn);
            const cy = yScale(p.loc);
            const r = rScale(p.hotspotScore);
            const isSelected = selectedFile === p.file;

            return (
              <circle
                key={p.file}
                cx={cx}
                cy={cy}
                r={r}
                fill={categoryColor(p.category, 0.4)}
                stroke={isSelected ? 'var(--accent-primary)' : categoryColor(p.category, 0.7)}
                strokeWidth={isSelected ? 2.5 : 1}
                onClick={() => onSelectFile(p.file)}
                style={{ cursor: 'pointer' }}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
