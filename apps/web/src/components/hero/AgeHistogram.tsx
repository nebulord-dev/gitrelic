import { useEffect, useMemo, useRef, useState } from 'react';
import { scaleLinear } from 'd3-scale';

import { HeroCaption } from '../shared/HeroCaption';
import type { AgeMapReport, GitrelicReport } from '@gitrelic/core';

export type AgeTier = 'fresh' | 'aging' | 'stale' | 'ancient';

export interface AgeBin {
  rangeStart: number;
  rangeEnd: number; // inclusive; Infinity for the overflow bin
  count: number;
  tier: AgeTier;
  isOverflow: boolean;
}

export interface AgeHistogramData {
  bins: AgeBin[];
  maxCount: number;
  totalFiles: number;
  ancientCount: number;
  staleLimit: number;
}

const BIN_WIDTH = 30;
const MAX_INRANGE_DAYS = 540; // 18 monthly bins
const PADDING = { top: 28, right: 24, bottom: 44, left: 56 };
const BAR_GAP = 4;

export function ageTierFor(
  ageInDays: number,
  thresholds: AgeMapReport['thresholds'],
): AgeTier {
  if (ageInDays <= thresholds.freshLimit) return 'fresh';
  if (ageInDays <= thresholds.agingLimit) return 'aging';
  if (ageInDays <= thresholds.staleLimit) return 'stale';
  return 'ancient';
}

export function prepareAgeHistogramData(
  report: GitrelicReport,
): AgeHistogramData {
  const repoAgeDays = report.meta.ageInDays;
  const thresholds = report.ageMap.thresholds;
  const files = report.ageMap.files;

  if (repoAgeDays === 0) {
    return {
      bins: [],
      maxCount: 0,
      totalFiles: files.length,
      ancientCount: report.ageMap.ancientFiles.length,
      staleLimit: thresholds.staleLimit,
    };
  }

  const inRangeDays = Math.min(repoAgeDays, MAX_INRANGE_DAYS);
  const inRangeBins = Math.max(1, Math.ceil(inRangeDays / BIN_WIDTH));
  const hasOverflow = repoAgeDays > MAX_INRANGE_DAYS;
  const totalBins = inRangeBins + (hasOverflow ? 1 : 0);

  const bins: AgeBin[] = Array.from({ length: totalBins }, (_, i) => {
    const isOverflow = hasOverflow && i === totalBins - 1;
    const rangeStart = i * BIN_WIDTH;
    const rangeEnd = isOverflow ? Infinity : rangeStart + BIN_WIDTH - 1;
    const midpoint = isOverflow ? MAX_INRANGE_DAYS : rangeStart + BIN_WIDTH / 2;
    return {
      rangeStart,
      rangeEnd,
      count: 0,
      tier: ageTierFor(midpoint, thresholds),
      isOverflow,
    };
  });

  for (const file of files) {
    let idx: number;
    if (hasOverflow && file.ageInDays >= MAX_INRANGE_DAYS) {
      idx = totalBins - 1;
    } else {
      idx = Math.min(inRangeBins - 1, Math.floor(file.ageInDays / BIN_WIDTH));
    }
    bins[idx].count++;
  }

  const maxCount = bins.reduce((m, b) => (b.count > m ? b.count : m), 0);
  return {
    bins,
    maxCount,
    totalFiles: files.length,
    ancientCount: report.ageMap.ancientFiles.length,
    staleLimit: thresholds.staleLimit,
  };
}

const TIER_COLORS: Record<AgeTier, string> = {
  fresh: 'var(--severity-healthy)',
  aging: 'var(--accent-primary)',
  stale: 'var(--severity-warning)',
  ancient: 'var(--severity-critical)',
};

interface AgeHistogramProps {
  report: GitrelicReport;
}

export function AgeHistogram({ report }: AgeHistogramProps) {
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

  const { bins, maxCount, totalFiles, ancientCount, staleLimit } = useMemo(
    () => prepareAgeHistogramData(report),
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

  if (totalFiles === 0 || bins.length === 0) {
    return (
      <div ref={containerRef} className="w-full h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center text-text-tertiary text-xs">
          No tracked files in the repository.
        </div>
        <HeroCaption
          primary="Distribution of last-commit age across all tracked files · 30-day bins · color = tier"
          subtitle="No age signal in the analyzed window."
        />
      </div>
    );
  }

  const barWidth = (plotW - BAR_GAP * (bins.length - 1)) / bins.length;
  // Snap the threshold marker to the bucket boundary that contains staleLimit.
  // Files with ageInDays > staleLimit are "ancient", so the shaded zone starts
  // at the bucket whose rangeStart is the smallest multiple of BIN_WIDTH > staleLimit.
  const thresholdBinIdx = bins.findIndex((b) => b.tier === 'ancient');
  const thresholdX =
    thresholdBinIdx >= 0 ? thresholdBinIdx * (barWidth + BAR_GAP) : plotW;
  const showThreshold = thresholdBinIdx >= 0 && thresholdBinIdx < bins.length;

  const yTicks = yScale.ticks(4);
  const hover =
    hoverIdx == null ? null : { idx: hoverIdx, bin: bins[hoverIdx] };

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col">
      <div className="flex-1 relative">
        <svg
          width={dims.width}
          height={svgHeight}
          role="img"
          aria-label={`Age distribution histogram across ${totalFiles} files. ${ancientCount} ${ancientCount === 1 ? 'file is' : 'files are'} ancient (>${staleLimit} days since last commit).`}
        >
          <g transform={`translate(${PADDING.left},${PADDING.top})`}>
            {/* "Going cold" threshold zone shading */}
            {showThreshold && (
              <>
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
                  textAnchor="start"
                >
                  ancient (&gt;{staleLimit}d) · {ancientCount}{' '}
                  {ancientCount === 1 ? 'file' : 'files'}
                </text>
              </>
            )}

            {/* Y axis */}
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

            {/* Bars */}
            {bins.map((b, i) => {
              const x = i * (barWidth + BAR_GAP);
              const y = yScale(b.count);
              const h = plotH - y;
              const isHover = hoverIdx === i;
              const color = TIER_COLORS[b.tier];
              return (
                <g key={`bar-${b.rangeStart}-${b.isOverflow ? 'ovf' : 'in'}`}>
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
            <line
              x1={0}
              y1={plotH}
              x2={plotW}
              y2={plotH}
              stroke="var(--border-primary)"
            />
            {bins.map((b, i) => {
              const x = i * (barWidth + BAR_GAP) + barWidth / 2;
              const label = b.isOverflow
                ? `${b.rangeStart}+`
                : `${b.rangeStart}`;
              return (
                <g
                  key={`x-${b.rangeStart}-${b.isOverflow ? 'ovf' : 'in'}`}
                  transform={`translate(${x},${plotH})`}
                >
                  <line y2={4} stroke="var(--border-primary)" />
                  <text
                    y={14}
                    textAnchor="middle"
                    fontSize={8}
                    fill="var(--text-tertiary)"
                  >
                    {label}
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
              Days since last commit
            </text>
          </g>

          {/* Tier legend */}
          {(['fresh', 'aging', 'stale', 'ancient'] as const).map((tier, i) => (
            <g
              key={tier}
              transform={`translate(${PADDING.left + i * 70},${PADDING.top - 14})`}
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
              top: PADDING.top + yScale(hover.bin.count) - 8,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="font-semibold">
              {hover.bin.isOverflow
                ? `${hover.bin.rangeStart}+ days`
                : `${hover.bin.rangeStart}–${hover.bin.rangeEnd} days`}
            </div>
            <div className="text-text-secondary">
              {hover.bin.count} {hover.bin.count === 1 ? 'file' : 'files'}
              {totalFiles > 0 && (
                <> · {((hover.bin.count / totalFiles) * 100).toFixed(0)}%</>
              )}
            </div>
            <div
              className="mt-0.5 capitalize"
              style={{ color: TIER_COLORS[hover.bin.tier] }}
            >
              {hover.bin.tier}
            </div>
          </div>
        )}
      </div>
      <HeroCaption
        primary={`Distribution of last-commit age across all tracked files · 30-day bins · color = tier (fresh/aging/stale/ancient) · zone past ${staleLimit}d = ancient`}
        subtitle="What's the shape of staleness in this codebase? Is it a long tail of forgotten files, a bimodal active-vs-archive split, or a smooth aging plateau?"
      />
    </div>
  );
}
