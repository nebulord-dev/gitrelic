import { useEffect, useMemo, useRef, useState } from 'react';

import { scaleLinear } from 'd3-scale';

import type { GitrelicReport } from '@gitrelic/core';

export type BlastTier = 'low' | 'medium' | 'high' | 'critical';

export interface BlastBucket {
  rangeStart: number;
  rangeEnd: number;
  count: number;
  tier: BlastTier;
}

export interface BlastHistogramData {
  buckets: BlastBucket[];
  maxCount: number;
  totalFiles: number;
  highBlastCount: number;
}

export const HIGH_BLAST_THRESHOLD = 70;
const BUCKET_WIDTH = 10;
const BUCKET_COUNT = 10;

export function blastTierFor(blastScore: number): BlastTier {
  if (blastScore < 25) return 'low';
  if (blastScore < 50) return 'medium';
  if (blastScore <= 75) return 'high';
  return 'critical';
}

export function prepareBlastHistogramData(report: GitrelicReport): BlastHistogramData {
  const buckets: BlastBucket[] = Array.from({ length: BUCKET_COUNT }, (_, i) => {
    const rangeStart = i * BUCKET_WIDTH;
    const rangeEnd = i === BUCKET_COUNT - 1 ? 100 : rangeStart + BUCKET_WIDTH - 1;
    return {
      rangeStart,
      rangeEnd,
      count: 0,
      tier: blastTierFor(rangeStart + BUCKET_WIDTH / 2),
    };
  });

  let highBlastCount = 0;
  for (const f of report.blastRadius.files) {
    const idx = Math.min(BUCKET_COUNT - 1, Math.max(0, Math.floor(f.blastScore / BUCKET_WIDTH)));
    buckets[idx].count++;
    if (f.blastScore >= HIGH_BLAST_THRESHOLD) highBlastCount++;
  }

  const maxCount = buckets.reduce((m, b) => (b.count > m ? b.count : m), 0);
  return {
    buckets,
    maxCount,
    totalFiles: report.blastRadius.files.length,
    highBlastCount,
  };
}

const TIER_COLORS: Record<BlastTier, string> = {
  low: 'var(--severity-healthy)',
  medium: 'var(--severity-warning)',
  high: '#d27b22',
  critical: 'var(--severity-critical)',
};

interface BlastHistogramProps {
  report: GitrelicReport;
}

const PADDING = { top: 28, right: 24, bottom: 44, left: 56 };
const BAR_GAP = 4;

export function BlastHistogram({ report }: BlastHistogramProps) {
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

  const { buckets, maxCount, totalFiles, highBlastCount } = useMemo(
    () => prepareBlastHistogramData(report),
    [report],
  );

  const plotW = Math.max(40, dims.width - PADDING.left - PADDING.right);
  const plotH = Math.max(40, dims.height - PADDING.top - PADDING.bottom);

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
  // HIGH_BLAST_THRESHOLD (e.g. bar 7 for the 70-79 bucket). A naive
  // `(HIGH_BLAST_THRESHOLD / 100) * plotW` ignores BAR_GAP and lands a few
  // pixels short of the actual bar boundary.
  const thresholdBucketIdx = Math.floor(HIGH_BLAST_THRESHOLD / BUCKET_WIDTH);
  const thresholdX = thresholdBucketIdx * (barWidth + BAR_GAP);

  if (totalFiles === 0) {
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

  const yTicks = yScale.ticks(4);
  const hover = hoverIdx == null ? null : { idx: hoverIdx, bucket: buckets[hoverIdx] };

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg
        width={dims.width}
        height={dims.height}
        role="img"
        aria-label={`Blast-score distribution histogram across ${totalFiles} files. ${highBlastCount} ${highBlastCount === 1 ? 'file is' : 'files are'} at or above the high-blast threshold of ${HIGH_BLAST_THRESHOLD}.`}
      >
        <g transform={`translate(${PADDING.left},${PADDING.top})`}>
          {/* High-blast threshold zone shading */}
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
            high blast (≥{HIGH_BLAST_THRESHOLD}) · {highBlastCount}{' '}
            {highBlastCount === 1 ? 'file' : 'files'}
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
                  style={{ cursor: 'default' }}
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
            Blast score
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
          style={{
            position: 'absolute',
            left: PADDING.left + hover.idx * (barWidth + BAR_GAP) + barWidth / 2,
            top: PADDING.top + yScale(hover.bucket.count) - 8,
            transform: 'translate(-50%, -100%)',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-primary)',
            borderRadius: 4,
            padding: '6px 10px',
            fontSize: 10,
            color: 'var(--text-primary)',
            pointerEvents: 'none',
            zIndex: 20,
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ fontWeight: 600 }}>
            Blast {hover.bucket.rangeStart}–{hover.bucket.rangeEnd}
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>
            {hover.bucket.count} {hover.bucket.count === 1 ? 'file' : 'files'}
          </div>
          <div
            style={{
              color: TIER_COLORS[hover.bucket.tier],
              marginTop: 2,
              textTransform: 'capitalize',
            }}
          >
            {hover.bucket.tier}
          </div>
        </div>
      )}
    </div>
  );
}
