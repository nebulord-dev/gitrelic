import { useEffect, useMemo, useRef, useState } from 'react';

import { scaleLinear } from 'd3-scale';

import { HeroCaption } from '../shared/HeroCaption';

import type { GitrelicReport } from '@gitrelic/core';

export type RewriteTier = 'low' | 'medium' | 'high' | 'critical';

export interface RewriteBucket {
  rangeStart: number;
  rangeEnd: number;
  count: number;
  tier: RewriteTier;
}

export interface RewriteHistogramData {
  buckets: RewriteBucket[];
  maxCount: number;
  totalFiles: number;
  highRewriteCount: number;
}

export const HIGH_REWRITE_THRESHOLD = 70;
const BUCKET_WIDTH = 10;
const BUCKET_COUNT = 10;

export function rewriteTierFor(rewriteScore: number): RewriteTier {
  if (rewriteScore < 25) return 'low';
  if (rewriteScore < 50) return 'medium';
  if (rewriteScore <= 75) return 'high';
  return 'critical';
}

export function prepareRewriteHistogramData(report: GitrelicReport): RewriteHistogramData {
  const buckets: RewriteBucket[] = Array.from({ length: BUCKET_COUNT }, (_, i) => {
    const rangeStart = i * BUCKET_WIDTH;
    const rangeEnd = i === BUCKET_COUNT - 1 ? 100 : rangeStart + BUCKET_WIDTH - 1;
    return {
      rangeStart,
      rangeEnd,
      count: 0,
      tier: rewriteTierFor(rangeStart + BUCKET_WIDTH / 2),
    };
  });

  let highRewriteCount = 0;
  for (const f of report.rewriteRatio.files) {
    const idx = Math.min(BUCKET_COUNT - 1, Math.max(0, Math.floor(f.rewriteScore / BUCKET_WIDTH)));
    buckets[idx].count++;
    if (f.rewriteScore >= HIGH_REWRITE_THRESHOLD) highRewriteCount++;
  }

  const maxCount = buckets.reduce((m, b) => (b.count > m ? b.count : m), 0);
  return {
    buckets,
    maxCount,
    totalFiles: report.rewriteRatio.files.length,
    highRewriteCount,
  };
}

const TIER_COLORS: Record<RewriteTier, string> = {
  low: 'var(--severity-healthy)',
  medium: 'var(--severity-warning)',
  high: '#d27b22',
  critical: 'var(--severity-critical)',
};

interface RewriteHistogramProps {
  report: GitrelicReport;
}

const PADDING = { top: 28, right: 24, bottom: 44, left: 56 };
const BAR_GAP = 4;

export function RewriteHistogram({ report }: RewriteHistogramProps) {
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

  const { buckets, maxCount, totalFiles, highRewriteCount } = useMemo(
    () => prepareRewriteHistogramData(report),
    [report],
  );

  // Reserve ~56px for the HeroCaption strip below so bars don't overlap it.
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
  // Snap the threshold marker to the left edge of the bucket that begins at
  // HIGH_REWRITE_THRESHOLD (e.g. bar 7 for the 70-79 bucket). A naive
  // `(HIGH_REWRITE_THRESHOLD / 100) * plotW` ignores BAR_GAP and lands a few
  // pixels short of the actual bar boundary.
  const thresholdBucketIdx = Math.floor(HIGH_REWRITE_THRESHOLD / BUCKET_WIDTH);
  const thresholdX = thresholdBucketIdx * (barWidth + BAR_GAP);

  if (totalFiles === 0) {
    return (
      <div ref={containerRef} className="w-full h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center text-text-tertiary text-xs">
          No rewrite-ratio data available.
        </div>
        <HeroCaption
          primary="10-bin histogram · bar height = file count · color = rewrite tier"
          subtitle="No rewrite-ratio signal in this repo. Either no insertions/deletions were detected or the analyzer hasn't run yet."
        />
      </div>
    );
  }

  const yTicks = yScale.ticks(4);
  const hover = hoverIdx == null ? null : { idx: hoverIdx, bucket: buckets[hoverIdx] };

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col">
      <div className="flex-1 relative">
        <svg
          width={dims.width}
          height={svgHeight}
          role="img"
          aria-label={`Rewrite-score distribution histogram across ${totalFiles} files. ${highRewriteCount} ${highRewriteCount === 1 ? 'file is' : 'files are'} at or above the high-rewrite threshold of ${HIGH_REWRITE_THRESHOLD}.`}
        >
          <g transform={`translate(${PADDING.left},${PADDING.top})`}>
            {/* High-rewrite threshold zone shading */}
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
              high rewrite (≥{HIGH_REWRITE_THRESHOLD}) · {highRewriteCount}{' '}
              {highRewriteCount === 1 ? 'file' : 'files'}
            </text>

            {/* Y axis */}
            <line x1={0} y1={0} x2={0} y2={plotH} stroke="var(--border-primary)" />
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
                <line x2={plotW} stroke="var(--border-primary)" strokeOpacity={0.15} />
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

            {/* Bars */}
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

            {/* X axis */}
            <line x1={0} y1={plotH} x2={plotW} y2={plotH} stroke="var(--border-primary)" />
            {buckets.map((b, i) => {
              const x = i * (barWidth + BAR_GAP) + barWidth / 2;
              return (
                <g key={`x-${b.rangeStart}`} transform={`translate(${x},${plotH})`}>
                  <line y2={4} stroke="var(--border-primary)" />
                  <text y={14} textAnchor="middle" fontSize={8} fill="var(--text-tertiary)">
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
              Rewrite score
            </text>
          </g>

          {/* Tier legend */}
          {(['low', 'medium', 'high', 'critical'] as const).map((tier, i) => (
            <g key={tier} transform={`translate(${PADDING.left + i * 80},${PADDING.top - 14})`}>
              <rect width={10} height={8} y={-6} fill={TIER_COLORS[tier]} fillOpacity={0.75} />
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
              left: PADDING.left + hover.idx * (barWidth + BAR_GAP) + barWidth / 2,
              top: PADDING.top + yScale(hover.bucket.count) - 8,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="font-semibold">
              Rewrite {hover.bucket.rangeStart}–{hover.bucket.rangeEnd}
            </div>
            <div className="text-text-secondary">
              {hover.bucket.count} {hover.bucket.count === 1 ? 'file' : 'files'}
            </div>
            <div className="mt-0.5 capitalize" style={{ color: TIER_COLORS[hover.bucket.tier] }}>
              {hover.bucket.tier}
            </div>
          </div>
        )}
      </div>
      <HeroCaption
        primary="10-bin histogram · bar height = file count · color = rewrite tier"
        subtitle="What's the shape of rewrite churn across the repo? How many files actually keep getting rewritten?"
      />
    </div>
  );
}
