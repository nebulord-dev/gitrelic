import { useEffect, useMemo, useRef, useState } from 'react';
import { scaleLinear } from 'd3-scale';

import { HeroCaption } from '../shared/HeroCaption';
import type { GitrelicReport } from '@gitrelic/core';

interface ParallelTimelineProps {
  report: GitrelicReport;
}

const PADDING = { top: 28, right: 24, bottom: 44, left: 56 };
const BAR_GAP = 4;

// Color tint scale: more authors per parallel event → warmer color.
// 2 authors (the floor) starts at the healthy/warning boundary; 5+ saturates
// at critical. Pure interpolation between three CSS variables.
const TINT_STOPS = [
  { authors: 2.0, color: 'var(--severity-healthy)' },
  { authors: 3.0, color: 'var(--severity-warning)' },
  { authors: 5.0, color: 'var(--severity-critical)' },
];

function tintFor(avgAuthors: number): string {
  if (avgAuthors <= TINT_STOPS[0].authors) return TINT_STOPS[0].color;
  if (avgAuthors >= TINT_STOPS[TINT_STOPS.length - 1].authors)
    return TINT_STOPS[TINT_STOPS.length - 1].color;
  for (let i = 0; i < TINT_STOPS.length - 1; i++) {
    const a = TINT_STOPS[i];
    const b = TINT_STOPS[i + 1];
    if (avgAuthors >= a.authors && avgAuthors < b.authors) {
      // Fall back to the upper-bound color when in-between — the var()
      // tokens can't be linearly interpolated client-side without a paint
      // proxy, so we round to the nearest higher stop. Three-stop palette
      // keeps the resulting bar set visually distinct.
      return b.color;
    }
  }
  return TINT_STOPS[TINT_STOPS.length - 1].color;
}

export function ParallelTimeline({ report }: ParallelTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const months = report.parallelDev.byMonth;
  const maxEvents = useMemo(
    () =>
      months.reduce((m, b) => (b.parallelEvents > m ? b.parallelEvents : m), 0),
    [months],
  );

  const svgHeight = Math.max(120, dims.height - 56);
  const plotW = Math.max(40, dims.width - PADDING.left - PADDING.right);
  const plotH = Math.max(40, svgHeight - PADDING.top - PADDING.bottom);

  const yScale = useMemo(
    () =>
      scaleLinear()
        .domain([0, Math.max(maxEvents, 1)])
        .range([plotH, 0])
        .nice(4),
    [maxEvents, plotH],
  );

  const barWidth =
    months.length === 0
      ? 0
      : (plotW - BAR_GAP * Math.max(0, months.length - 1)) / months.length;

  if (months.length === 0) {
    return (
      <div ref={containerRef} className="w-full h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center text-text-tertiary text-xs">
          No parallel-dev events in the analyzed window.
        </div>
        <HeroCaption
          primary="Monthly bar chart · bar height = parallel events · color tint = avg author count"
          subtitle="No (file, week) pairs with 2+ distinct authors yet — every concurrent edit happens in disjoint weeks."
        />
      </div>
    );
  }

  const yTicks = yScale.ticks(4);
  // Show every Nth x-axis label when there are too many months — keeps
  // labels from colliding past ~24 months. Computed once per render rather
  // than re-derived inside the bar-label .map() callback.
  const labelEvery = months.length > 24 ? Math.ceil(months.length / 12) : 1;
  const hover =
    hoverIdx == null ? null : { idx: hoverIdx, bucket: months[hoverIdx] };

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col">
      <div className="flex-1 relative">
        <svg
          width={dims.width}
          height={svgHeight}
          role="img"
          aria-label={`Parallel-events monthly timeline across ${months.length} months. Bar height = parallel events that month, color tint = average authors per event.`}
        >
          <g transform={`translate(${PADDING.left},${PADDING.top})`}>
            <line
              x1={0}
              y1={0}
              x2={0}
              y2={plotH}
              stroke="var(--border-primary)"
            />
            <text
              transform={`translate(-40,${plotH / 2}) rotate(-90)`}
              textAnchor="middle"
              fontSize={10}
              fill="var(--text-tertiary)"
            >
              Events
            </text>
            {yTicks.map((tick) => (
              <g key={`y-${tick}`} transform={`translate(0,${yScale(tick)})`}>
                <line x2={-4} stroke="var(--border-primary)" />
                <line
                  x2={plotW}
                  stroke="var(--border-primary)"
                  strokeOpacity={0.15}
                />
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

            {months.map((b, i) => {
              const x = i * (barWidth + BAR_GAP);
              const y = yScale(b.parallelEvents);
              const h = plotH - y;
              const isHover = hoverIdx === i;
              const color = tintFor(b.avgAuthors);
              return (
                <g key={`bar-${b.month}`}>
                  <rect
                    className="parallel-timeline-bar cursor-default"
                    x={x}
                    y={y}
                    width={barWidth}
                    height={h}
                    fill={color}
                    fillOpacity={isHover ? 0.95 : 0.75}
                    stroke={color}
                    strokeOpacity={isHover ? 1 : 0}
                    onMouseEnter={() => setHoverIdx(i)}
                    onMouseLeave={() => setHoverIdx(null)}
                  />
                </g>
              );
            })}

            <line
              x1={0}
              y1={plotH}
              x2={plotW}
              y2={plotH}
              stroke="var(--border-primary)"
            />
            {months.map((b, i) => {
              if (i % labelEvery !== 0) return null;
              const x = i * (barWidth + BAR_GAP) + barWidth / 2;
              return (
                <g key={`x-${b.month}`} transform={`translate(${x},${plotH})`}>
                  <line y2={4} stroke="var(--border-primary)" />
                  <text
                    y={14}
                    textAnchor="middle"
                    fontSize={8}
                    fill="var(--text-tertiary)"
                  >
                    {b.month}
                  </text>
                </g>
              );
            })}
            <text
              x={plotW / 2}
              y={plotH + 32}
              textAnchor="middle"
              fontSize={10}
              fill="var(--text-tertiary)"
            >
              Month
            </text>
          </g>
        </svg>
        {hover && (
          <div
            className="absolute bg-tooltip-bg border border-border-primary rounded px-2.5 py-1.5 text-[10px] text-tooltip-text pointer-events-none z-20 whitespace-nowrap"
            style={{
              left:
                PADDING.left + hover.idx * (barWidth + BAR_GAP) + barWidth / 2,
              top: PADDING.top + yScale(hover.bucket.parallelEvents) - 8,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="font-semibold">{hover.bucket.month}</div>
            <div className="text-text-secondary">
              {hover.bucket.parallelEvents}{' '}
              {hover.bucket.parallelEvents === 1 ? 'event' : 'events'} ·{' '}
              {hover.bucket.uniqueFiles}{' '}
              {hover.bucket.uniqueFiles === 1 ? 'file' : 'files'}
            </div>
            <div className="text-text-tertiary mt-0.5">
              {hover.bucket.avgAuthors.toFixed(1)} avg authors / event
            </div>
          </div>
        )}
      </div>
      <HeroCaption
        primary="Monthly bar chart · bar height = parallel events · color tint = avg author count"
        subtitle="Is parallel-development pressure trending up or down? Are concurrent-edit weeks getting more crowded?"
      />
    </div>
  );
}
