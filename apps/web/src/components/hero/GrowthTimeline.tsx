import { useEffect, useMemo, useRef, useState } from 'react';

import { scaleLinear, scalePoint } from 'd3-scale';
import { area as d3Area, line as d3Line, curveMonotoneX } from 'd3-shape';

import type { FileComplexityTrend, GitrelicReport } from '@gitrelic/core';

interface GrowthTimelineProps {
  report: GitrelicReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

const PADDING = { top: 20, right: 120, bottom: 40, left: 55 };

const SERIES_COLORS = [
  'rgba(248, 81, 73, 0.8)',
  'rgba(210, 153, 34, 0.8)',
  'rgba(88, 166, 255, 0.8)',
  'rgba(163, 113, 247, 0.8)',
  'rgba(63, 185, 80, 0.8)',
  'rgba(255, 159, 67, 0.8)',
  'rgba(255, 99, 132, 0.8)',
  'rgba(54, 162, 235, 0.8)',
  'rgba(255, 206, 86, 0.8)',
  'rgba(75, 192, 192, 0.8)',
];

function truncateFilename(file: string, maxLen = 18): string {
  const basename = file.split('/').pop() ?? file;
  if (basename.length <= maxLen) return basename;
  return '\u2026' + basename.slice(-(maxLen - 1));
}

interface TooltipState {
  x: number;
  y: number;
  file: string;
  growthRate: number;
}

interface BucketPoint {
  month: string;
  cumulative: number;
}

export function GrowthTimeline({ report, selectedFile, onSelectFile }: GrowthTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });
  const [hoveredSeries, setHoveredSeries] = useState<string | null>(null);
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

  const files: FileComplexityTrend[] = useMemo(
    () => report.complexityTrend.growingFiles.slice(0, 10),
    [report],
  );

  const { months, xScale, yScale } = useMemo(() => {
    const plotW = dims.width - PADDING.left - PADDING.right;
    const plotH = dims.height - PADDING.top - PADDING.bottom;

    const monthSet = new Set<string>();
    for (const f of files) {
      for (const b of f.buckets) {
        monthSet.add(b.month);
      }
    }

    const sortedMonths = Array.from(monthSet).sort();

    const yMax = Math.max(1, ...files.flatMap((f) => f.buckets.map((b) => Math.abs(b.cumulative))));

    return {
      months: sortedMonths,
      xScale: scalePoint<string>().domain(sortedMonths).range([0, plotW]),
      yScale: scaleLinear().domain([0, yMax]).range([plotH, 0]),
    };
  }, [files, dims.width, dims.height]);

  const plotW = dims.width - PADDING.left - PADDING.right;
  const plotH = dims.height - PADDING.top - PADDING.bottom;

  const tickInterval = Math.max(1, Math.ceil(months.length / 10));

  const lineGen = useMemo(
    () =>
      d3Line<BucketPoint>()
        .x((d) => xScale(d.month) ?? 0)
        .y((d) => yScale(d.cumulative))
        .curve(curveMonotoneX),
    [xScale, yScale],
  );

  const areaGen = useMemo(
    () =>
      d3Area<BucketPoint>()
        .x((d) => xScale(d.month) ?? 0)
        .y0(plotH)
        .y1((d) => yScale(d.cumulative))
        .curve(curveMonotoneX),
    [xScale, yScale, plotH],
  );

  const yTicks = yScale.ticks(5);

  if (files.length === 0) {
    return (
      <div className="text-text-tertiary p-5 text-xs">
        No growing files detected in this repository.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <svg width={dims.width} height={dims.height}>
        <g transform={`translate(${PADDING.left},${PADDING.top})`}>
          {/* Horizontal grid lines */}
          {yTicks.map((tick) => (
            <line
              key={`grid-${tick}`}
              x1={0}
              y1={yScale(tick)}
              x2={plotW}
              y2={yScale(tick)}
              stroke="var(--border-primary)"
              strokeOpacity={0.3}
            />
          ))}

          {/* Area fills */}
          {files.map((file, i) => {
            const color = SERIES_COLORS[i % SERIES_COLORS.length];
            const isHovered = hoveredSeries === file.file;
            const dimOthers = hoveredSeries !== null;
            const areaOpacity = dimOthers ? (isHovered ? 0.25 : 0.04) : 0.12;
            const areaPath = areaGen(file.buckets);
            if (!areaPath) return null;
            return (
              <path
                key={`area-${file.file}`}
                d={areaPath}
                fill={color}
                fillOpacity={areaOpacity}
                pointerEvents="none"
              />
            );
          })}

          {/* Lines */}
          {files.map((file, i) => {
            const color = SERIES_COLORS[i % SERIES_COLORS.length];
            const isHovered = hoveredSeries === file.file;
            const isSelected = selectedFile === file.file;
            const dimOthers = hoveredSeries !== null;
            const strokeOpacity = dimOthers ? (isHovered ? 1 : 0.2) : 0.85;
            const strokeWidth = isHovered || isSelected ? 2.5 : 1.5;
            const linePath = lineGen(file.buckets);
            if (!linePath) return null;
            return (
              <path
                key={`line-${file.file}`}
                d={linePath}
                fill="none"
                stroke={color}
                strokeOpacity={strokeOpacity}
                strokeWidth={strokeWidth}
                className="cursor-pointer"
                onClick={() => onSelectFile(file.file)}
                onMouseEnter={(e) => {
                  setHoveredSeries(file.file);
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect) {
                    setTooltip({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                      file: file.file,
                      growthRate: file.recentGrowthRate,
                    });
                  }
                }}
                onMouseLeave={() => {
                  setHoveredSeries(null);
                  setTooltip(null);
                }}
              />
            );
          })}

          {/* Y axis */}
          <line x1={0} y1={0} x2={0} y2={plotH} stroke="var(--border-primary)" />
          <text
            transform={`translate(-40,${plotH / 2}) rotate(-90)`}
            textAnchor="middle"
            fontSize={10}
            fill="var(--text-tertiary)"
          >
            Cumulative Net Lines
          </text>
          {yTicks.map((tick) => (
            <g key={`ytick-${tick}`} transform={`translate(0,${yScale(tick)})`}>
              <line x2={-4} stroke="var(--border-primary)" />
              <text
                x={-8}
                textAnchor="end"
                dominantBaseline="central"
                fontSize={8}
                fill="var(--text-tertiary)"
              >
                {tick >= 0 ? `+${tick}` : `${tick}`}
              </text>
            </g>
          ))}

          {/* X axis */}
          <line x1={0} y1={plotH} x2={plotW} y2={plotH} stroke="var(--border-primary)" />
          {months.map((month, mi) => {
            if (mi % tickInterval !== 0) return null;
            const x = xScale(month) ?? 0;
            return (
              <g key={`xtick-${month}`} transform={`translate(${x},${plotH})`}>
                <line y2={4} stroke="var(--border-primary)" />
                <text y={14} textAnchor="middle" fontSize={8} fill="var(--text-tertiary)">
                  {month}
                </text>
              </g>
            );
          })}

          {/* Legend (right side) */}
          <g transform={`translate(${plotW + 12}, 0)`}>
            {files.map((file, i) => {
              const color = SERIES_COLORS[i % SERIES_COLORS.length];
              const isSelected = selectedFile === file.file;
              const isHovered = hoveredSeries === file.file;
              const isActive = isSelected || isHovered;
              return (
                <g
                  key={`legend-${file.file}`}
                  transform={`translate(0, ${i * 18})`}
                  className="cursor-pointer"
                  onClick={() => onSelectFile(file.file)}
                  onMouseEnter={() => setHoveredSeries(file.file)}
                  onMouseLeave={() => setHoveredSeries(null)}
                >
                  <line
                    x1={0}
                    y1={5}
                    x2={12}
                    y2={5}
                    stroke={color}
                    strokeWidth={isActive ? 2.5 : 1.5}
                  />
                  <text
                    x={16}
                    y={9}
                    fontSize={9}
                    fill={isActive ? 'var(--text-primary)' : 'var(--text-secondary)'}
                    fontFamily="monospace"
                  >
                    {truncateFilename(file.file)}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute bg-surface-elevated border border-border-primary rounded px-2.5 py-[6px] text-[10px] text-text-primary pointer-events-none z-20 max-w-[320px]"
          style={{ left: tooltip.x + 14, top: tooltip.y - 8 }}
        >
          <div className="font-semibold mb-0.5 break-all font-mono">{tooltip.file}</div>
          <div className="text-text-secondary">
            +{Math.round(tooltip.growthRate)} lines/mo (recent avg)
          </div>
        </div>
      )}
    </div>
  );
}
