import { useEffect, useMemo, useRef, useState } from 'react';
import { scaleLinear } from 'd3-scale';

import { HeroCaption } from '../shared/HeroCaption';
import type { GitrelicReport } from '@gitrelic/core';

export type ParallelTier = 'low' | 'medium' | 'high' | 'critical';

export interface ParallelBucket {
  rangeStart: number;
  rangeEnd: number;
  count: number;
  tier: ParallelTier;
}

export interface ParallelHistogramData {
  buckets: ParallelBucket[];
  maxCount: number;
  totalFiles: number;
  highParallelCount: number;
}

export const HIGH_PARALLEL_THRESHOLD = 70;
const BUCKET_WIDTH = 10;
const BUCKET_COUNT = 10;

export function parallelTierFor(parallelScore: number): ParallelTier {
  if (parallelScore < 25) return 'low';
  if (parallelScore < 50) return 'medium';
  if (parallelScore < 75) return 'high';
  return 'critical';
}

export function prepareParallelHistogramData(
  report: GitrelicReport,
): ParallelHistogramData {
  const buckets: ParallelBucket[] = Array.from(
    { length: BUCKET_COUNT },
    (_, i) => {
      const rangeStart = i * BUCKET_WIDTH;
      const rangeEnd =
        i === BUCKET_COUNT - 1 ? 100 : rangeStart + BUCKET_WIDTH - 1;
      return {
        rangeStart,
        rangeEnd,
        count: 0,
        tier: parallelTierFor(rangeStart + BUCKET_WIDTH / 2),
      };
    },
  );

  let highParallelCount = 0;
  for (const f of report.parallelDev.files) {
    const idx = Math.min(
      BUCKET_COUNT - 1,
      Math.max(0, Math.floor(f.parallelScore / BUCKET_WIDTH)),
    );
    buckets[idx].count++;
    if (f.parallelScore >= HIGH_PARALLEL_THRESHOLD) highParallelCount++;
  }

  const maxCount = buckets.reduce((m, b) => (b.count > m ? b.count : m), 0);
  return {
    buckets,
    maxCount,
    totalFiles: report.parallelDev.files.length,
    highParallelCount,
  };
}

const TIER_COLORS: Record<ParallelTier, string> = {
  low: 'var(--severity-healthy)',
  medium: 'var(--severity-warning)',
  high: '#d27b22',
  critical: 'var(--severity-critical)',
};

interface ParallelScoreHistogramProps {
  report: GitrelicReport;
}

const PADDING = { top: 28, right: 24, bottom: 44, left: 56 };
const BAR_GAP = 4;

export function ParallelScoreHistogram({
  report,
}: ParallelScoreHistogramProps) {
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

  const { buckets, maxCount, totalFiles, highParallelCount } = useMemo(
    () => prepareParallelHistogramData(report),
    [report],
  );

  const svgHeight = Math.max(120, dims.height - 56);
  const plotW = Math.max(40, dims.width - PADDING.left - PADDING.right);
  const plotH = Math.max(40, svgHeight - PADDING.top - PADDING.bottom);

  const yScale = useMemo(
    () =>
      scaleLinear()
        .domain([0, Math.max(maxCount, 1)])
        .range([plotH, 0])
        .nice(4),
    [maxCount, plotH],
  );

  const barWidth = (plotW - BAR_GAP * (buckets.length - 1)) / buckets.length;
  const thresholdBucketIdx = Math.floor(HIGH_PARALLEL_THRESHOLD / BUCKET_WIDTH);
  const thresholdX = thresholdBucketIdx * (barWidth + BAR_GAP);

  if (totalFiles === 0) {
    return (
      <div ref={containerRef} className="w-full h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center text-text-tertiary text-xs">
          No parallel-dev data available.
        </div>
        <HeroCaption
          primary="10-bin histogram · bar height = file count · color = parallel-dev tier (low/medium/high/critical)"
          subtitle="No concurrency signal in this repo. Either every file is owned by a single author week-to-week, or the analyzer hasn't run yet."
        />
      </div>
    );
  }

  const yTicks = yScale.ticks(4);
  const hover =
    hoverIdx == null ? null : { idx: hoverIdx, bucket: buckets[hoverIdx] };

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col">
      <div className="flex-1 relative">
        <svg
          width={dims.width}
          height={svgHeight}
          role="img"
          aria-label={`Parallel-score distribution histogram across ${totalFiles} files. ${highParallelCount} ${highParallelCount === 1 ? 'file is' : 'files are'} at or above the high-parallel threshold of ${HIGH_PARALLEL_THRESHOLD}.`}
        >
          <g transform={`translate(${PADDING.left},${PADDING.top})`}>
            <rect
              x={thresholdX}
              y={0}
              width={Math.max(0, plotW - thresholdX)}
              height={plotH}
              fill="var(--severity-critical)"
              fillOpacity={0.06}
            />
            <line
              x1={thresholdX}
              y1={0}
              x2={thresholdX}
              y2={plotH}
              stroke="var(--severity-critical)"
              strokeOpacity={0.5}
              strokeDasharray="3 3"
            />
            <text
              x={thresholdX + 6}
              y={12}
              fontSize={9}
              fill="var(--severity-critical)"
              fillOpacity={0.8}
            >
              high parallel (≥{HIGH_PARALLEL_THRESHOLD}) · {highParallelCount}{' '}
              {highParallelCount === 1 ? 'file' : 'files'}
            </text>

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
              Files
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

            {buckets.map((b, i) => {
              const x = i * (barWidth + BAR_GAP);
              const y = yScale(b.count);
              const h = plotH - y;
              const isHover = hoverIdx === i;
              const color = TIER_COLORS[b.tier];
              return (
                <g key={`bar-${b.rangeStart}`}>
                  <rect
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
                    className="cursor-default"
                  />
                  {b.count > 0 && (
                    <text
                      x={x + barWidth / 2}
                      y={y - 4}
                      textAnchor="middle"
                      fontSize={9}
                      fill="var(--text-secondary)"
                    >
                      {b.count}
                    </text>
                  )}
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
            {buckets.map((b, i) => {
              const x = i * (barWidth + BAR_GAP) + barWidth / 2;
              return (
                <g
                  key={`x-${b.rangeStart}`}
                  transform={`translate(${x},${plotH})`}
                >
                  <line y2={4} stroke="var(--border-primary)" />
                  <text
                    y={14}
                    textAnchor="middle"
                    fontSize={8}
                    fill="var(--text-tertiary)"
                  >
                    {b.rangeStart}
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
              Parallel score
            </text>
          </g>

          {(['low', 'medium', 'high', 'critical'] as const).map((tier, i) => (
            <g
              key={tier}
              transform={`translate(${PADDING.left + i * 80},${PADDING.top - 14})`}
            >
              <rect
                width={10}
                height={8}
                y={-6}
                fill={TIER_COLORS[tier]}
                fillOpacity={0.75}
              />
              <text x={14} y={2} fontSize={9} fill="var(--text-tertiary)">
                {tier}
              </text>
            </g>
          ))}
        </svg>
        {hover && (
          <div
            className="absolute bg-tooltip-bg border border-border-primary rounded px-2.5 py-1.5 text-[10px] text-tooltip-text pointer-events-none z-20 whitespace-nowrap"
            style={{
              left:
                PADDING.left + hover.idx * (barWidth + BAR_GAP) + barWidth / 2,
              top: PADDING.top + yScale(hover.bucket.count) - 8,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="font-semibold">
              Parallel {hover.bucket.rangeStart}–{hover.bucket.rangeEnd}
            </div>
            <div className="text-text-secondary">
              {hover.bucket.count} {hover.bucket.count === 1 ? 'file' : 'files'}
            </div>
            <div
              className="mt-0.5 capitalize"
              style={{ color: TIER_COLORS[hover.bucket.tier] }}
            >
              {hover.bucket.tier}
            </div>
          </div>
        )}
      </div>
      <HeroCaption
        primary="10-bin histogram · bar height = file count · color = parallel-dev tier (low/medium/high/critical)"
        subtitle="What's the shape of concurrency risk across the repo? Which files cross the high-parallel threshold?"
      />
    </div>
  );
}
